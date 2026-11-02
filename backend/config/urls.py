from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    # API docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Apps
    path('api/', include('core.urls')),
    path('api/', include('users.urls')),
    path('api/', include('cards.urls')),
    path('api/', include('collection.urls')),
    path('api/', include('scanner.urls')),
]
