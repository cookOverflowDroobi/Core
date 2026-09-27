"""Lightweight, explainable ranking: trending posts, a personal "For you" feed and people to follow."""
import math
from collections import Counter, defaultdict
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from Account.models import User
from Profile.models import Profile_profile_followers
from Timeline.models import Comment, Likes, Post, SavedPost

from .ingredients import normalize
from .queries import following_ids, users_for


def _age_hours(post, now):
    return max(0.0, (now - post.created_at).total_seconds() / 3600)


def trending(posts, limit=40, window_days=14):
    """Engagement in the last `window_days`, decayed by post age (a Hacker News style score)."""
    now = timezone.now()
    since = now - timedelta(days=window_days)
    posts = list(posts.annotate(
        recent_likes=Count("post_like", filter=Q(post_like__created_at__gte=since), distinct=True),
        recent_comments=Count("comments", filter=Q(comments__created_at__gte=since), distinct=True),
    ))

    def score(post):
        engagement = post.recent_likes + 2 * post.recent_comments + 1
        return engagement / (_age_hours(post, now) / 24 + 2) ** 1.3

    ranked = sorted(posts, key=score, reverse=True)[:limit]
    for post in ranked:
        post.reason = "Trending now"
    return ranked


def _interest_profile(user):
    """Weights for tags, cuisines and ingredients the user has engaged with."""
    weights = defaultdict(Counter)
    signals = [
        (Likes.objects.filter(user=user).values_list("post", flat=True), 2.0),
        (SavedPost.objects.filter(user=user).values_list("post", flat=True), 3.0),
        (Comment.objects.filter(user=user).values_list("post", flat=True), 1.5),
    ]
    for post_ids, weight in signals:
        for post in Post.objects.filter(pk__in=list(post_ids)).prefetch_related("tags"):
            for tag in post.tags.all():
                weights["tags"][tag.title] += weight
            if post.cuisine:
                weights["cuisines"][post.cuisine] += weight
            for item in post.ingredients:
                weights["ingredients"][normalize(item)] += weight * 0.3
    return weights


def for_you(user, posts, limit=40):
    """Content-based recommendations with a popularity/recency prior and author diversity."""
    interests = _interest_profile(user)
    if not interests:
        return trending(posts, limit)

    now = timezone.now()
    liked = set(Likes.objects.filter(user=user).values_list("post_id", flat=True))
    candidates = posts.exclude(user=user).exclude(pk__in=liked)[:500]

    scored = []
    for post in candidates:
        tag_hits = {tag.title: interests["tags"][tag.title] for tag in post.tags.all() if interests["tags"][tag.title]}
        cuisine_hit = interests["cuisines"][post.cuisine] if post.cuisine else 0
        ingredient_hit = sum(interests["ingredients"][normalize(i)] for i in post.ingredients)
        score = (sum(tag_hits.values()) + cuisine_hit + ingredient_hit
                 + 0.6 * math.log1p(getattr(post, "likes_count", 0))
                 + 2.0 * math.exp(-_age_hours(post, now) / 240))
        if tag_hits:
            post.reason = f"Because you like #{max(tag_hits, key=tag_hits.get)}"
        elif cuisine_hit:
            post.reason = f"More {post.cuisine.title()} cooking"
        else:
            post.reason = "Popular with the community"
        scored.append((score, post))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    per_author, result = Counter(), []
    for _, post in scored:
        if per_author[post.user_id] < 3:
            per_author[post.user_id] += 1
            result.append(post)
        if len(result) == limit:
            break
    return result


def suggested_users(user, limit=5):
    """People to follow: friends of friends first, then popular cooks."""
    following = set(following_ids(user))
    mutuals = Counter(
        Profile_profile_followers.objects.filter(user_id__in=following)
        .exclude(profile_id__in=following | {user.pk}).values_list("profile_id", flat=True)
    )
    candidates = list(users_for(user).exclude(pk__in=following | {user.pk}).filter(is_active=True))
    names = dict(User.objects.filter(pk__in=following).values_list("pk", "username"))

    def score(candidate):
        return 3 * mutuals[candidate.pk] + math.log1p(candidate.followers_count) + 0.2 * candidate.posts_count

    ranked = sorted(candidates, key=score, reverse=True)[:limit]
    for candidate in ranked:
        via = Profile_profile_followers.objects.filter(
            profile_id=candidate.pk, user_id__in=following).values_list("user_id", flat=True).first()
        candidate.reason = f"Followed by @{names[via]}" if via in names else "Popular cook"
    return ranked
