"""AI endpoints: whether AI is on, post drafts, reply drafts and Sous-chef's answers. The agents are in assistant.py."""
import json
import logging

from django.conf import settings
from django.core.cache import cache
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Account.models import User
from communications.models import Message

from .. import assistant, llm, scan
from ..serializers import MAX_IMAGE_BYTES, MessageSerializer, UserMiniSerializer

logger = logging.getLogger(__name__)

MAX_IMAGES = 4
MAX_FRAMES = 6
# Browser upload type -> the type Gemini expects.
VIDEO_TYPES = {"video/mp4": "video/mp4", "video/webm": "video/webm", "video/quicktime": "video/mov",
               "video/mpeg": "video/mpeg", "video/3gpp": "video/3gpp"}


def disabled():
    return Response({"detail": "AI isn't set up on this server.", "code": "ai_disabled"},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE)


def failed(what, error):
    logger.warning("AI %s failed: %s", what, error)
    return Response({"detail": "The AI couldn't answer right now. Try again in a moment.", "code": "ai_failed"},
                    status=status.HTTP_502_BAD_GATEWAY)


class AIStatusView(APIView):
    """`GET /ai/`: whether AI is on here, what the model can read, and Sous-chef's account."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        model = llm.client()
        chef = assistant.bot() if model else None
        return Response({
            "enabled": model is not None,
            "provider": model.name if model else None,
            "model": model.model if model else None,
            "video": bool(model and model.video),
            "max_images": MAX_IMAGES,
            "max_frames": MAX_FRAMES,
            "max_video_mb": settings.AI_MAX_VIDEO_MB,
            "assistant": UserMiniSerializer(chef, context={"request": request}).data if chef else None,
        })


class AIView(APIView):
    """Each request is one or more model calls, counted against the `ai` rate limit."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "ai"


def _photos(uploads):
    """Uploaded photos -> small JPEG bytes (see scan.prepare), or ValueError saying what's wrong."""
    photos = []
    for upload in uploads:
        if upload.content_type not in scan.IMAGE_TYPES:
            raise ValueError(f"{upload.name} isn't a JPEG, PNG or WebP photo.")
        if upload.size > MAX_IMAGE_BYTES:
            raise ValueError(f"{upload.name} is larger than {MAX_IMAGE_BYTES // (1024 * 1024)} MB.")
        photos.append(scan.prepare(upload))
    return photos


def _current_draft(value):
    """The composer's current draft (a JSON object) with only the fields the model needs."""
    try:
        value = json.loads(value) if isinstance(value, str) else value
    except ValueError:
        return None
    if not isinstance(value, dict):
        return None
    return {key: value[key] for key in assistant.DRAFT_FIELDS if value.get(key)} or None


class PostDraftView(AIView):
    """`POST /ai/post-draft/` (multipart): the cook's `prompt`, up to 4 `images`, and a `video` (when the model can
    watch one) or up to 6 `frames` from it. `mode` and `current` describe the composer. Returns a draft to review;
    nothing is posted."""

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        model = llm.client()
        if model is None:
            return disabled()
        prompt = str(request.data.get("prompt", "")).strip()[:2000]
        uploads = {field: request.FILES.getlist(field) for field in ("images", "frames", "video")}
        for field, most in (("images", MAX_IMAGES), ("frames", MAX_FRAMES), ("video", 1)):
            if len(uploads[field]) > most:
                return Response({field: [f"Add up to {most} {'videos' if field == 'video' else 'photos'}."]},
                                status=400)
        photos = {}
        for field in ("images", "frames"):
            try:
                photos[field] = _photos(uploads[field])
            except ValueError as error:
                return Response({field: [str(error)]}, status=400)
        video = None
        if uploads["video"]:
            upload = uploads["video"][0]
            if not model.video:
                return Response({"video": ["This AI model can't watch videos. Send frames from it instead."]},
                                status=400)
            if upload.content_type not in VIDEO_TYPES:
                return Response({"video": [f"{upload.name} isn't an MP4, WebM or MOV video."]}, status=400)
            if upload.size > settings.AI_MAX_VIDEO_MB * 1024 * 1024:
                return Response({"video": [f"{upload.name} is larger than {settings.AI_MAX_VIDEO_MB} MB."]},
                                status=400)
            video = llm.Media(VIDEO_TYPES[upload.content_type], upload.read())
        if not (prompt or photos["images"] or photos["frames"] or video):
            return Response({"prompt": ["Describe your dish, or add a photo or a video."]}, status=400)
        mode = request.data.get("mode") if request.data.get("mode") in ("post", "recipe") else ""
        try:
            draft = assistant.draft_post(model, prompt, photos["images"], photos["frames"], video, mode,
                                         _current_draft(request.data.get("current")))
        except llm.LLMError as error:
            return failed("post draft", error)
        return Response({"draft": draft})


class ReplyDraftView(AIView):
    """`POST /conversations/<username>/draft/`: a draft of your next message to this person, optionally from your
    own rough `hint`. Nothing is sent."""

    def post(self, request, username):
        model = llm.client()
        if model is None:
            return disabled()
        partner = get_object_or_404(User, username__iexact=username)
        if partner.pk == request.user.pk or partner.is_bot:
            return Response({"detail": "Reply drafts are for chats with people."}, status=400)
        hint = str(request.data.get("hint", "")).strip()[:1000]
        try:
            draft = assistant.draft_reply(model, request.user, partner, hint)
        except llm.LLMError as error:
            return failed("reply draft", error)
        return Response({"draft": draft})


class SousChefReplyView(AIView):
    """`POST /conversations/<username>/reply/`: Sous-chef answers your latest messages and returns its message,
    or null when it has already answered them. Only in a chat with Sous-chef."""

    def post(self, request, username):
        model = llm.client()
        if model is None:
            return disabled()
        chef = assistant.bot()
        if chef is None or chef.username.lower() != username.lower():
            return Response({"detail": "Only Sous-chef answers by itself."}, status=404)
        lock = f"sous-chef-answering:{request.user.pk}"
        if not cache.add(lock, True, timeout=settings.AI_TIMEOUT * assistant.MAX_STEPS):
            return Response({"detail": "Sous-chef is still answering.", "code": "ai_busy"}, status=409)
        try:
            text = assistant.sous_chef_reply(model, request.user, chef)
        except llm.LLMError as error:
            return failed("Sous-chef reply", error)
        finally:
            cache.delete(lock)
        if text is None:
            return Response({"message": None})
        Message.send_message(chef, request.user, text)
        answer = Message.objects.filter(user=request.user, sender=chef).latest("date", "pk")  # the user's copy
        return Response({"message": MessageSerializer(answer).data}, status=201)
