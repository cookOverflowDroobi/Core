from django.db.models import Count, Q
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Account.models import User
from Timeline.models import Post, Tag

from ..ingredients import PANTRY_STAPLES, rank_recipes, vocabulary
from ..queries import posts_for, search_users
from ..serializers import PostSerializer, UserCardSerializer
from ..utils import int_param


def recipe_posts(user):
    return posts_for(user).exclude(ingredients=[])


class TagsView(APIView):
    """Popular tags with post counts."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        limit = int_param(request, "limit", 30, 100)
        rows = (Tag.objects.values("title").annotate(count=Count("tags", distinct=True))
                .filter(count__gt=0).order_by("-count", "title")[:limit])
        return Response([{"name": row["title"], "count": row["count"]} for row in rows])


class CookView(APIView):
    """What can I cook? `GET /cook/?ingredients=rice,chicken,onion&staples=1`

    Ranks every recipe by how much of it your ingredients cover, and lists what's missing.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw = request.query_params.get("ingredients", "")
        have = [item.strip() for item in raw.split(",") if item.strip()][:30]
        assume_staples = request.query_params.get("staples", "1") in ("1", "true")
        results = rank_recipes(have, recipe_posts(request.user), assume_staples) if have else []
        limit = int_param(request, "limit", 30, 60)
        context = {"request": request}
        return Response({
            "ingredients": have,
            "staples": sorted(PANTRY_STAPLES) if assume_staples else [],
            "count": len(results),
            "results": [{
                "post": PostSerializer(result["post"], context=context).data,
                "score": round(result["score"], 3),
                "matched": result["matched"],
                "missing": result["missing"],
            } for result in results[:limit]],
        })


class IngredientsView(APIView):
    """Ingredient vocabulary for autocomplete: `GET /ingredients/?q=chi`."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        lists = Post.objects.exclude(ingredients=[]).values_list("ingredients", flat=True)
        return Response(vocabulary(lists, request.query_params.get("q", ""),
                                   int_param(request, "limit", 20, 50)))


class SearchView(APIView):
    """Search people, posts and tags at once: `GET /search/?q=pasta`."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip().lstrip("#")
        if not query:
            return Response({"query": "", "users": [], "posts": [], "tags": []})
        context = {"request": request}
        users = search_users(request.user, query)[:5]
        posts = posts_for(request.user).filter(
            Q(title__icontains=query) | Q(body__icontains=query) | Q(cuisine__icontains=query)
            | Q(tags__title__icontains=query)
        ).distinct().order_by("-created_at")[:10]
        tags = (Tag.objects.filter(title__icontains=query).values("title")
                .annotate(count=Count("tags", distinct=True)).filter(count__gt=0).order_by("-count")[:8])
        return Response({
            "query": query,
            "users": UserCardSerializer(users, many=True, context=context).data,
            "posts": PostSerializer(posts, many=True, context=context).data,
            "tags": [{"name": t["title"], "count": t["count"]} for t in tags],
        })


class StatsView(APIView):
    """Public community numbers for the landing page."""

    permission_classes = [AllowAny]

    def get(self, request):
        recipes = Post.objects.exclude(ingredients=[])
        return Response({
            "cooks": User.objects.filter(is_active=True).count(),
            "recipes": recipes.count(),
            "posts": Post.objects.count(),
            "cuisines": recipes.exclude(cuisine="").values("cuisine").distinct().count(),
        })
