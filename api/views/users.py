from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Account.models import User
from notifications.models import Notification
from Profile.models import Profile_profile_followers

from ..pagination import PagePagination
from ..queries import ensure_profile, is_following, search_users, users_for
from ..recommendations import suggested_users
from ..serializers import ProfileSerializer, ProfileUpdateSerializer, UserCardSerializer
from ..utils import int_param


def paginate(view, request, items, serializer_class):
    paginator = PagePagination()
    page = paginator.paginate_queryset(items, request, view=view)
    return paginator.get_paginated_response(serializer_class(page, many=True, context={"request": request}).data)


class UserSearchView(APIView):
    """`GET /users/?q=` - find people by username or name."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        users = search_users(request.user, query) if query else users_for(request.user).order_by("-followers_count")
        return paginate(self, request, users, UserCardSerializer)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, username):
        user = get_object_or_404(users_for(request.user), username__iexact=username)
        ensure_profile(user)
        return Response(ProfileSerializer(user, context={"request": request}).data)


class MeUpdateView(APIView):
    """`PATCH /users/me/` - edit your profile (multipart for avatar/cover uploads)."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request):
        ensure_profile(request.user)
        serializer = ProfileUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(request.user)
        user = users_for(request.user).get(pk=request.user.pk)
        return Response(ProfileSerializer(user, context={"request": request}).data)


class FollowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, username):
        target = get_object_or_404(User, username__iexact=username)
        if target.pk == request.user.pk:
            return Response({"detail": "You can't follow yourself."}, status=status.HTTP_400_BAD_REQUEST)
        if not is_following(request.user, target):
            # Creating the through row (not profile.followers.add) fires the follow notification signal.
            Profile_profile_followers.objects.create(user=request.user, profile=ensure_profile(target))
        return self.state(request, target)

    def delete(self, request, username):
        target = get_object_or_404(User, username__iexact=username)
        ensure_profile(target).followers.remove(request.user)
        # Withdraw the "started following you" notification so re-follows don't pile up duplicates.
        Notification.objects.filter(sender=request.user, user=target, notification_type=3).delete()
        return self.state(request, target)

    def state(self, request, target):
        user = users_for(request.user).get(pk=target.pk)
        return Response({"is_following": user.is_following, "followers_count": user.followers_count})


class FollowersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, username):
        target = get_object_or_404(User, username__iexact=username)
        ids = Profile_profile_followers.objects.filter(profile_id=target.pk).values("user_id")
        return paginate(self, request, users_for(request.user).filter(pk__in=ids).order_by("username"),
                        UserCardSerializer)


class FollowingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, username):
        target = get_object_or_404(User, username__iexact=username)
        ids = Profile_profile_followers.objects.filter(user=target).values("profile_id")
        return paginate(self, request, users_for(request.user).filter(pk__in=ids).order_by("username"),
                        UserCardSerializer)


class SuggestionsView(APIView):
    """People you may want to follow, each with a short reason."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int_param(request, "limit", 5, 20)
        users = suggested_users(request.user, limit)
        return Response(UserCardSerializer(users, many=True, context={"request": request}).data)
