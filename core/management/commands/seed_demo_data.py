"""Fill the database with synthetic users, posts, comments, likes, follows and messages.

    python manage.py seed_demo_data            # create the demo data
    python manage.py seed_demo_data --reset    # delete previous demo data first
"""
import random
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image, ImageDraw, ImageFont

from Account.models import User
from communications.models import Message
from core.management.demo_content import (
    COMMENT_TEMPLATES, COMMENTS, CONVERSATIONS, DEMO_EMAIL_DOMAIN, DEMO_PASSWORD, DISHES,
    QUESTIONS, RECIPE_INTROS, TIPS, TRIED_POSTS, USERS,
)
from notifications.models import Notification
from Profile.models import Profile_profile_followers
from Timeline.models import Comment, Likes, Post, PostImage, Tag

FONT_DIR = Path("C:/Windows/Fonts")
MEDIA_SUBDIR = "demo"


def load_font(size, bold=False):
    for name in (("segoeuib.ttf", "arialbd.ttf") if bold else ("segoeui.ttf", "arial.ttf")):
        try:
            return ImageFont.truetype(str(FONT_DIR / name), size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def shade(colour, factor):
    return tuple(max(0, min(255, int(c * factor))) for c in colour)


def gradient(size, top, bottom):
    width, height = size
    img = Image.new("RGB", size, top)
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / max(1, height - 1)
        draw.line([(0, y), (width, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
    return img


def fit_font(draw, text, max_width, start_size, bold=True):
    size = start_size
    while size > 14:
        font = load_font(size, bold)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 4
    return load_font(size, bold)


class Command(BaseCommand):
    help = "Seed the database with synthetic demo users, posts, comments, likes, follows and messages."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing demo data first.")
        parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42).")

    def handle(self, *args, reset=False, seed=42, **options):
        self.rng = random.Random(seed)
        self.now = timezone.now()
        self.media_root = Path(settings.MEDIA_ROOT)

        demo_users = User.objects.filter(email__endswith="@" + DEMO_EMAIL_DOMAIN)
        if demo_users.exists():
            if not reset:
                raise CommandError("Demo data already exists. Re-run with --reset to replace it.")
            demo_users.delete()
            Tag.objects.filter(tags__isnull=True).delete()
            self.stdout.write("Removed previous demo data.")

        with transaction.atomic():
            users = self.create_users()
            posts = self.create_posts(users)
            follows = self.create_follows(users)
            comments = self.create_comments(posts, users)
            likes = self.create_likes(posts, users)
            messages = self.create_messages(users)

        self.stdout.write(self.style.SUCCESS(
            f"Created {len(users)} users, {len(posts)} posts, {comments} comments, {likes} likes, "
            f"{follows} follows and {messages} messages."
        ))
        self.stdout.write(f"Every demo account uses the password: {DEMO_PASSWORD}")

    # ----------------------------------------------------------------- helpers

    def random_time(self, earliest, latest=None):
        latest = latest or self.now - timedelta(minutes=1)
        if earliest >= latest:
            return latest
        return earliest + (latest - earliest) * self.rng.random()

    def stamp_last_notification(self, when):
        latest = Notification.objects.order_by("-id").first()
        if latest:
            Notification.objects.filter(pk=latest.pk).update(
                date=when, is_seen=when < self.now - timedelta(days=2))

    def save_image(self, img, relative_path, **save_kwargs):
        path = self.media_root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        img.save(path, **save_kwargs)
        return relative_path.as_posix()

    def make_avatar(self, username, initials, colour):
        img = gradient((256, 256), shade(colour, 1.15), shade(colour, 0.75))
        draw = ImageDraw.Draw(img)
        draw.text((128, 128), initials, font=load_font(110, bold=True), fill="white", anchor="mm")
        return self.save_image(img, Path(MEDIA_SUBDIR, "avatars", f"{username}.png"))

    def make_cover(self, username, colour):
        # No text: covers are cropped on narrow screens and the avatar overlaps a corner.
        img = gradient((1200, 320), shade(colour, 0.95), shade(colour, 0.45))
        draw = ImageDraw.Draw(img, "RGBA")
        for x, y, r in [(1040, 40, 220), (860, 300, 140), (1180, 280, 90)]:
            draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 22))
        return self.save_image(img, Path(MEDIA_SUBDIR, "covers", f"{username}.jpg"), quality=85)

    def make_dish_image(self, dish, cuisine, colour, author):
        img = gradient((900, 600), shade(colour, 1.2), shade(colour, 0.6))
        draw = ImageDraw.Draw(img)
        cx, cy, r = 450, 300, 230
        draw.ellipse([cx - r + 8, cy - r + 14, cx + r + 8, cy + r + 14], fill=shade(colour, 0.4))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(250, 247, 240))
        draw.ellipse([cx - r + 28, cy - r + 28, cx + r - 28, cy + r - 28], outline=(226, 219, 205), width=4)
        draw.text((cx, cy - 12), dish, font=fit_font(draw, dish, 360, 64), fill=shade(colour, 0.7), anchor="mm")
        draw.text((cx, cy + 50), cuisine.upper(), font=load_font(24), fill=(140, 130, 115), anchor="mm")
        draw.text((880, 580), "cookOverflow", font=load_font(22, bold=True), fill=(255, 255, 255), anchor="rs")
        name = f"{slugify(dish)}-{author}.jpg"
        return self.save_image(img, Path(MEDIA_SUBDIR, "posts", name), quality=85)

    def add_tags(self, post, titles):
        # Mirrors PostCreateView: every post gets its own Tag rows.
        for title in titles:
            post.tags.add(Tag.objects.create(title=title))

    # ------------------------------------------------------------------ users

    def create_users(self):
        password_hash = make_password(DEMO_PASSWORD)
        users = []
        for username, first, last, gender, city, country, cuisine, about, colour in USERS:
            user = User.objects.create(
                username=username, first_name=first, last_name=last,
                email=f"{username}@{DEMO_EMAIL_DOMAIN}", password=password_hash,
                is_email_verified=True,
                date_joined=self.now - timedelta(days=self.rng.randint(50, 90)),
            )
            profile = user.profile  # created by the post_save signal in Profile.models
            profile.gender = gender
            profile.city = city
            profile.country = country
            profile.about = about
            profile.phone = f"+{self.rng.randint(10, 99)} {self.rng.randint(100, 999)} {self.rng.randint(1000, 9999)}"
            profile.profile_image = self.make_avatar(username, first[0] + last[0], colour)
            profile.cover_image = self.make_cover(username, colour)
            profile.save()
            user.demo = {"cuisine": cuisine, "colour": colour}
            users.append(user)
        return users

    # ------------------------------------------------------------------ posts

    def create_posts(self, users):
        tips = self.rng.sample(TIPS, len(TIPS))
        by_cuisine = {u.demo["cuisine"]: u for u in users}
        posts = []

        for user in users:
            cuisine, colour = user.demo["cuisine"], user.demo["colour"]
            planned = [("recipe", dish, cuisine) for dish in DISHES[cuisine]]
            for other in self.rng.sample([c for c in DISHES if c != cuisine], 2):
                planned.append(("tried", self.rng.choice(DISHES[other]), other))
            planned += [("tip", None, None), ("tip", None, None), ("question", None, None)]
            self.rng.shuffle(planned)

            times = sorted(self.random_time(self.now - timedelta(days=42)) for _ in planned)
            for (kind, dish, dish_cuisine), created_at in zip(planned, times):
                image, recipe = None, {}
                if kind == "recipe":
                    name, course, veg, ingredients, steps = dish
                    body, servings, minutes = self.recipe_body(dish)
                    tags = [cuisine, course] + (["vegetarian"] if veg else [])
                    image = self.make_dish_image(name, cuisine, colour, user.username)
                    recipe = {
                        "title": name, "cuisine": cuisine, "ingredients": ingredients, "steps": steps,
                        "servings": servings, "cook_time": minutes,
                        "difficulty": "easy" if minutes <= 30 else "medium" if minutes <= 60 else "hard",
                    }
                elif kind == "tried":
                    name = dish[0]
                    author = by_cuisine[dish_cuisine].username
                    body = self.rng.choice(TRIED_POSTS).format(dish=name, author=author)
                    tags = [dish_cuisine, "homecooking"]
                    if self.rng.random() < 0.5:
                        image = self.make_dish_image(name, dish_cuisine, by_cuisine[dish_cuisine].demo["colour"],
                                                     user.username)
                elif kind == "tip":
                    body, tags = tips.pop(), ["kitchentips"]
                else:
                    any_dish = self.rng.choice(DISHES[self.rng.choice(list(DISHES))])
                    body = self.rng.choice(QUESTIONS).format(
                        dish=any_dish[0], ingredient=self.rng.choice(any_dish[3]))
                    tags = ["askthecommunity"]

                post = Post.objects.create(user=user, body=body, created_at=created_at, **recipe)
                self.add_tags(post, tags)
                if image:
                    post.image.add(PostImage.objects.create(image=image))
                post.demo = {"kind": kind, "dish": dish}
                posts.append(post)
        return posts

    def recipe_body(self, dish):
        name, course, veg, ingredients, steps = dish
        lines = [self.rng.choice(RECIPE_INTROS).format(dish=name), "", "Ingredients:"]
        lines += [f"- {item}" for item in ingredients]
        lines += ["", "Steps:"]
        lines += [f"{i}. {step}" for i, step in enumerate(steps, 1)]
        minutes, servings = self.rng.choice([20, 30, 45, 60, 90, 120]), self.rng.randint(2, 6)
        lines += ["", f"Serves {servings} | Ready in {minutes} min"]
        return "\n".join(lines), servings, minutes

    # ---------------------------------------------------------------- follows

    def follow(self, follower, target):
        Profile_profile_followers.objects.create(user=follower, profile=target.profile)
        self.stamp_last_notification(self.random_time(self.now - timedelta(days=40)))

    def create_follows(self, users):
        count = 0
        for user in users:
            for target in self.rng.sample([u for u in users if u != user], self.rng.randint(3, 7)):
                self.follow(user, target)
                count += 1

        # Give the local admin a full feed and a few followers of their own.
        admin = User.objects.filter(is_superuser=True).order_by("id").first()
        if admin:
            for user in users:
                self.follow(admin, user)
                count += 1
            for user in self.rng.sample(users, 4):
                self.follow(user, admin)
                count += 1
        return count

    # --------------------------------------------------------------- comments

    def comment_text(self, post):
        dish = post.demo["dish"]
        if dish and self.rng.random() < 0.45:
            return self.rng.choice(COMMENT_TEMPLATES).format(dish=dish[0], ingredient=self.rng.choice(dish[3]))
        return self.rng.choice(COMMENTS)

    def create_comments(self, posts, users):
        ranges = {"recipe": (1, 6), "tried": (0, 4), "tip": (0, 3), "question": (2, 5)}
        count = 0
        for post in posts:
            others = [u for u in users if u != post.user]
            k = self.rng.randint(*ranges[post.demo["kind"]])
            times = sorted(self.random_time(post.created_at + timedelta(minutes=5),
                                            min(self.now, post.created_at + timedelta(days=3))) for _ in range(k))
            for commenter, created_at in zip(self.rng.sample(others, k), times):
                Comment.objects.create(post=post, user=commenter, content=self.comment_text(post),
                                       created_at=created_at)
                self.stamp_last_notification(created_at)
                count += 1
        return count

    # ------------------------------------------------------------------ likes

    def create_likes(self, posts, users):
        ranges = {"recipe": (2, 9), "tried": (1, 6), "tip": (0, 5), "question": (0, 3)}
        count = 0
        for post in posts:
            others = [u for u in users if u != post.user]
            likers = self.rng.sample(others, self.rng.randint(*ranges[post.demo["kind"]]))
            for liker in likers:
                liked_at = self.random_time(post.created_at)
                Likes.objects.create(user=liker, post=post, created_at=liked_at)
                self.stamp_last_notification(liked_at)
            Post.objects.filter(pk=post.pk).update(likes=len(likers))  # keep the counter in sync
            count += len(likers)
        return count

    # --------------------------------------------------------------- messages

    def create_messages(self, users):
        pairs = set()
        while len(pairs) < 10:
            a, b = self.rng.sample(users, 2)
            pairs.add((a, b))
        pairs = list(pairs)

        admin = User.objects.filter(is_superuser=True).order_by("id").first()
        if admin:
            pairs += [(u, admin) for u in self.rng.sample(users, 2)]

        count = 0
        for a, b in pairs:
            script = self.rng.choice(CONVERSATIONS)
            dish = self.rng.choice(DISHES[b.demo["cuisine"]] if hasattr(b, "demo") else DISHES["italian"])[0]
            when = self.random_time(self.now - timedelta(days=10))
            for i, line in enumerate(script):
                sender, recipient = (a, b) if i % 2 == 0 else (b, a)
                Message.send_message(sender, recipient, line.format(a=a.first_name, b=b.first_name or b.username,
                                                                    dish=dish))
                is_read = when < self.now - timedelta(days=1) or i < len(script) - 1
                for msg in Message.objects.order_by("-id")[:2]:
                    Message.objects.filter(pk=msg.pk).update(date=when, is_read=msg.is_read or is_read)
                when = min(self.now, when + timedelta(minutes=self.rng.randint(2, 360)))
                count += 1
        return count
