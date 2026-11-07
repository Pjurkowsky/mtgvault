from django.urls import path

from . import views

urlpatterns = [
    path('catalog/cards/', views.CardSearchView.as_view(), name='card-search'),
    path('catalog/cards/<uuid:oracle_id>/', views.CardDetailView.as_view(), name='card-detail'),
    path('catalog/cards/<uuid:oracle_id>/edhrec/', views.CardEdhrecView.as_view(), name='card-edhrec'),
    path('catalog/cards/<uuid:oracle_id>/printings/', views.CardPrintingsView.as_view(), name='card-printings'),
    path('catalog/printings/<uuid:printing_id>/tokens/', views.PrintingTokensView.as_view(), name='printing-tokens'),
    path('catalog/sets/', views.SetSearchView.as_view(), name='set-search'),
    path('catalog/status/', views.CatalogStatusView.as_view(), name='catalog-status'),
]
