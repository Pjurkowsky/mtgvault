from django.urls import path

from . import views

urlpatterns = [
    path('decks/', views.DeckListView.as_view(), name='decks'),
    path('decks/import/preview/', views.DeckImportPreviewView.as_view(), name='deck-import-preview'),
    path('decks/categories/', views.CategorySuggestionsView.as_view(), name='deck-categories'),
    path('decks/add-from-collection/', views.AddFromCollectionView.as_view(), name='deck-add-from-collection'),
    path('decks/<int:pk>/', views.DeckDetailView.as_view(), name='deck'),
    path('decks/<int:pk>/delete/', views.DeckDeleteView.as_view(), name='deck-delete'),
    path('decks/<int:pk>/cards/', views.DeckCardsView.as_view(), name='deck-cards'),
    path('decks/<int:pk>/cards/<int:card_id>/', views.DeckCardDetailView.as_view(), name='deck-card'),
    path('decks/<int:pk>/cards/<int:card_id>/own/', views.MarkOwnedView.as_view(), name='deck-card-own'),
    path('decks/<int:pk>/cards/<int:card_id>/swaps/', views.ProposeSwapView.as_view(), name='deck-card-swaps'),
    path('decks/<int:pk>/cards/<int:card_id>/swaps/<int:out_id>/', views.UnpairView.as_view(), name='deck-card-unpair'),
    path('decks/<int:pk>/swaps/', views.PairsView.as_view(), name='deck-swaps'),
    path('decks/<int:pk>/cards/<int:card_id>/apply-swap/', views.ApplySwapView.as_view(), name='deck-card-apply-swap'),
    path('decks/<int:pk>/box/', views.CreateBoxView.as_view(), name='deck-box'),
    path('decks/<int:pk>/import/', views.DeckImportView.as_view(), name='deck-import'),
    path('decks/<int:pk>/export/', views.DeckExportView.as_view(), name='deck-export'),
    path('decks/<int:pk>/optimize/', views.OptimizeView.as_view(), name='deck-optimize'),
    path('decks/<int:pk>/missing/', views.MissingView.as_view(), name='deck-missing'),
    path('decks/<int:pk>/missing/export/', views.MissingExportView.as_view(), name='deck-missing-export'),
    path('users/<str:username>/decks/', views.PublicDeckListView.as_view(), name='public-decks'),
    path('users/<str:username>/decks/<int:pk>/', views.PublicDeckDetailView.as_view(), name='public-deck'),
]
