"""Simulate users browsing a running dev server: log in, read the feed, like, comment, follow, message.

    python manage.py runserver                     # in one terminal
    python manage.py simulate_traffic --sessions 30  # in another
"""
import http.cookiejar
import random
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

from django.core.management.base import BaseCommand, CommandError
from django.urls import reverse

from Account.models import User
from core.management.demo_content import (
    COMMENTS, CONVERSATIONS, DEMO_EMAIL_DOMAIN, DEMO_PASSWORD, SEARCHES,
)
from Profile.models import Profile_profile_followers
from Timeline.models import Likes, Post, Tag


class Browser:
    """A tiny cookie- and CSRF-aware HTTP client."""

    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def csrf_token(self):
        return next((c.value for c in self.jar if c.name == "csrftoken"), "")

    def request(self, method, path, data=None):
        body = None
        if data is not None:
            body = urllib.parse.urlencode({**data, "csrfmiddlewaretoken": self.csrf_token()}).encode()
        req = urllib.request.Request(self.base_url + path, data=body, method=method,
                                     headers={"Referer": self.base_url + "/", "User-Agent": "cookoverflow-traffic"})
        try:
            with self.opener.open(req, timeout=30) as resp:
                resp.read()
                return resp.status, resp.geturl().replace(self.base_url, "")
        except urllib.error.HTTPError as exc:
            return exc.code, path

    def get(self, path):
        return self.request("GET", path)

    def post(self, path, data):
        return self.request("POST", path, data)


