from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from .views import ai, auth, discover, inbox, posts, users

app_name = "api"

router = DefaultRouter(trailing_slash=True)
router.register("posts", posts.PostViewSet, basename="post")
router.register("comments", posts.CommentViewSet, basename="comment")

urlpatterns = [
    path("health/", lambda request: JsonResponse({"status": "ok"}), name="health"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="api:schema"), name="docs"),

    path("auth/csrf/", auth.CsrfView.as_view(), name="csrf"),
    path("auth/me/", auth.MeView.as_view(), name="me"),
    path("auth/register/", auth.RegisterView.as_view(), name="register"),
    path("auth/login/", auth.LoginView.as_view(), name="login"),
    path("auth/logout/", auth.LogoutView.as_view(), name="logout"),
    path("auth/activate/<str:uidb64>/<str:token>/", auth.ActivateView.as_view(), name="activate"),
    path("auth/password-reset/", auth.PasswordResetView.as_view(), name="password-reset"),
    path("auth/password-reset/confirm/", auth.PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("auth/password-change/", auth.PasswordChangeView.as_view(), name="password-change"),

    path("users/", users.UserSearchView.as_view(), name="user-search"),
    path("users/suggestions/", users.SuggestionsView.as_view(), name="user-suggestions"),
    path("users/me/", users.MeUpdateView.as_view(), name="me-update"),
    path("users/<str:username>/", users.UserDetailView.as_view(), name="user-detail"),
    path("users/<str:username>/follow/", users.FollowView.as_view(), name="user-follow"),
    path("users/<str:username>/followers/", users.FollowersView.as_view(), name="user-followers"),
    path("users/<str:username>/following/", users.FollowingView.as_view(), name="user-following"),

    path("tags/", discover.TagsView.as_view(), name="tags"),
    path("cook/", discover.CookView.as_view(), name="cook"),
    path("cook/scan/", discover.CookScanView.as_view(), name="cook-scan"),
    path("ingredients/", discover.IngredientsView.as_view(), name="ingredients"),
    path("search/", discover.SearchView.as_view(), name="search"),
    path("stats/", discover.StatsView.as_view(), name="stats"),

    path("badges/", inbox.BadgesView.as_view(), name="badges"),
    path("notifications/", inbox.NotificationsView.as_view(), name="notifications"),
    path("notifications/read/", inbox.NotificationsReadView.as_view(), name="notifications-read"),
    path("notifications/<int:pk>/", inbox.NotificationDetailView.as_view(), name="notification-detail"),
    path("conversations/", inbox.ConversationsView.as_view(), name="conversations"),
    path("conversations/<str:username>/", inbox.ConversationView.as_view(), name="conversation"),
    path("conversations/<str:username>/draft/", ai.ReplyDraftView.as_view(), name="conversation-draft"),
    path("conversations/<str:username>/reply/", ai.SousChefReplyView.as_view(), name="conversation-reply"),

    path("ai/", ai.AIStatusView.as_view(), name="ai"),
    path("ai/post-draft/", ai.PostDraftView.as_view(), name="ai-post-draft"),

    path("", include(router.urls)),
]
