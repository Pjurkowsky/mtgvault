from rest_framework import serializers

from .models import Finish, Printing, Set
from .pricing import price


class PricesSerializer(serializers.Serializer):
    """Price per copy for each finish, in the viewer's currency. Null = no price."""

    nonfoil = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    foil = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    etched = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)


class PrintingSerializer(serializers.ModelSerializer):
    """A printing with prices. Needs `currency` and `rates` in the context."""

    set_code = serializers.CharField(source='set_id')
    set_name = serializers.CharField(source='set.name')
    prices = serializers.SerializerMethodField()

    class Meta:
        model = Printing
        fields = [
            'id', 'oracle_id', 'name', 'set_code', 'set_name', 'collector_number',
            'released_at', 'rarity', 'colors', 'type_line', 'mana_cost', 'finishes',
            'image_small', 'image_normal', 'image_large', 'prices',
        ]
        read_only_fields = fields  # output only; also marks them required in the schema

    def get_prices(self, printing) -> PricesSerializer:
        currency, rates = self.context['currency'], self.context['rates']
        return {
            finish: price(printing, finish, currency, rates) if finish in printing.finishes else None
            for finish in Finish.values
        }


class CardSearchResultSerializer(serializers.Serializer):
    oracle_id = serializers.UUIDField()
    name = serializers.CharField()
    image_small = serializers.CharField()


class SetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Set
        fields = ['code', 'name']


class CatalogStatusSerializer(serializers.Serializer):
    prices_updated_at = serializers.DateTimeField(allow_null=True)
