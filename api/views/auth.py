from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.shortcuts import redirect
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Account.models import User
from Account.utils import generate_token as activation_token

from ..queries import users_for
from ..serializers import (
    LoginSerializer, PasswordChangeSerializer, PasswordResetConfirmSerializer, PasswordResetSerializer,
    ProfileSerializer, RegisterSerializer,
)


def emails_are_delivered():
    return settings.EMAIL_BACKEND.endswith("smtp.EmailBackend")


def serialize_me(request):
    user = users_for(request.user).get(pk=request.user.pk)
    return ProfileSerializer(user, context={"request": request}).data


def user_from_uid(uidb64):
    try:
        return User.objects.get(pk=force_str(urlsafe_base64_decode(uidb64)))
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return None


class AuthThrottleMixin:
    throttle_scope = "auth"


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Sets the CSRF cookie. Call once before the first POST."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class MeView(APIView):
    """`{"user": <the signed-in user or null>}`."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"user": serialize_me(request) if request.user.is_authenticated else None})


class RegisterView(AuthThrottleMixin, APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        if settings.EMAIL_VERIFICATION_REQUIRED:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            link = request.build_absolute_uri(f"/api/auth/activate/{uid}/{activation_token.make_token(user)}/")
            send_mail(
                "Activate your cookOverflow account",
                f"Hi {user.first_name or user.username},\n\nConfirm your email to start cooking:\n{link}\n",
                settings.EMAIL_FROM_USER, [user.email],
            )
            return Response({"verification_required": True, "email": user.email}, status=status.HTTP_201_CREATED)

        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return Response({"verification_required": False, "user": serialize_me(request)},
                        status=status.HTTP_201_CREATED)


class ActivateView(APIView):
    """Target of the emailed activation link; redirects to the React login page."""

    permission_classes = [AllowAny]

    def get(self, request, uidb64, token):
        user = user_from_uid(uidb64)
        if user and activation_token.check_token(user, token):
            user.is_email_verified = True
            user.save(update_fields=["is_email_verified"])
            return redirect("/login?verified=1")
        return redirect("/login?verified=0")


class LoginView(AuthThrottleMixin, APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["username"].strip()
        if "@" in identifier:
            identifier = User.objects.filter(email__iexact=identifier).values_list("username", flat=True).first() \
                or identifier
        user = authenticate(request, username=identifier, password=serializer.validated_data["password"])
        if not user:
            return Response({"detail": "Wrong username or password."}, status=status.HTTP_400_BAD_REQUEST)
        if settings.EMAIL_VERIFICATION_REQUIRED and not user.is_email_verified:
            return Response({"detail": "Please verify your email first. Check your inbox.",
                             "code": "email_not_verified"}, status=status.HTTP_403_FORBIDDEN)
        login(request, user)
        return Response(serialize_me(request))


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetView(AuthThrottleMixin, APIView):
    """Emails a reset link. Always answers 200 so it can't be used to discover accounts."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"], is_active=True, is_bot=False).first()
        payload = {"detail": "If that email has an account, a reset link is on its way."}
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            link = request.build_absolute_uri(f"/reset-password/{uid}/{default_token_generator.make_token(user)}")
            send_mail("Reset your cookOverflow password",
                      f"Hi {user.first_name or user.username},\n\nChoose a new password here:\n{link}\n\n"
                      "If you didn't ask for this, ignore this email.",
                      settings.EMAIL_FROM_USER, [user.email])
            if settings.DEBUG and not emails_are_delivered():
                # Local development: emails only go to the console, so hand the link to the UI.
                payload["dev_reset_url"] = link
        return Response(payload)


class PasswordResetConfirmView(AuthThrottleMixin, APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = user_from_uid(data["uid"])
        if not user or not default_token_generator.check_token(user, data["token"]):
            return Response({"detail": "This reset link is invalid or has expired."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            password_validation.validate_password(data["password"], user)
        except ValidationError as exc:
            return Response({"password": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(data["password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated. You can sign in now."})


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not request.user.check_password(data["current_password"]):
            return Response({"current_password": ["That's not your current password."]},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            password_validation.validate_password(data["new_password"], request.user)
        except ValidationError as exc:
            return Response({"new_password": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(data["new_password"])
        request.user.save(update_fields=["password"])
        update_session_auth_hash(request, request.user)
        return Response({"detail": "Password changed."})
