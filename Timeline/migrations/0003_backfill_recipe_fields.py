"""Backfill structured recipe fields from posts written in the plain-text recipe format:

    <intro line>
    Ingredients:
    - item
    Steps:
    1. step
    Serves 4 | Ready in 45 min

and give existing likes the timestamp of their like notification.
"""
import re

from django.db import migrations

SERVES_RE = re.compile(r"Serves\s+(\d+)", re.I)
MINUTES_RE = re.compile(r"Ready in\s+(\d+)\s*min", re.I)
STEP_RE = re.compile(r"^\d+[.)]\s*")


def known_dishes():
    try:
        from core.management.demo_content import DISHES
    except ImportError:
        return {}, set()
    names = {dish[0]: cuisine for cuisine, dishes in DISHES.items() for dish in dishes}
    return names, set(DISHES)


def parse_recipe(body):
    section, ingredients, steps = None, [], []
    for raw in body.splitlines():
        line = raw.strip()
        if line.lower() == "ingredients:":
            section = "ingredients"
        elif line.lower() == "steps:":
            section = "steps"
        elif not line:
            section = None if section == "steps" and steps else section
        elif section == "ingredients" and line.startswith("-"):
            ingredients.append(line.lstrip("- ").strip())
        elif section == "steps" and STEP_RE.match(line):
            steps.append(STEP_RE.sub("", line).strip())
    return ingredients, steps


def backfill(apps, schema_editor):
    Post = apps.get_model("Timeline", "Post")
    Likes = apps.get_model("Timeline", "Likes")
    Notification = apps.get_model("notifications", "Notification")
    dish_names, cuisines = known_dishes()

    for post in Post.objects.filter(body__contains="Ingredients:"):
        ingredients, steps = parse_recipe(post.body)
        if post.ingredients or not ingredients:
            continue
        first_line = post.body.splitlines()[0]
        post.title = next((name for name in dish_names if name in first_line), "")[:120]
        post.cuisine = dish_names.get(post.title) or next(
            (t.title for t in post.tags.all() if t.title in cuisines), "")
        post.ingredients, post.steps = ingredients, steps
        if match := SERVES_RE.search(post.body):
            post.servings = int(match.group(1))
        if match := MINUTES_RE.search(post.body):
            post.cook_time = int(match.group(1))
            post.difficulty = "easy" if post.cook_time <= 30 else "medium" if post.cook_time <= 60 else "hard"
        post.save()

    for like in Likes.objects.all():
        note = Notification.objects.filter(post_id=like.post_id, sender_id=like.user_id,
                                           notification_type=1).order_by("date").first()
        if note:
            Likes.objects.filter(pk=like.pk).update(created_at=note.date)


class Migration(migrations.Migration):

    dependencies = [
        ("Timeline", "0002_recipe_fields_likes_saved"),
        ("notifications", "0001_initial"),
    ]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
