
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Q
from django.http import HttpResponseRedirect, HttpResponse
from django.shortcuts import render
from django.contrib.auth.decorators import login_required
# from . import engines

import os

# Create your views here.
from django.shortcuts import render, redirect
from django.template.loader import get_template
from django.urls import reverse_lazy, reverse
from django.views import View
from django.views.generic import DetailView, UpdateView
from django.contrib.auth.forms import UserCreationForm ,UserChangeForm
# from django_serializer.paginator import Paginator

from Account.models import User
from Profile.models import Profile, Profile_profile_followers
from Timeline.models import Post, Likes
from notifications.models import Notification


class TimelineView(DetailView):

    def get(self, request, pk, *args, **kwargs):
        profile = Profile.objects.get(pk=pk)
        posts = Post.objects.filter(user=profile.user)
        context = {
            "profile": profile,
            "posts": posts
        }
        print()
        print()
        print()
        print("Inside get")
        print()
        print()
        print()
        return render(request, "profile/user-profile.html",context)

# class UpdateImage(UpdateView):
#     model=Profile
#     fields=['profile_image']
#     template_name='profile/user-profile.html'
    
#     def post(self ,request, pk, *args, **kwargs):
#         profile = Profile.objects.get(pk = pk)
#         posts = Post.objects.filter(user=profile.user)
#         context = {
#             "profile": profile,
#             "posts": posts
#         }
#         print()
#         print()
#         print()
#         print("Inside Post")
#         print()
#         print()
#         print()
                
#         if request.method == "POST":
#             if len(request.FILES)!=0:
#                 user = Profile.objects.filter(user = request.user)
#                 # os.remove(profile.profile_image.path)
#                 profile.profile_image = request.FILES('proImage')
#                 print()
#                 print()
#                 print()
#                 print(request.FILES('proImage'))
#                 print()
#                 print()
#                 print()
#                 user.save()
            
#         return render(request, "profile/user-profile.html") 


class ProfileEditView(UpdateView):
    # form_class =UserChangeForm
    model = Profile
    template_name = "profile/edit-my-profile.html"
    context_object_name = "profile"
    object = None
    fields = "__all__"

    def get_object(self, queryset=None):
        return self.request.user.profile

    def post(self, request, *args, **kwargs):
        user = request.user
        user.first_name = request.POST.get('first_name')
        user.last_name = request.POST.get('last_name')
        user.about = request.POST.get('about')
        if request.POST.get('gender') == "male":
            user.gender = "male"
        else:
            user.gender = "female"
        user.save()
        profile = user.profile
        if  "profile_image" in request.FILES:
            profile.profile_image =  request.FILES["profile_image"]
        if "cover_image" in request.FILES:
            profile.cover_image =  request.FILES["cover_image"]
        profile.country = request.POST.get('country')
        profile.city = request.POST.get('city')
        profile.phone = request.POST.get('phone')
        profile.about = request.POST.get('about')
        profile.save()
        return redirect(reverse_lazy('profile:edit-profile'))


@login_required
def like(request, post_id):
	user = request.user
	post = Post.objects.get(id=post_id)
	current_likes = post.likes
	liked = Likes.objects.filter(user=user, post=post).count()

	if not liked:
		like = Likes.objects.create(user=user, post=post)
		#like.save()
		current_likes = current_likes + 1

	else:
		Likes.objects.filter(user=user, post=post).delete()
		current_likes = current_likes - 1

	post.likes = current_likes
	post.save()

	return HttpResponseRedirect(reverse('profile:edit-profile', args=[post_id]))

@login_required
def favorite(request, post_id):
	user = request.user
	post = Post.objects.get(id=post_id)
	profile = Profile.objects.get(user=user)

	if profile.favorites.filter(id=post_id).exists():
		profile.favorites.remove(post)

	else:
		profile.favorites.add(post)

	return HttpResponseRedirect(reverse('profile:edit-profile', args=[post_id]))

class AddFollower(LoginRequiredMixin, View):
    def post(self, request, pk, *args, **kwargs):
        profile = Profile.objects.get(pk=pk)

        addFollow = Profile_profile_followers.objects.create(user = request.user, profile = profile)

        addFollow.save()
        
        return redirect('profile:user-timeline', pk=profile.pk)



class RemoveFollower(LoginRequiredMixin, View):
    def post(self, request, pk, *args, **kwargs):
        profile = Profile.objects.get(pk=pk)

        profile.followers.remove(request.user)

        return redirect('profile:user-timeline', pk=profile.pk)

# class UserSearch (View):
#     def get(self,request,*args,**kwargs):
#         query =self.request.GET.get('query')
#         profile_list =Profile.objects.filter(

#             Q(user__username__icontains =query)

#         )
#         context ={
#             'profile_list':profile_list,
#         }
#         return render (request,'search/search.html',context)

# @login_required
# def UserSearch(request):
#     query = request.GET.get("q")
#     context = {}

#     if query:
#         users = User.objects.filter(Q(username__icontains=query))

#         # Pagination
#         paginator = Paginator(users, 6)
#         page_number = request.GET.get('page')
#         users_paginator = paginator.get_page(page_number)

#         context = {
#             'users': users_paginator,
#         }

#     # template = loader.get_template('search/search_user.html')
#     template = get_template("search/search_user.html")


    # return HttpResponse(template.render(context, request))

class ProfileView(View):
    def get(self, request, pk, *args, **kwargs):
        profile = Profile.objects.get(pk=pk)
        user = profile.user
        posts = Post.objects.filter(user=user)


        followers = profile.followers.all()
        following = Profile.objects.filter(followers__id = user.id)

        if len(followers) == 0:
            is_following = False
        for follower in followers:
            if follower == request.user:
                is_following = True
                break
            else:
                is_following = False

        number_of_followers = len(followers)
        number_of_following = len(following)
        number_of_notification = Notification.objects.filter(is_seen = False).count()

        context = {
            'user': user,
            'profile': profile,
            'posts': posts,
            'is_following': is_following,
            'number_of_followers': number_of_followers,
            'number_of_following' : number_of_following,
            'numberOfNotification':number_of_notification, 
            'followers' : followers,
            'following' : following,
        }
        return render(request, 'profile/user-profile.html', context)