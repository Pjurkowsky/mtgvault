from django.urls import path

from . import views

urlpatterns = [
    path('catalog/cards/', views.CardSearchView.as_view(), name='card-search'),
    path('catalog/cards/<uuid:oracle_id>/printings/', views.CardPrintingsView.as_view(), name='card-printings'),
    path('catalog/sets/', views.SetSearchView.as_view(), name='set-search'),
    path('catalog/status/', views.CatalogStatusView.as_view(), name='catalog-status'),
]