class Command(BaseCommand):
    help = "Generate realistic traffic against a running server using the seeded demo accounts."

    def add_arguments(self, parser):
        parser.add_argument("--base-url", default="http://127.0.0.1:8000")
        parser.add_argument("--sessions", type=int, default=25, help="Number of user sessions (default: 25).")
        parser.add_argument("--delay", type=float, default=0.1, help="Seconds between requests (default: 0.1).")
        parser.add_argument("--seed", type=int, default=None, help="Random seed for a repeatable run.")

    def handle(self, *args, base_url, sessions, delay, seed, **options):
        self.rng = random.Random(seed)
        self.delay = delay
        self.users = list(User.objects.filter(email__endswith="@" + DEMO_EMAIL_DOMAIN))
        if not self.users:
            raise CommandError("No demo users found. Run `python manage.py seed_demo_data` first.")
        try:
            Browser(base_url).get("/")
        except urllib.error.URLError as exc:
            raise CommandError(f"Cannot reach {base_url} ({exc.reason}). Is the server running?")

        self.actions = Counter()
        self.statuses = Counter()
        self.failures = []
        actions = [
            (self.view_feed, 5), (self.view_post, 5), (self.view_profile, 4), (self.like_post, 5),
            (self.comment, 3), (self.browse_tags, 2), (self.search, 2), (self.find_friends, 1),
            (self.follow, 1), (self.unfollow, 1), (self.send_message, 2), (self.read_inbox, 2),
            (self.read_notifications, 2),
        ]
        funcs, weights = zip(*actions)

        started = time.monotonic()
        for n in range(1, sessions + 1):
            user = self.rng.choice(self.users)
            browser = Browser(base_url)
            self.hit(browser, "login page", "GET", reverse("Account:Login"))
            self.hit(browser, "login", "POST", reverse("Account:Login"),
                     {"username": user.username, "password": DEMO_PASSWORD})
            for action in self.rng.choices(funcs, weights, k=self.rng.randint(5, 12)):
                action(browser, user)
            self.hit(browser, "logout", "GET", reverse("Account:Logout"))
            self.stdout.write(f"  session {n:>3}/{sessions}  {user.username}")

        self.report(time.monotonic() - started)

    # ---------------------------------------------------------------- helpers

    def hit(self, browser, label, method, path, data=None):
        status, final = browser.request(method, path, data)
        self.actions[label] += 1
        self.statuses[status] += 1
        if status >= 400:
            self.failures.append(f"{status} {method} {path} ({label})")
        time.sleep(self.delay)
        return status

    def random_post(self, exclude_user=None):
        posts = Post.objects.exclude(user=exclude_user) if exclude_user else Post.objects.all()
        return posts.order_by("?").first()

    # ---------------------------------------------------------------- actions

    def view_feed(self, browser, user):
        self.hit(browser, "view feed", "GET", reverse("core:home"))

    def view_post(self, browser, user):
        post = self.random_post()
        self.hit(browser, "view post", "GET", reverse("Timeline:post-preview", args=[post.pk]))

    def view_profile(self, browser, user):
        other = self.rng.choice(self.users)
        self.hit(browser, "view profile", "GET", reverse("profile:user-timeline", args=[other.pk]))

    def like_post(self, browser, user):
        post = Post.objects.exclude(user=user).exclude(post_like__user=user).order_by("?").first()
        if post:
            self.hit(browser, "like", "GET", reverse("Timeline:postlike", args=[post.pk]))

    def comment(self, browser, user):
        post = self.random_post(exclude_user=user)
        self.hit(browser, "comment", "POST", reverse("Timeline:comment-create", args=[post.pk]),
                 {"content": self.rng.choice(COMMENTS)})

    def browse_tags(self, browser, user):
        self.hit(browser, "tags", "GET", reverse("Timeline:tags_preview"))
        title = Tag.objects.order_by("?").values_list("title", flat=True).first()
        self.hit(browser, "tag filter", "GET", reverse("Timeline:tags_preview", args=[title]))

    def search(self, browser, user):
        self.hit(browser, "search", "POST", reverse("Timeline:searchEngine"), {"text": self.rng.choice(SEARCHES)})

    def find_friends(self, browser, user):
        other = self.rng.choice(self.users)
        self.hit(browser, "find friends", "POST", reverse("Timeline:find-friend"),
                 {"friendToSearch": other.username[:4]})

    def follow(self, browser, user):
        followed = Profile_profile_followers.objects.filter(user=user).values_list("profile_id", flat=True)
        candidates = [u for u in self.users if u != user and u.pk not in set(followed)]
        if candidates:
            target = self.rng.choice(candidates)
            self.hit(browser, "follow", "POST", reverse("profile:add-follower", args=[target.pk]), {})

    def unfollow(self, browser, user):
        followed = list(Profile_profile_followers.objects.filter(user=user).values_list("profile_id", flat=True))
        if followed:
            pk = self.rng.choice(followed)
            self.hit(browser, "unfollow", "POST", reverse("profile:remove-follower", args=[pk]), {})

    def send_message(self, browser, user):
        other = self.rng.choice([u for u in self.users if u != user])
        line = self.rng.choice(self.rng.choice(CONVERSATIONS))
        body = line.format(a=user.first_name, b=other.first_name, dish="your last recipe")
        self.hit(browser, "send message", "POST", reverse("communications:send_direct"),
                 {"to_user": other.username, "body": body})

    def read_inbox(self, browser, user):
        self.hit(browser, "inbox", "GET", reverse("communications:inbox"))
        other = self.rng.choice([u for u in self.users if u != user])
        self.hit(browser, "conversation", "GET", reverse("communications:directs", args=[other.username]))

    def read_notifications(self, browser, user):
        self.hit(browser, "notifications", "GET", reverse("notifications:show-notifications"))

    # ----------------------------------------------------------------- report

    def report(self, seconds):
        total = sum(self.actions.values())
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"{total} requests in {seconds:.1f}s"))
        for label, count in self.actions.most_common():
            self.stdout.write(f"  {label:<15} {count}")
        self.stdout.write("Status codes: " + ", ".join(f"{s}: {c}" for s, c in sorted(self.statuses.items())))
        if self.failures:
            self.stdout.write(self.style.ERROR(f"{len(self.failures)} failed requests:"))
            for line in self.failures[:20]:
                self.stdout.write(f"  {line}")
