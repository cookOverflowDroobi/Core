from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import HttpResponseRedirect
from django.shortcuts import render, redirect, reverse
from django.shortcuts import render, redirect, get_object_or_404

from django.contrib import messages
from validate_email import validate_email

from Timeline.models import Stream, Post, Follow
from .models import User
from .forms import LoginForm, SignUpForm
from django.core.mail import EmailMessage
from django.conf import settings
from .decorators import auth_user_should_not_access
from django.contrib.auth import authenticate, login, logout
from django.contrib.sites.shortcuts import get_current_site
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str, DjangoUnicodeDecodeError
from .utils import generate_token
import threading
from django.contrib.auth import get_user_model
# from ..Core import settings
User = get_user_model()

# Create your views here.
class EmailThread(threading.Thread):

    def __init__(self, email):
        self.email = email
        threading.Thread.__init__(self)

    def run(self):
        self.email.send()

def send_activation_email(user, request):
    current_site = get_current_site(request)
    email_subject = 'Activate your account'
    email_body = render_to_string('Account/Activation.html', {
        'user': user,
        'domain': current_site,
        'uid': urlsafe_base64_encode(force_bytes(user.pk)),
        'token': generate_token.make_token(user)
    })

    email = EmailMessage(subject=email_subject, body=email_body,
                         from_email=settings.EMAIL_FROM_USER,
                         to=[user.email]
                         )

    if not settings.TESTING:
        EmailThread(email).start()

@auth_user_should_not_access
def Login(request):
    form = SignUpForm()

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(request, username=username, password=password)

        if user and settings.EMAIL_VERIFICATION_REQUIRED and not user.is_email_verified:
            messages.error(request, '⚠️ Email is not verified, please check your email inbox')
            return render(request, 'Account/Login.html')

        if not user:
            messages.error(request, '⚠️ Invalid credentials, try again')
            return render(request, 'Account/Login.html')

        login(request, user)

        return redirect(reverse('core:home'))

    return render(request, 'Account/Login.html', {'form':form})

@auth_user_should_not_access
def Register(request):
    form = SignUpForm()

    if request.method == "POST":
        context = {'has_error': False}
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        email = request.POST.get('email')

        username = request.POST.get('username')
        password1 = request.POST.get('password1')
        password2 = request.POST.get('password2')

        if len(password1) < 6:
            messages.error(request, '⚠️ Password should be at least 6 characters for greater security')
            return redirect('Account:Register')

        if password1 != password2:
            messages.error(request, '⚠️ Password Mismatch! Your Passwords Do Not Match')
            return redirect('Account:Register')

        if not validate_email(email):
            messages.error(request, '⚠️ Password Mismatch! Your Passwords Do Not Match')
            return redirect('Account:Register')

        if not username:
            messages.error(request, '⚠️ Username is required!')
            return redirect('Account:Register')

        if User.objects.filter(username=username).exists():
            messages.error(request, '⚠️ Username is taken! Choose another one')

            return render(request, 'Account/Register.html')

        if User.objects.filter(email=email).exists():
            messages.error(request, '⚠️ Email is taken! Choose another one')

            return render(request, 'Account/Register.html')

        user = User.objects.create_user(first_name=first_name, last_name=last_name, username=username, email=email)
        user.set_password(password1)
        user.save()

        if not context['has_error']:
            if not settings.EMAIL_VERIFICATION_REQUIRED:
                messages.success(request, '✅ Sign Up Successful! You can now Log in')
                return redirect('Account:Login')

            send_activation_email(user, request)

            messages.success(request, '✅ Sign Up Successful! We sent you an email to verify your account')
            return redirect('Account:Register')

    return render(request, 'Account/Register.html', {'form':form})

def Logout(request):
    
    logout(request)
    messages.success(request, '✅ Successfully Logged Out!')

    return redirect(reverse('Account:Login'))

def ActivateUser(request, uidb64, token):

    try:
        uid = force_str(urlsafe_base64_decode(uidb64))

        user = User.objects.get(pk=uid)

    except Exception as e:
        user = None

    if user and generate_token.check_token(user, token):
        user.is_email_verified = True
        user.save()

        messages.success(request, '✅ Email Verified! You can now Log in')
        return redirect(reverse('Account:Login'))

    return render(request, 'Account:Activation Failed.html', {"user": user})

def Dashboard(request):
    return render(request, 'home.html')





@login_required
def follow(request, username, option):
	following = get_object_or_404(User, id=username)

	try:
		f, created = Follow.objects.get_or_create(follower=request.user, following=following)

		if int(option) == 0:
			f.delete()
			Stream.objects.filter(following=following, user=request.user).all().delete()
		else:
			 posts = Post.objects.all().filter(user=following)[:25]

			 with transaction.atomic():
			 	for post in posts:
			 		stream = Stream(post=post, user=request.user, date=post.posted, following=following)
			 		stream.save()

		return HttpResponseRedirect(reverse('profile/user-profile.html', args=[username]))
	except User.DoesNotExist:
		return HttpResponseRedirect(reverse('profile/user-profile.html', args=[username]))