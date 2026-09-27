from django.db.models import Max
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Account.models import User
from communications.models import Message
from notifications.models import Notification

from ..pagination import PagePagination
from ..serializers import MessageSerializer, NotificationSerializer, SendMessageSerializer, UserMiniSerializer
from ..utils import int_param


def my_notifications(user):
    # Legacy signals also notify you about your own activity on your posts; hide those.
    return Notification.objects.filter(user=user).exclude(sender=user)


class NotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notes = (my_notifications(request.user)
                 .select_related("sender__profile", "post").prefetch_related("post__image").order_by("-date"))
        if request.query_params.get("unread") in ("1", "true"):
            notes = notes.filter(is_seen=False)
        paginator = PagePagination()
        page = paginator.paginate_queryset(notes, request, view=self)
        return paginator.get_paginated_response(
            NotificationSerializer(page, many=True, context={"request": request}).data)


class NotificationsReadView(APIView):
    """Mark notifications as read: all of them, or `{"ids": [...]}`."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        notes = my_notifications(request.user).filter(is_seen=False)
        ids = request.data.get("ids")
        if isinstance(ids, list):
            notes = notes.filter(pk__in=[i for i in ids if str(i).isdigit()])
        return Response({"updated": notes.update(is_seen=True)})


class NotificationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        get_object_or_404(Notification, pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BadgesView(APIView):
    """Unread counts for the navigation badges (polled by the app)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "notifications": my_notifications(request.user).filter(is_seen=False).count(),
            "messages": Message.objects.filter(user=request.user, is_read=False).count(),
        })


class ConversationsView(APIView):
    """Your conversations, most recent first, with the last message and unread count.

    Messages are stored twice (one copy per participant); `user` is the copy's owner and
    `recipient` is always the other person from the owner's point of view.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        me = request.user
        rows = (Message.objects.filter(user=me).values("recipient")
                .annotate(last=Max("date")).order_by("-last")[:50])
        partner_ids = [row["recipient"] for row in rows]
        partners = {u.pk: u for u in User.objects.filter(pk__in=partner_ids).select_related("profile")}
        conversations = []
        for row in rows:
            partner = partners.get(row["recipient"])
            if not partner or partner.pk == me.pk:
                continue
            thread = Message.objects.filter(user=me, recipient=partner)
            last = thread.order_by("-date", "-pk").first()
            conversations.append({
                "user": UserMiniSerializer(partner, context={"request": request}).data,
                "last_message": last.body if last else "",
                "last_is_mine": bool(last and last.sender_id == me.pk),
                "updated_at": row["last"],
                "unread": thread.filter(is_read=False).count(),
            })
        return Response(conversations)


class ConversationView(APIView):
    """Messages with one person (oldest first). GET marks them read, POST sends one."""

    permission_classes = [IsAuthenticated]

    def get(self, request, username):
        partner = get_object_or_404(User.objects.select_related("profile"), username__iexact=username)
        thread = Message.objects.filter(user=request.user, recipient=partner)
        thread.filter(is_read=False).update(is_read=True)
        limit = int_param(request, "limit", 100, 500)
        messages = list(thread.order_by("-date", "-pk")[:limit])[::-1]
        return Response({
            "user": UserMiniSerializer(partner, context={"request": request}).data,
            "messages": MessageSerializer(messages, many=True).data,
        })

    def post(self, request, username):
        partner = get_object_or_404(User, username__iexact=username)
        if partner.pk == request.user.pk:
            return Response({"detail": "You can't message yourself."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = Message.send_message(request.user, partner, serializer.validated_data["body"])
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)
