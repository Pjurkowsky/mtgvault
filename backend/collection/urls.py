from django.urls import path

from . import views

urlpatterns = [
    path('locations/', views.LocationListView.as_view(), name='locations'),
    path('locations/<int:pk>/', views.LocationDetailView.as_view(), name='location'),
    path('locations/<int:pk>/delete/', views.LocationDeleteView.as_view(), name='location-delete'),
    path('items/', views.ItemListView.as_view(), name='items'),
    path('items/bulk/', views.BulkView.as_view(), name='items-bulk'),
    path('items/export/', views.ExportView.as_view(), name='items-export'),
    path('items/<int:pk>/', views.ItemDetailView.as_view(), name='item'),
    path('imports/preview/', views.ImportPreviewView.as_view(), name='import-preview'),
    path('imports/commit/', views.ImportCommitView.as_view(), name='import-commit'),
    path('users/', views.DirectoryView.as_view(), name='directory'),
    path('users/<str:username>/locations/', views.PublicLocationListView.as_view(), name='public-locations'),
    path('users/<str:username>/locations/<int:pk>/', views.PublicLocationDetailView.as_view(), name='public-location'),
    path('users/<str:username>/locations/<int:pk>/items/', views.PublicItemListView.as_view(), name='public-items'),
    path('users/<str:username>/locations/<int:pk>/export/', views.PublicExportView.as_view(), name='public-export'),
]
