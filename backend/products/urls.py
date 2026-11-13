from django.urls import path

from . import views

urlpatterns = [
    path('decks/<int:pk>/products/', views.DeckProductsView.as_view(), name='deck-products'),
    path('users/<str:username>/decks/<int:pk>/products/', views.PublicDeckProductsView.as_view(), name='public-deck-products'),
    path('products/<slug:code>/', views.ProductDetailView.as_view(), name='product'),
    path('products/<slug:code>/cards/', views.ProductItemsView.as_view(), name='product-cards'),
]
