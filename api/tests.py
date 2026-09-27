import io
import re
import shutil
import tempfile

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from Account.models import User
from communications.models import Message
from notifications.models import Notification
from Timeline.models import Likes, Post

from .ingredients import matches, normalize, rank_recipes

PASSWORD = "Sup3r-secret-pw"


def png(name="photo.png"):
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), (200, 80, 40)).save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


def make_user(username, **extra):
    return User.objects.create_user(username=username, email=f"{username}@example.com", password=PASSWORD,
                                    is_email_verified=True, **extra)


class ApiTestCase(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Keep uploads made by tests out of the real media folder.
        cls._media = tempfile.mkdtemp(prefix="cookoverflow-test-media-")
        cls._media_override = override_settings(MEDIA_ROOT=cls._media)
        cls._media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._media_override.disable()
        shutil.rmtree(cls._media, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.alice = make_user("alice", first_name="Alice")
        self.bob = make_user("bob", first_name="Bob")
        self.carol = make_user("carol", first_name="Carol")

    def as_user(self, user):
        self.client.force_login(user)
        return self.client

    def recipe(self, user, title, ingredients, **extra):
        return Post.objects.create(user=user, body=f"My {title}", title=title, ingredients=ingredients,
                                   steps=["Cook it."], **extra)


class IngredientMatchingTests(ApiTestCase):
    def test_normalize_handles_plurals_case_and_spacing(self):
        self.assertEqual(normalize(" Tomatoes "), "tomato")
        self.assertEqual(normalize("Chickpeas"), "chickpea")
        self.assertEqual(normalize("Akkawi  Cheese"), "akkawi cheese")
        self.assertEqual(normalize("hummus"), "hummus")

    def test_matching_is_word_aware(self):
        self.assertTrue(matches("cheese", "akkawi cheese"))
        self.assertTrue(matches("cheddar cheese", "cheddar"))
        self.assertFalse(matches("rice", "licorice"))

    def test_rank_prefers_best_coverage_and_lists_missing(self):
        full = self.recipe(self.alice, "Egg fried rice", ["rice", "eggs", "salt"])
        partial = self.recipe(self.alice, "Chicken rice", ["rice", "chicken", "onion", "garlic"])
        self.recipe(self.alice, "Pancakes", ["flour", "milk"])
        ranked = rank_recipes(["Rice", "egg"], Post.objects.all())
        self.assertEqual([r["post"] for r in ranked], [full, partial])
        self.assertEqual(ranked[0]["score"], 1.0)  # salt counts as a pantry staple
        self.assertEqual(ranked[1]["missing"], ["chicken", "onion", "garlic"])

    def test_staples_can_be_excluded(self):
        self.recipe(self.alice, "Egg fried rice", ["rice", "eggs", "salt"])
        ranked = rank_recipes(["rice", "eggs"], Post.objects.all(), assume_staples=False)
        self.assertEqual(ranked[0]["missing"], ["salt"])


class AuthTests(ApiTestCase):
    def test_me_is_null_when_signed_out_and_sets_csrf_cookie(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"user": None})
        self.assertIn("csrftoken", response.cookies)

    @override_settings(EMAIL_VERIFICATION_REQUIRED=False)
    def test_register_signs_in_immediately_without_verification(self):
        response = self.client.post("/api/auth/register/", {
            "username": "dana", "email": "Dana@Example.com", "password": PASSWORD, "first_name": "Dana"})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertFalse(response.json()["verification_required"])
        self.assertEqual(self.client.get("/api/auth/me/").json()["user"]["username"], "dana")
        self.assertEqual(User.objects.get(username="dana").email, "dana@example.com")

    def test_register_validates_username_email_and_password(self):
        response = self.client.post("/api/auth/register/", {
            "username": "Alice", "email": "alice@example.com", "password": "123"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.json()), {"username", "email"})
        response = self.client.post("/api/auth/register/", {
            "username": "newcook", "email": "new@example.com", "password": "password"})
        self.assertIn("password", response.json())

    @override_settings(EMAIL_VERIFICATION_REQUIRED=True)
    def test_verification_flow(self):
        response = self.client.post("/api/auth/register/", {
            "username": "erin", "email": "erin@example.com", "password": PASSWORD})
        self.assertTrue(response.json()["verification_required"])
        login = self.client.post("/api/auth/login/", {"username": "erin", "password": PASSWORD})
        self.assertEqual(login.status_code, 403)
        self.assertEqual(login.json()["code"], "email_not_verified")

        link = re.search(r"http://testserver(/api/auth/activate/\S+)", mail.outbox[-1].body).group(1)
        self.assertRedirects(self.client.get(link), "/login?verified=1", fetch_redirect_response=False)
        login = self.client.post("/api/auth/login/", {"username": "erin@example.com", "password": PASSWORD})
        self.assertEqual(login.status_code, 200)

    def test_login_with_email_and_logout(self):
        response = self.client.post("/api/auth/login/", {"username": "ALICE@example.com", "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "alice")
        self.client.post("/api/auth/logout/")
        self.assertIsNone(self.client.get("/api/auth/me/").json()["user"])

    def test_wrong_password(self):
        response = self.client.post("/api/auth/login/", {"username": "alice", "password": "nope"})
        self.assertEqual(response.status_code, 400)

    def test_csrf_is_enforced_for_signed_in_users(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.alice)
        self.assertEqual(client.post("/api/posts/", {"body": "hi"}).status_code, 403)
        token = client.get("/api/auth/csrf/").json()["csrfToken"]
        response = client.post("/api/posts/", {"body": "hi"}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 201)

    def test_password_reset_confirm_and_change(self):
        response = self.client.post("/api/auth/password-reset/", {"email": "alice@example.com"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(self.client.post("/api/auth/password-reset/", {"email": "nobody@example.com"}).status_code,
                         200)

        uid = urlsafe_base64_encode(force_bytes(self.alice.pk))
        token = default_token_generator.make_token(self.alice)
        response = self.client.post("/api/auth/password-reset/confirm/",
                                    {"uid": uid, "token": token, "password": "An0ther-long-pw"})
        self.assertEqual(response.status_code, 200)
        self.alice.refresh_from_db()
        self.assertTrue(self.alice.check_password("An0ther-long-pw"))

        self.as_user(self.alice)
        bad = self.client.post("/api/auth/password-change/",
                               {"current_password": "wrong", "new_password": "Yet-an0ther-pw"})
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post("/api/auth/password-change/",
                              {"current_password": "An0ther-long-pw", "new_password": "Yet-an0ther-pw"})
        self.assertEqual(ok.status_code, 200)

    def test_endpoints_require_sign_in(self):
        self.assertEqual(self.client.get("/api/posts/feed/").status_code, 403)
        self.assertEqual(self.client.get("/api/stats/").status_code, 200)


class PostTests(ApiTestCase):
    def test_create_quick_post(self):
        response = self.as_user(self.alice).post("/api/posts/", {"body": "Hello kitchen", "tags": "#Dinner, quick"},
                                                 format="json")
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data["tags"], ["dinner", "quick"])
        self.assertFalse(data["is_recipe"])
        self.assertTrue(data["is_owner"])

    def test_create_recipe_with_photo_multipart(self):
        response = self.as_user(self.alice).post("/api/posts/", {
            "title": "Shakshuka", "body": "Weekend brunch", "cuisine": "Levantine", "difficulty": "easy",
            "cook_time": "25", "servings": "", "ingredients": "eggs\ntomato\n\npepper",
            "steps": '["Cook sauce", "Crack eggs"]', "tags": "brunch", "images": png(),
        }, format="multipart")
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertTrue(data["is_recipe"])
        self.assertEqual(data["ingredients"], ["eggs", "tomato", "pepper"])
        self.assertEqual(data["steps"], ["Cook sauce", "Crack eggs"])
        self.assertEqual(data["cuisine"], "levantine")
        self.assertIsNone(data["servings"])
        self.assertEqual(len(data["images"]), 1)
        self.assertTrue(data["images"][0]["url"].startswith("/media/images/"))

    def test_rejects_empty_posts_and_bad_uploads(self):
        client = self.as_user(self.alice)
        self.assertEqual(client.post("/api/posts/", {"body": "  "}, format="json").status_code, 400)
        fake = SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain")
        response = client.post("/api/posts/", {"body": "x", "images": fake}, format="multipart")
        self.assertEqual(response.status_code, 400)

    def test_feed_shows_own_and_followed_posts_only(self):
        Post.objects.create(user=self.alice, body="mine")
        Post.objects.create(user=self.bob, body="followed")
        Post.objects.create(user=self.carol, body="stranger")
        client = self.as_user(self.alice)
        client.post("/api/users/bob/follow/")
        bodies = [p["body"] for p in client.get("/api/posts/feed/").json()["results"]]
        self.assertEqual(sorted(bodies), ["followed", "mine"])
        explore = client.get("/api/posts/").json()
        self.assertEqual(explore["count"], 3)

    def test_filters_and_pagination(self):
        for i in range(12):
            Post.objects.create(user=self.bob, body=f"post {i}")
        self.recipe(self.bob, "Soup", ["water", "lentils"], cuisine="turkish")
        client = self.as_user(self.alice)
        first = client.get("/api/posts/").json()
        self.assertEqual((len(first["results"]), first["next_page"]), (10, 2))
        self.assertEqual(client.get("/api/posts/?recipes=1").json()["count"], 1)
        self.assertEqual(client.get("/api/posts/?q=turkish").json()["count"], 1)
        self.assertEqual(client.get("/api/posts/?author=BOB").json()["count"], 13)

    def test_only_owner_can_edit_or_delete(self):
        post = Post.objects.create(user=self.alice, body="original")
        other = self.as_user(self.bob)
        self.assertEqual(other.patch(f"/api/posts/{post.pk}/", {"body": "hacked"}, format="json").status_code, 403)
        self.assertEqual(other.delete(f"/api/posts/{post.pk}/").status_code, 403)

        owner = self.as_user(self.alice)
        response = owner.patch(f"/api/posts/{post.pk}/", {"body": "edited", "tags": "fresh"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.json()["body"], response.json()["tags"]), ("edited", ["fresh"]))
        self.assertIsNotNone(response.json()["updated_at"])
        self.assertEqual(owner.delete(f"/api/posts/{post.pk}/").status_code, 204)
        self.assertFalse(Post.objects.filter(pk=post.pk).exists())

    def test_like_is_idempotent_and_notifies_author(self):
        post = Post.objects.create(user=self.alice, body="like me")
        client = self.as_user(self.bob)
        client.post(f"/api/posts/{post.pk}/like/")
        response = client.post(f"/api/posts/{post.pk}/like/")
        self.assertEqual(response.json(), {"liked": True, "saved": False, "likes_count": 1})
        self.assertEqual(Post.objects.get(pk=post.pk).likes, 1)  # legacy counter stays in sync
        self.assertTrue(Notification.objects.filter(user=self.alice, sender=self.bob, notification_type=1).exists())

        response = client.delete(f"/api/posts/{post.pk}/like/")
        self.assertEqual(response.json()["likes_count"], 0)
        self.assertEqual(Post.objects.get(pk=post.pk).likes, 0)
        self.assertFalse(Notification.objects.filter(user=self.alice, notification_type=1).exists())

    def test_save_and_saved_list(self):
        post = Post.objects.create(user=self.alice, body="bookmark me")
        client = self.as_user(self.bob)
        self.assertTrue(client.post(f"/api/posts/{post.pk}/save/").json()["saved"])
        self.assertEqual([p["id"] for p in client.get("/api/posts/saved/").json()["results"]], [post.pk])
        client.delete(f"/api/posts/{post.pk}/save/")
        self.assertEqual(client.get("/api/posts/saved/").json()["count"], 0)

    def test_comments(self):
        post = Post.objects.create(user=self.alice, body="comment here")
        bob = self.as_user(self.bob)
        created = bob.post(f"/api/posts/{post.pk}/comments/", {"content": " Yum! "}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["content"], "Yum!")
        self.assertTrue(Notification.objects.filter(user=self.alice, notification_type=2).exists())
        self.assertEqual(len(bob.get(f"/api/posts/{post.pk}/comments/").json()), 1)

        comment_id = created.json()["id"]
        self.assertEqual(self.as_user(self.carol).delete(f"/api/comments/{comment_id}/").status_code, 403)
        self.assertEqual(self.as_user(self.alice).delete(f"/api/comments/{comment_id}/").status_code, 204)

    def test_trending_and_for_you(self):
        italian = self.recipe(self.bob, "Carbonara", ["pasta", "eggs"], cuisine="italian")
        self.recipe(self.carol, "Lasagna", ["pasta", "cheese"], cuisine="italian")
        Post.objects.create(user=self.carol, body="random")
        Likes.objects.create(user=self.alice, post=italian)
        client = self.as_user(self.alice)
        self.assertEqual(client.get("/api/posts/trending/").status_code, 200)
        results = client.get("/api/posts/for-you/").json()["results"]
        self.assertEqual(results[0]["title"], "Lasagna")
        self.assertIn("talian", results[0]["reason"])
        self.assertNotIn(italian.pk, [p["id"] for p in results])  # already liked


class SocialTests(ApiTestCase):
    def test_follow_unfollow_and_lists(self):
        client = self.as_user(self.alice)
        self.assertEqual(client.post("/api/users/alice/follow/").status_code, 400)
        response = client.post("/api/users/bob/follow/")
        self.assertEqual(response.json(), {"is_following": True, "followers_count": 1})
        client.post("/api/users/bob/follow/")  # no duplicate
        self.assertTrue(Notification.objects.filter(user=self.bob, sender=self.alice, notification_type=3).exists())

        profile = client.get("/api/users/bob/").json()
        self.assertEqual((profile["followers_count"], profile["is_following"], profile["is_me"]), (1, True, False))
        self.assertIsNone(profile["email"])
        self.assertEqual([u["username"] for u in client.get("/api/users/bob/followers/").json()["results"]],
                         ["alice"])
        self.assertEqual([u["username"] for u in client.get("/api/users/alice/following/").json()["results"]],
                         ["bob"])
        self.assertFalse(client.delete("/api/users/bob/follow/").json()["is_following"])
        self.assertFalse(Notification.objects.filter(user=self.bob, sender=self.alice, notification_type=3).exists())

    def test_suggestions_exclude_self_and_followed(self):
        client = self.as_user(self.alice)
        client.post("/api/users/bob/follow/")
        self.as_user(self.bob).post("/api/users/carol/follow/")
        suggestions = self.as_user(self.alice).get("/api/users/suggestions/").json()
        self.assertEqual([u["username"] for u in suggestions], ["carol"])
        self.assertEqual(suggestions[0]["reason"], "Followed by @bob")

    def test_update_profile_with_avatar(self):
        response = self.as_user(self.alice).patch("/api/users/me/", {
            "first_name": "Ali", "about": "I cook", "city": "Haifa", "avatar": png("me.png")}, format="multipart")
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertEqual((data["first_name"], data["about"], data["city"]), ("Ali", "I cook", "Haifa"))
        self.assertIn("/media/avatars/", data["avatar"])
        self.assertEqual(data["email"], "alice@example.com")

    def test_messages(self):
        bob = self.as_user(self.bob)
        self.assertEqual(bob.post("/api/conversations/bob/", {"body": "me?"}).status_code, 400)
        sent = bob.post("/api/conversations/alice/", {"body": "Hi Alice!"}, format="json")
        self.assertEqual(sent.status_code, 201)
        self.assertTrue(sent.json()["is_mine"])

        alice = self.as_user(self.alice)
        self.assertEqual(alice.get("/api/badges/").json()["messages"], 1)
        conversations = alice.get("/api/conversations/").json()
        self.assertEqual((conversations[0]["user"]["username"], conversations[0]["unread"]), ("bob", 1))
        thread = alice.get("/api/conversations/bob/").json()
        self.assertEqual([(m["body"], m["is_mine"]) for m in thread["messages"]], [("Hi Alice!", False)])
        self.assertEqual(alice.get("/api/badges/").json()["messages"], 0)
        self.assertEqual(Message.objects.count(), 2)  # one copy per participant

    def test_notifications_hide_own_activity_and_mark_read(self):
        post = Post.objects.create(user=self.alice, body="mine")
        alice = self.as_user(self.alice)
        alice.post(f"/api/posts/{post.pk}/comments/", {"content": "self note"}, format="json")
        self.as_user(self.bob).post(f"/api/posts/{post.pk}/like/")
        alice = self.as_user(self.alice)
        notes = alice.get("/api/notifications/").json()["results"]
        self.assertEqual([(n["type"], n["actor"]["username"]) for n in notes], [("like", "bob")])
        self.assertEqual(alice.get("/api/badges/").json()["notifications"], 1)
        alice.post("/api/notifications/read/", {}, format="json")
        self.assertEqual(alice.get("/api/badges/").json()["notifications"], 0)


class DiscoverTests(ApiTestCase):
    def test_cook_endpoint(self):
        self.recipe(self.bob, "Omelette", ["eggs", "butter", "salt"])
        self.recipe(self.bob, "Pasta", ["pasta", "tomato"])
        data = self.as_user(self.alice).get("/api/cook/?ingredients=Eggs,butter").json()
        self.assertEqual(data["count"], 1)
        result = data["results"][0]
        self.assertEqual((result["post"]["title"], result["score"], result["missing"]), ("Omelette", 1.0, []))
        self.assertEqual(self.client.get("/api/cook/").json()["results"], [])

    def test_ingredient_autocomplete_and_tags(self):
        post = self.recipe(self.bob, "Tomato soup", ["tomatoes", "onion"])
        self.recipe(self.bob, "Salad", ["tomato", "cucumber"])
        client = self.as_user(self.alice)
        client.patch(f"/api/posts/{post.pk}/", {"tags": "soup"}, format="json")  # only bob may edit
        suggestions = client.get("/api/ingredients/?q=tom").json()
        self.assertEqual(suggestions[0], {"name": "tomato", "count": 2})

        self.as_user(self.bob).patch(f"/api/posts/{post.pk}/", {"tags": "soup, winter"}, format="json")
        tags = self.as_user(self.alice).get("/api/tags/").json()
        self.assertEqual({t["name"] for t in tags}, {"soup", "winter"})

    def test_search(self):
        self.recipe(self.bob, "Pasta al pomodoro", ["pasta"])
        data = self.as_user(self.alice).get("/api/search/?q=pas").json()
        self.assertEqual([p["title"] for p in data["posts"]], ["Pasta al pomodoro"])
        self.assertEqual(self.client.get("/api/search/?q=bo").json()["users"][0]["username"], "bob")

    def test_stats_and_health(self):
        self.recipe(self.bob, "Soup", ["water"], cuisine="french")
        self.assertEqual(self.client.get("/api/stats/").json(),
                         {"cooks": 3, "recipes": 1, "posts": 1, "cuisines": 1})
        self.assertEqual(self.client.get("/api/health/").json(), {"status": "ok"})


class SiteRoutingTests(ApiTestCase):
    def test_react_routes_and_legacy_pages(self):
        spa = self.client.get("/u/alice")
        self.assertIn(spa.status_code, (200, 503))  # 503 until the React app is built
        self.assertEqual(self.client.get("/legacy/Login/").status_code, 200)
        self.assertEqual(self.client.get("/api/docs/").status_code, 200)
