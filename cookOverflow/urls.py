"""cookOverflow URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.templatetags.static import static as static_url
from django.urls import path, include
from django.views.generic.base import RedirectView

from Account.views import follow

urlpatterns = [
    # Must come before Timeline's catch-all '<str:title>' route.
    path('favicon.ico', RedirectView.as_view(url=static_url('images/logo.png'))),
    path('admin', admin.site.urls),
    path('', include('Account.urls')),

    path('', include('core.urls')),
    path('', include('Timeline.urls')),
    # path('', include('Friends.urls')),
    path('profile/',include('Profile.urls')),
    path('messages/', include('communications.urls')),
    path('notification/', include('notifications.urls')),



                  # path('resetpassword/', include('Account.urls')),
    path('', include('django.contrib.auth.urls'))

                  # path('', include('Account.urls')),

              ] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
