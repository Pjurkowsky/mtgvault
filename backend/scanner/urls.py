from django.urls import path

from . import views

urlpatterns = [
    path('scanner/bundle/', views.BundleInfoView.as_view(), name='scanner-bundle'),
    path('scanner/bundles/<str:version>/<str:name>', views.BundleFileView.as_view(), name='scanner-bundle-file'),
    path('scanner/source/', views.ScannerSourceView.as_view(), name='scanner-source'),
    path('scanner/source/sync/', views.ScannerSourceSyncView.as_view(), name='scanner-source-sync'),
    path('scanner/settings/', views.ScannerSettingsView.as_view(), name='scanner-settings'),
    path('scanner/locked-illustrations/', views.LockedIllustrationsView.as_view(), name='scanner-locked'),
    path('scanner/scans/', views.ScanView.as_view(), name='scanner-scans'),
    path('scanner/scans/<int:pk>/undo/', views.UndoScanView.as_view(), name='scanner-undo'),
]
