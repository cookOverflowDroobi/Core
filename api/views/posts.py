from django.db import IntegrityError, transaction
from django.db.models import F, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from Timeline.models import Comment, Likes, Post, PostImage, SavedPost, Tag, postVideo

from ..pagination import PagePagination
from ..queries import following_ids, posts_for
from ..recommendations import for_you, trending
from ..serializers import CommentSerializer, PostSerializer, PostWriteSerializer, validate_upload

MAX_IMAGES = 6


def tag_objects(names):
    """Reuse an existing Tag row per name (legacy posts created one row per post)."""
    tags = []
    for name in names:
        tag = Tag.objects.filter(title=name).order_by("pk").first() or Tag.objects.create(title=name)
        tags.append(tag)
    return tags


class PostViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                  mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Posts and recipes. `GET /posts/` is the explore stream (newest first).

    Filters: `?tag=`, `?author=<username>`, `?recipes=1`, `?q=`.
    """

    serializer_class = PostSerializer
    pagination_class = PagePagination
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = posts_for(self.request.user)
        params = self.request.query_params
        if tag := params.get("tag"):
            qs = qs.filter(tags__title=tag.lower().lstrip("#")).distinct()
        if author := params.get("author"):
            qs = qs.filter(user__username__iexact=author)
        if params.get("recipes") in ("1", "true"):
            qs = qs.exclude(ingredients=[])
        if q := params.get("q", "").strip():
            qs = qs.filter(Q(title__icontains=q) | Q(body__icontains=q) | Q(cuisine__icontains=q))
        return qs.order_by("-created_at")

    def paginated(self, items):
        page = self.paginate_queryset(items)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    # ---------------------------------------------------------------- feeds

    @action(detail=False)
    def feed(self, request):
        """Posts from people you follow, plus your own."""
        ids = list(following_ids(request.user)) + [request.user.pk]
        return self.paginated(posts_for(request.user).filter(user_id__in=ids).order_by("-created_at"))

    @action(detail=False, url_path="trending")
    def trending_posts(self, request):
        return self.paginated(trending(posts_for(request.user)))

    @action(detail=False, url_path="for-you")
    def for_you_posts(self, request):
        return self.paginated(for_you(request.user, posts_for(request.user)))

    @action(detail=False)
    def saved(self, request):
        saved_at = SavedPost.objects.filter(user=request.user, post=OuterRef("pk")).values("created_at")[:1]
        qs = posts_for(request.user).filter(saved=True).annotate(saved_at=Subquery(saved_at)).order_by("-saved_at")
        return self.paginated(qs)

    # ----------------------------------------------------------------- CRUD

    def _files(self):
        files = self.request.FILES
        images, videos = files.getlist("images"), files.getlist("videos")
        if len(images) > MAX_IMAGES:
            raise ValidationError({"images": f"You can attach up to {MAX_IMAGES} photos."})
        if len(videos) > 1:
            raise ValidationError({"videos": "You can attach one video."})
        return {"images": [validate_upload(f, "image") for f in images],
                "videos": [validate_upload(f, "video") for f in videos]}

    def _write(self, post=None):
        files = self._files()
        writer = PostWriteSerializer(data=self.request.data, partial=post is not None, context={"files": files})
        writer.is_valid(raise_exception=True)
        data = dict(writer.validated_data)
        tags = data.pop("tags", None)

        with transaction.atomic():
            if post is None:
                body = data.pop("body", "").strip() or data.get("title", "")
                post = Post.objects.create(user=self.request.user, body=body, **data)
            else:
                for field, value in data.items():
                    setattr(post, field, value)
                post.updated_at = timezone.now()
                post.save()
            if tags is not None:
                post.tags.set(tag_objects(tags))
            for upload in files["images"]:
                post.image.add(PostImage.objects.create(image=upload))
            for upload in files["videos"]:
                post.video.add(postVideo.objects.create(video=upload))
            remove = self.request.data.get("remove_images")
            if remove:
                ids = [int(i) for i in str(remove).split(",") if i.strip().isdigit()]
                post.image.filter(pk__in=ids).delete()
        return post

    def create(self, request, *args, **kwargs):
        post = self._write()
        data = self.get_serializer(posts_for(request.user).get(pk=post.pk)).data
        return Response(data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        post = self.get_object()
        if post.user_id != request.user.pk:
            raise PermissionDenied("You can only edit your own posts.")
        self._write(post)
        return Response(self.get_serializer(posts_for(request.user).get(pk=post.pk)).data)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        if post.user_id != request.user.pk and not request.user.is_staff:
            raise PermissionDenied("You can only delete your own posts.")
        post.image.all().delete()
        post.video.all().delete()
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------- reactions

    def _counts(self, post):
        fresh = posts_for(self.request.user).get(pk=post.pk)
        return {"liked": fresh.liked, "saved": fresh.saved, "likes_count": fresh.likes_count}

    @action(detail=True, methods=["post", "delete"])
    def like(self, request, pk=None):
        post = get_object_or_404(Post, pk=pk)
        if request.method == "POST":
            try:
                with transaction.atomic():
                    Likes.objects.create(user=request.user, post=post)
                    Post.objects.filter(pk=post.pk).update(likes=F("likes") + 1)  # legacy counter
            except IntegrityError:
                pass  # already liked
        else:
            deleted = False
            for like in Likes.objects.filter(user=request.user, post=post):
                like.delete()  # per-object delete keeps the notification signal working
                deleted = True
            if deleted:
                Post.objects.filter(pk=post.pk, likes__gt=0).update(likes=F("likes") - 1)
        return Response(self._counts(post))

    @action(detail=True, methods=["post", "delete"])
    def save(self, request, pk=None):
        post = get_object_or_404(Post, pk=pk)
        if request.method == "POST":
            SavedPost.objects.get_or_create(user=request.user, post=post)
        else:
            SavedPost.objects.filter(user=request.user, post=post).delete()
        return Response(self._counts(post))

    @action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        post = get_object_or_404(Post, pk=pk)
        if request.method == "POST":
            serializer = CommentSerializer(data=request.data, context={"request": request})
            serializer.is_valid(raise_exception=True)
            comment = serializer.save(user=request.user, post=post)
            comment = Comment.objects.select_related("user__profile").get(pk=comment.pk)
            return Response(CommentSerializer(comment, context={"request": request}).data,
                            status=status.HTTP_201_CREATED)
        comments = Comment.objects.filter(post=post).select_related("user__profile").order_by("created_at")
        return Response(CommentSerializer(comments, many=True, context={"request": request}).data)


class CommentViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = Comment.objects.select_related("post")
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if request.user.pk not in (comment.user_id, comment.post.user_id) and not request.user.is_staff:
            raise PermissionDenied("You can only delete your own comments.")
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
