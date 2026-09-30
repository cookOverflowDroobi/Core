import json
import re

from django.conf import settings
from django.contrib.auth import password_validation
from django.core.validators import validate_email
from rest_framework import serializers

from Account.models import User
from communications.models import Message
from notifications.models import Notification
from Timeline.models import Comment, Post

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_VIDEO_BYTES = 50 * 1024 * 1024
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,30}$")


def media_url(field):
    try:
        return field.url if field else None
    except ValueError:
        return None


def validate_upload(upload, kind):
    limit = MAX_IMAGE_BYTES if kind == "image" else MAX_VIDEO_BYTES
    if not (upload.content_type or "").startswith(f"{kind}/"):
        raise serializers.ValidationError(f"{upload.name} is not a valid {kind} file.")
    if upload.size > limit:
        raise serializers.ValidationError(f"{upload.name} is larger than {limit // (1024 * 1024)} MB.")
    return upload


class FlexibleListField(serializers.ListField):
    """Accepts a real list, a JSON-encoded list, or newline-separated text (handy for multipart forms)."""

    def __init__(self, *args, separator=r"\n", **kwargs):
        self.separator = separator
        super().__init__(*args, child=serializers.CharField(max_length=200, allow_blank=False), **kwargs)

    def get_value(self, dictionary):
        if hasattr(dictionary, "getlist") and self.field_name in dictionary:
            values = dictionary.getlist(self.field_name)
            return values if len(values) > 1 else values[0]
        return super().get_value(dictionary)

    def to_internal_value(self, data):
        if isinstance(data, str):
            text = data.strip()
            if text.startswith("["):
                try:
                    data = json.loads(text)
                except json.JSONDecodeError as exc:
                    raise serializers.ValidationError("Invalid JSON list.") from exc
            else:
                data = re.split(self.separator, text) if text else []
        data = [str(item).strip() for item in data if str(item).strip()]
        return super().to_internal_value(data)


# ---------------------------------------------------------------- users


class UserMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "avatar", "is_bot"]

    def get_full_name(self, user):
        return user.get_full_name() or user.username

    def get_avatar(self, user):
        profile = getattr(user, "profile", None)
        return media_url(profile.profile_image) if profile else None


class UserCardSerializer(UserMiniSerializer):
    """A user in lists (search, followers, suggestions)."""

    about = serializers.CharField(source="profile.about", default="")
    followers_count = serializers.IntegerField(default=0)
    is_following = serializers.BooleanField(default=False)
    reason = serializers.CharField(default=None)

    class Meta(UserMiniSerializer.Meta):
        fields = UserMiniSerializer.Meta.fields + ["about", "followers_count", "is_following", "reason"]


class ProfileSerializer(UserMiniSerializer):
    cover = serializers.SerializerMethodField()
    about = serializers.CharField(source="profile.about", default="")
    city = serializers.CharField(source="profile.city", default="")
    country = serializers.CharField(source="profile.country", default="")
    gender = serializers.CharField(source="profile.gender", default="")
    phone = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    followers_count = serializers.IntegerField(default=0)
    following_count = serializers.IntegerField(default=0)
    posts_count = serializers.IntegerField(default=0)
    is_following = serializers.BooleanField(default=False)
    follows_you = serializers.BooleanField(default=False)
    is_me = serializers.SerializerMethodField()

    class Meta(UserMiniSerializer.Meta):
        fields = UserMiniSerializer.Meta.fields + [
            "first_name", "last_name", "cover", "about", "city", "country", "gender", "phone", "email",
            "date_joined", "followers_count", "following_count", "posts_count", "is_following",
            "follows_you", "is_me", "is_staff",
        ]

    def _is_me(self, user):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and request.user.pk == user.pk)

    def get_is_me(self, user):
        return self._is_me(user)

    def get_cover(self, user):
        profile = getattr(user, "profile", None)
        return media_url(profile.cover_image) if profile else None

    def get_phone(self, user):
        return user.profile.phone if self._is_me(user) and hasattr(user, "profile") else None

    def get_email(self, user):
        return user.email if self._is_me(user) else None


class ProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    about = serializers.CharField(max_length=500, required=False, allow_blank=True)
    city = serializers.CharField(max_length=20, required=False, allow_blank=True)
    country = serializers.CharField(max_length=20, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=["male", "female", "other"], required=False)
    avatar = serializers.ImageField(required=False)
    cover = serializers.ImageField(required=False)

    def validate_avatar(self, upload):
        return validate_upload(upload, "image")

    def validate_cover(self, upload):
        return validate_upload(upload, "image")

    def save(self, user):
        data = self.validated_data
        for field in ("first_name", "last_name"):
            if field in data:
                setattr(user, field, data[field])
        user.save()
        profile = user.profile
        for field in ("about", "city", "country", "phone", "gender"):
            if field in data:
                setattr(profile, field, data[field])
        if "avatar" in data:
            profile.profile_image = data["avatar"]
        if "cover" in data:
            profile.cover_image = data["cover"]
        profile.save()
        return user


