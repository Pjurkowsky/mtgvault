from django.urls import path

from . import views

urlpatterns = [
    path('wants/', views.WantListView.as_view(), name='wants'),
    path('wants/settings/', views.WantSettingsView.as_view(), name='wants-settings'),
    path('wants/<int:pk>/', views.WantDetailView.as_view(), name='want'),
    path('decks/<int:pk>/want-missing/', views.WantMissingView.as_view(), name='deck-want-missing'),
    path('users/<str:username>/wants/', views.PublicWantListView.as_view(), name='public-wants'),
]
