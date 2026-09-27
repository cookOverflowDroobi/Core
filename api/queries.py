"""Reusable, query-efficient querysets for the API."""
from django.db.models import Count, Exists, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce

from Account.models import User
from Profile.models import Profile, Profile_profile_followers
from Timeline.models import Comment, Likes, Post, SavedPost


def _count(model, field="post"):
    rows = (model.objects.filter(**{field: OuterRef("pk")}).order_by()
            .values(field).annotate(c=Count("*")).values("c")[:1])
    return Coalesce(Subquery(rows, output_field=IntegerField()), Value(0))


def posts_for(user):
    """Posts with author, media and tags prefetched and like/comment/save state annotated."""
    qs = (Post.objects.select_related("user__profile")
          .prefetch_related("tags", "image", "video")
          .annotate(likes_count=_count(Likes), comments_count=_count(Comment)))
    if user.is_authenticated:
        qs = qs.annotate(
            liked=Exists(Likes.objects.filter(post=OuterRef("pk"), user=user)),
            saved=Exists(SavedPost.objects.filter(post=OuterRef("pk"), user=user)),
        )
    return qs


def following_ids(user):
    """IDs of users that `user` follows (Profile primary keys are user IDs)."""
    return Profile_profile_followers.objects.filter(user=user).values_list("profile_id", flat=True)


def is_following(follower, target):
    return Profile_profile_followers.objects.filter(user=follower, profile_id=target.pk).exists()


def users_for(viewer):
    """Users with profile, follower counts and (for a signed-in viewer) follow state."""
    qs = User.objects.select_related("profile").annotate(
        followers_count=Coalesce(Subquery(
            Profile_profile_followers.objects.filter(profile_id=OuterRef("pk")).order_by()
            .values("profile_id").annotate(c=Count("*")).values("c")[:1],
            output_field=IntegerField()), Value(0)),
        following_count=Coalesce(Subquery(
            Profile_profile_followers.objects.filter(user=OuterRef("pk")).order_by()
            .values("user").annotate(c=Count("*")).values("c")[:1],
            output_field=IntegerField()), Value(0)),
        posts_count=Coalesce(Subquery(
            Post.objects.filter(user=OuterRef("pk")).order_by()
            .values("user").annotate(c=Count("*")).values("c")[:1],
            output_field=IntegerField()), Value(0)),
    )
    if viewer.is_authenticated:
        qs = qs.annotate(
            is_following=Exists(Profile_profile_followers.objects.filter(user=viewer, profile_id=OuterRef("pk"))),
            follows_you=Exists(Profile_profile_followers.objects.filter(user=OuterRef("pk"), profile_id=viewer.pk)),
        )
    return qs


def search_users(viewer, query):
    return users_for(viewer).filter(
        Q(username__icontains=query) | Q(first_name__icontains=query) | Q(last_name__icontains=query)
    ).order_by("-followers_count", "username")


def ensure_profile(user):
    return Profile.objects.get_or_create(user=user)[0]