# ----------------------------------------------------------------- auth


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=30)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, max_length=128)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_username(self, value):
        if not USERNAME_RE.match(value):
            raise serializers.ValidationError("Use 3-30 letters, numbers, dots or underscores.")
        reserved = value.lower() == settings.AI_ASSISTANT_USERNAME.lower()  # Sous-chef's account
        if reserved or User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("That username is taken.")
        return value

    def validate_email(self, value):
        validate_email(value)
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate(self, attrs):
        candidate = User(username=attrs["username"], email=attrs["email"],
                         first_name=attrs.get("first_name", ""), last_name=attrs.get("last_name", ""))
        try:
            password_validation.validate_password(attrs["password"], candidate)
        except Exception as exc:  # django.core.exceptions.ValidationError
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(help_text="Username or email")
    password = serializers.CharField(write_only=True)


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)


# ---------------------------------------------------------------- posts


class PostSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(source="user", read_only=True)
    tags = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    videos = serializers.SerializerMethodField()
    likes_count = serializers.IntegerField(read_only=True, default=0)
    comments_count = serializers.IntegerField(read_only=True, default=0)
    liked = serializers.BooleanField(read_only=True, default=False)
    saved = serializers.BooleanField(read_only=True, default=False)
    is_recipe = serializers.BooleanField(read_only=True)
    is_owner = serializers.SerializerMethodField()
    reason = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id", "author", "body", "title", "cuisine", "difficulty", "cook_time", "servings",
            "ingredients", "steps", "is_recipe", "tags", "images", "videos", "created_at", "updated_at",
            "likes_count", "comments_count", "liked", "saved", "is_owner", "reason",
        ]

    def get_tags(self, post):
        return sorted({tag.title for tag in post.tags.all()})

    def get_images(self, post):
        return [{"id": img.pk, "url": media_url(img.image)} for img in post.image.all() if media_url(img.image)]

    def get_videos(self, post):
        return [{"id": vid.pk, "url": media_url(vid.video)} for vid in post.video.all() if media_url(vid.video)]

    def get_is_owner(self, post):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and request.user.pk == post.user_id)

    def get_reason(self, post):
        return getattr(post, "reason", None)


class PostWriteSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=5000, required=False, allow_blank=True)
    title = serializers.CharField(max_length=120, required=False, allow_blank=True)
    cuisine = serializers.CharField(max_length=40, required=False, allow_blank=True)
    difficulty = serializers.ChoiceField(choices=["", "easy", "medium", "hard"], required=False)
    cook_time = serializers.IntegerField(min_value=1, max_value=24 * 60, required=False, allow_null=True)
    servings = serializers.IntegerField(min_value=1, max_value=100, required=False, allow_null=True)
    ingredients = FlexibleListField(required=False, max_length=60)
    steps = FlexibleListField(required=False, max_length=40)
    tags = FlexibleListField(required=False, max_length=10, separator=r"[\s,#]+")

    def to_internal_value(self, data):
        # Blank numbers from HTML forms mean "not set".
        if hasattr(data, "copy"):
            data = data.copy()
        for field in ("cook_time", "servings"):
            if field in data and data[field] in ("", "null"):
                data[field] = None
        return super().to_internal_value(data)

    def validate_tags(self, tags):
        cleaned = []
        for tag in tags:
            tag = re.sub(r"[^a-z0-9_]", "", tag.lower().lstrip("#"))[:75]
            if tag and tag not in cleaned:
                cleaned.append(tag)
        return cleaned

    def validate_cuisine(self, value):
        return value.strip().lower()

    def validate(self, attrs):
        partial = self.partial
        body = attrs.get("body", "").strip()
        title = attrs.get("title", "").strip()
        files = self.context.get("files", {})
        if not partial and not (body or title or files.get("images") or files.get("videos")):
            raise serializers.ValidationError("Write something, add a recipe or attach a photo.")
        if attrs.get("steps") and not attrs.get("ingredients") and not partial:
            raise serializers.ValidationError({"ingredients": "A recipe with steps needs ingredients."})
        return attrs


class CommentSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(source="user", read_only=True)
    is_owner = serializers.SerializerMethodField()
    content = serializers.CharField(max_length=1000, trim_whitespace=True)

    class Meta:
        model = Comment
        fields = ["id", "author", "content", "created_at", "is_owner"]
        read_only_fields = ["created_at"]

    def get_is_owner(self, comment):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and request.user.pk == comment.user_id)


# ------------------------------------------------------ notifications / messages


class NotificationSerializer(serializers.ModelSerializer):
    TYPES = {1: "like", 2: "comment", 3: "follow"}

    type = serializers.SerializerMethodField()
    actor = UserMiniSerializer(source="sender", read_only=True)
    post = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(source="date")

    class Meta:
        model = Notification
        fields = ["id", "type", "actor", "post", "created_at", "is_seen"]

    def get_type(self, note):
        return self.TYPES.get(note.notification_type, "other")

    def get_post(self, note):
        post = note.post
        if not post:
            return None
        image = next(iter(post.image.all()), None)
        return {
            "id": post.pk,
            "title": post.title or (post.body.splitlines()[0][:80] if post.body else ""),
            "thumbnail": media_url(image.image) if image else None,
        }


class MessageSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(source="date")
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "body", "created_at", "is_mine", "is_read"]

    def get_is_mine(self, message):
        return message.sender_id == message.user_id


class SendMessageSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=1000, trim_whitespace=True)
