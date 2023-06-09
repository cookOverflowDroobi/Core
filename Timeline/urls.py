from django.urls import path
from .views import *
from Timeline.views import PostCreateView, like,favorite


app_name = "Timeline"

urlpatterns = [
    path('post/create', PostCreateView.as_view(), name="post-create"),
	path('post/<int:pk>', deletePost, name="post-delete"),
    path('<int:pk>', preview_post, name="post-preview"),
	path('tags/', tags_preview, name="tags_preview"),
	path('searchEngine/', searchEngine, name="searchEngine"),
	path('searchTags/', searchTags, name="searchTags"),
	path('<str:title>', tags_preview, name="tags_preview"),
    path('comment/create/<int:post_id>', create_comment, name="comment-create"),
   	path('FindFriends/', findFriends, name='find-friend'),
   	# path('newpost/', NewPost, name='newpost'),
   	path('like/<int:post_id>', like, name='postlike'),
   	path('<uuid:post_id>/favorite', favorite, name='postfavorite'),
   	# path('tag/<slug:tag_slug>', tags, name='tags'),
]

