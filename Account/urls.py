from django.urls import re_path
from django.urls import path
from . import views
from django.contrib.auth import views as auth_views

from .views import follow

app_name = 'Account'

urlpatterns = [
    path('Login/',views.Login, name = 'Login'),
    path('Register/',views.Register, name = 'Register'),
    path('Logout/',views.Logout, name = 'Logout'),
    path('activateuser/<uidb64>/<token>',views.ActivateUser, name = 'ActivateUser'),
    path('profile/<int:username>/follow/<option>', follow, name='follow'),

    # path('resetpassword/',auth_views.PasswordResetView.as_view(template_name='Account/ResetPassword.html'), name = 'reset_password'),
    path('resetpassword/',
         auth_views.PasswordResetView.as_view(
        template_name='Account/ResetPassword.html', email_template_name='Account/ResetPasswordEmail.html'),
         name='reset_password'),
    path('resetpassword/sent/',
         auth_views.PasswordResetDoneView.as_view(
        template_name='Account/ResetPasswordSent.html'),
         name = 'password_reset_done'),
    path('resetpassword/<uidb64>/<token>/',
         auth_views.PasswordResetConfirmView.as_view(
             template_name='Account/ResetPasswordConfirm.html'),
         name = 'password_reset_confirm'),
    path('resetpassword/success/',
         auth_views.PasswordResetCompleteView.as_view(
             template_name='Account/ResetPasswordSuccess.html'),
         name = 'password_reset_complete'),

    path('User/Dashboard',views.Dashboard, name = 'Dashboard'),

]