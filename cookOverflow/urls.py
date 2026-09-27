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
from django.urls import include, path, re_path
from django.views.generic.base import RedirectView

from core.views import spa

# The original Django-template UI, kept for reference while the React app replaces it.
legacy_patterns = [
    path('', include('Account.urls')),
    path('', include('core.urls')),
    path('', include('Timeline.urls')),
    path('profile/', include('Profile.urls')),
    path('messages/', include('communications.urls')),
    path('notification/', include('notifications.urls')),
    path('', include('django.contrib.auth.urls')),
]

urlpatterns = [
    path('favicon.ico', RedirectView.as_view(url=settings.STATIC_URL + 'images/logo.png')),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('legacy/', include(legacy_patterns)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) + [
    # Everything else is a React route.
    re_path(r'^(?!api/|admin|legacy/|media/|static/).*$', spa, name='spa'),
]
