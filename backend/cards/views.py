from django.db.models import Q, Sum
from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Printing, Set
from .pricing import latest_rates, prices_updated_at
from .edhrec import edhrec_for
from .serializers import (
    CardDetailSerializer,
    EdhrecSerializer,
    CardSearchResultSerializer,
    CatalogStatusSerializer,
    PrintingSerializer,
    SetSerializer,
)

SEARCH_LIMIT = 20
q_param = OpenApiParameter('q', str, required=True)


def price_context(request) -> dict:
    """Viewer's currency (USD when logged out, AC-58) plus the latest rates."""
    currency = getattr(request.user, 'currency', None) or 'USD'
    return {'currency': currency, 'rates': latest_rates()}


class CardSearchView(APIView):
    """Card names matching `q`, one entry per card (not per printing)."""

    permission_classes = [AllowAny]

    @extend_schema(parameters=[q_param], responses=CardSearchResultSerializer(many=True))
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            raise ValidationError({'q': ['Type at least 2 characters.']})

        # Newest printing per card supplies the name and picture.
        newest = (
            Printing.objects.filter(Q(name__icontains=q) | Q(front_name__icontains=q))
            .order_by('oracle_id', '-released_at')
            .distinct('oracle_id')
            .values('oracle_id', 'name', 'front_name', 'image_small', 'image_normal')[:200]
        )
        lowered = q.lower()

        def rank(card):
            starts = card['name'].lower().startswith(lowered) or card['front_name'].lower().startswith(lowered)
            return (not starts, card['name'].lower())

        results = sorted(newest, key=rank)[:SEARCH_LIMIT]
        return Response(CardSearchResultSerializer(results, many=True).data)


class CardPrintingsView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=PrintingSerializer(many=True))
    def get(self, request, oracle_id):
        printings = _printings(oracle_id)
        return Response(PrintingSerializer(printings, many=True, context=price_context(request)).data)


class SetSearchView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(parameters=[OpenApiParameter('q', str)], responses=SetSerializer(many=True))
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        sets = Set.objects.order_by('name')
        if q:
            sets = sets.filter(Q(name__icontains=q) | Q(code__iexact=q))
        return Response(SetSerializer(sets[:SEARCH_LIMIT], many=True).data)


class CatalogStatusView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=CatalogStatusSerializer)
    def get(self, request):
        return Response({'prices_updated_at': prices_updated_at()})


def _printings(oracle_id):
    return (
        Printing.objects.filter(oracle_id=oracle_id)
        .select_related('set')
        .order_by('-released_at', 'set_id', 'collector_number')
    )


class CardDetailView(APIView):
    """A card with its printings and how many copies the viewer owns."""

    permission_classes = [AllowAny]

    @extend_schema(responses=CardDetailSerializer)
    def get(self, request, oracle_id):
        from collection.models import CollectionItem  # cards stays importable without collection

        printings = list(_printings(oracle_id))
        if not printings:
            raise Http404('No such card.')
        owned = 0
        if request.user.is_authenticated:
            owned = CollectionItem.objects.filter(
                user=request.user, printing__oracle_id=oracle_id, in_cart=False,
            ).aggregate(n=Sum('quantity'))['n'] or 0
        wanted = 0
        if request.user.is_authenticated:
            from wants.models import WantItem
            wanted = WantItem.objects.filter(user=request.user, oracle_id=oracle_id).aggregate(n=Sum('quantity'))['n'] or 0
        data = {'oracle_id': oracle_id, 'name': printings[0].name, 'owned': owned, 'wanted': wanted, 'printings': printings}
        return Response(CardDetailSerializer(data, context=price_context(request)).data)


class CardEdhrecView(APIView):
    """EDHREC tabs for a card, cached 24 h. Never fails: no data = available false."""

    permission_classes = [AllowAny]

    @extend_schema(responses=EdhrecSerializer)
    def get(self, request, oracle_id):
        printing = Printing.objects.filter(oracle_id=oracle_id).only('name').first()
        if printing is None:
            raise Http404('No such card.')
        return Response(EdhrecSerializer(edhrec_for(printing.name)).data)
