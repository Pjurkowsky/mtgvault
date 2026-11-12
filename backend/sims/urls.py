from django.urls import path

from . import views

urlpatterns = [
    path('sims/status/', views.StatusView.as_view(), name='sims-status'),
    path('sims/opponents/', views.OpponentsView.as_view(), name='sims-opponents'),
    path('sims/pool/', views.PoolView.as_view(), name='sims-pool'),
    path('sims/pool/<int:pk>/', views.PoolDeckView.as_view(), name='sims-pool-deck'),
    path('sims/decks/<int:pk>/lists/', views.DeckListsView.as_view(), name='sims-deck-lists'),
    path('sims/check/', views.CheckView.as_view(), name='sims-check'),
    path('sims/swaps/', views.SwapsView.as_view(), name='sims-swaps'),
    path('sims/suggest/', views.SuggestView.as_view(), name='sims-suggest'),
    path('sims/queue/', views.QueueView.as_view(), name='sims-queue'),
    path('sims/queue/cancel/', views.CancelAllView.as_view(), name='sims-queue-cancel'),
    path('sims/runs/', views.RunsView.as_view(), name='sims-runs'),
    path('sims/groups/<uuid:group>/', views.GroupView.as_view(), name='sims-group'),
    path('sims/runs/<int:pk>/', views.RunView.as_view(), name='sims-run'),
    path('sims/runs/<int:pk>/cancel/', views.CancelRunView.as_view(), name='sims-run-cancel'),
    path('sims/runs/<int:pk>/games/<int:number>/', views.ReplayView.as_view(), name='sims-replay'),
]
