from typing import OrderedDict
from django.db import models

from Account.models import User
from django.utils.timezone import now
from notifications.models import Notification
# newly added features
from django.db.models.signals import post_save, post_delete
from django.utils.text import slugify
from django.urls import reverse
from Profile.models import Profile_profile_followers


# adding Tages


class Tag(models.Model):
    title = models.CharField(max_length=75, verbose_name='Tag')
    # slug = models.SlugField(null=False, unique=True)

    # class Meta:
    #     verbose_name = 'Tag'
    #     verbose_name_plural = 'Tags'

    def get_absolute_url(self):
        return reverse('tags', args=[self.slug])

    def __str__(self):
        return self.title

    # def save(self, *args, **kwargs):
    #     if not self.slug:
    #         self.slug = slugify(self.title)
    #     return super().save(*args, **kwargs)





class Post(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
	body = models.TextField()
	image = models.ManyToManyField('PostImage', blank=True)
	video = models.ManyToManyField('postVideo', blank=True)
	created_at = models.DateTimeField(default=now)
	likes = models.IntegerField(default=0)
	tags = models.ManyToManyField("Tag", related_name='tags')

	# Optional structured recipe. A post with ingredients is treated as a recipe.
	DIFFICULTY_CHOICES = (("easy", "Easy"), ("medium", "Medium"), ("hard", "Hard"))
	title = models.CharField(max_length=120, blank=True)
	cuisine = models.CharField(max_length=40, blank=True)
	difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, blank=True)
	cook_time = models.PositiveIntegerField(null=True, blank=True, help_text="Minutes")
	servings = models.PositiveSmallIntegerField(null=True, blank=True)
	ingredients = models.JSONField(default=list, blank=True)
	steps = models.JSONField(default=list, blank=True)
	updated_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		ordering = ("-created_at",)

	@property
	def is_recipe(self):
		return bool(self.ingredients)


class PostImage(models.Model):
    image = models.ImageField(upload_to="images/", blank=True, null=False)

class postVideo(models.Model):
    video = models.FileField(upload_to="videos/", blank=True, null=False)

class Comment(models.Model):
	post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
	user = models.ForeignKey(User, on_delete=models.CASCADE)
	content = models.TextField()
	created_at = models.DateTimeField(default=now)
	
	def user_comment_post(sender, instance, *args, **kwargs):
		comment = instance
		post = comment.post
		sender = comment.user
		notify = Notification(post=post, sender=sender, user=post.user, notification_type=2)
		notify.save()

	def user_delete_comment_post(sender, instance, *args, **kwargs):
		comment = instance
		post = comment.post
		sender = comment.user

		notify = Notification.objects.filter(post=post, sender=sender, notification_type=2)
		notify.delete()

#adding models for follow and likes


class Follow(models.Model):
	follower = models.ForeignKey(User,on_delete=models.CASCADE, null=True, related_name='follower')
	following = models.ForeignKey(User,on_delete=models.CASCADE, null=True, related_name='following')

	def user_follow(sender, instance, *args, **kwargs):
		follow = instance
		sender = follow.follower
		following = follow.following
		notify = Notification(sender=sender, user=following, notification_type=3)
		notify.save()

	def user_unfollow(sender, instance, *args, **kwargs):
		follow = instance
		sender = follow.follower
		following = follow.following

		notify = Notification.objects.filter(sender=sender, user=following, notification_type=3)
		notify.delete()

# adding likes  with notifications
class Likes(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_like')
	post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='post_like')
	created_at = models.DateTimeField(default=now)

	class Meta:
		constraints = [models.UniqueConstraint(fields=["user", "post"], name="unique_like_per_user")]

	def user_liked_post(sender, instance, *args, **kwargs):
		like = instance
		post = like.post
		sender = like.user
		notify = Notification(post=post, sender=sender, user=post.user, notification_type=1)
		notify.save()

	def user_unlike_post(sender, instance, *args, **kwargs):
		like = instance
		post = like.post
		sender = like.user

		notify = Notification.objects.filter(post=post, sender=sender, notification_type=1)
		notify.delete()

# Bookmarked posts ("Saved" in the app).
class SavedPost(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_posts')
	post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='saves')
	created_at = models.DateTimeField(default=now)

	class Meta:
		ordering = ("-created_at",)
		constraints = [models.UniqueConstraint(fields=["user", "post"], name="unique_save_per_user")]

# adding the streamming
class Stream(models.Model):
    following = models.ForeignKey(User, on_delete=models.CASCADE,null=True, related_name='stream_following')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True)
    date = models.DateTimeField()

    def add_post(sender, instance, *args, **kwargs):
    	post = instance
    	user = post.user
    	followers = Follow.objects.all().filter(following=user)
    	for follower in followers:
    		stream = Stream(post=post, user=follower.follower, date=post.posted, following=user)
    		stream.save()


#Stream
post_save.connect(Stream.add_post, sender=Post)

#Likes
post_save.connect(Likes.user_liked_post, sender=Likes)
post_delete.connect(Likes.user_unlike_post, sender=Likes)

# #Comment
post_save.connect(Comment.user_comment_post, sender=Comment)
post_delete.connect(Comment.user_delete_comment_post, sender=Comment)

#Follow
post_save.connect(Profile_profile_followers.user_follow, sender=Profile_profile_followers)
# post_delete.connect(Profile_profile_followers.user_unfollow, sender=Profile_profile_followers)