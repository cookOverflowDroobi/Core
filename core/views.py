from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.views.decorators.csrf import ensure_csrf_cookie
from django.urls import reverse_lazy
from django.db.models import Q

# from Friends.models import Friend
from Timeline.models import Post
from Profile.models import Profile, Profile_profile_followers
from notifications.models import Notification


def home(request):
    if not request.user.is_authenticated:
        return redirect(reverse_lazy('Account:Register'))

    # friends_one = Friend.objects.filter(friend=request.user).filter(status='friend')
    # friends_two = Friend.objects.filter(user=request.user).filter(status='friend')
    # friends_list_one = list(friends_one.values_list('user_id', flat=True))
    # friends_list_two = list(friends_two.values_list('friend_id', flat=True))
    # friends_list_id = friends_list_one + friends_list_two + [request.user.id]
    # friends = friends_one.union(friends_two)
    profile = Profile.objects.get(user=request.user)
    followers = Profile_profile_followers.objects.filter(user_id = request.user.id)
    followersList = []
    for follower in followers:
        followersList.append(follower.profile_id)
    followersList.append(request.user.id)
    
    post = Post.objects.filter(user__id__in = followersList)

    number_of_notification = Notification.objects.filter(is_seen = False).count()
    context = {
            'posts' : post,
            'numberOfNotification':number_of_notification, 
        }
    # return render(request, 'home.html', {'posts': posts, 'friends': friends})
    
    return render(request, 'home.html', context)


@ensure_csrf_cookie
def spa(request):
    """Serve the built React app; client-side routing takes it from there."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse(
            "<h1>cookOverflow</h1><p>The React app isn't built yet. Run <code>npm run build</code> in "
            "<code>frontend/</code>, or use the dev server at <a href='http://localhost:5173'>localhost:5173</a>.</p>",
            status=503,
        )
    return HttpResponse(index.read_text(encoding="utf-8"))

