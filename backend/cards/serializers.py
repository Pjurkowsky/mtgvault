from types import SimpleNamespace

from rest_framework import serializers

from .models import Finish, Printing, Set
from .pricing import CURRENCIES, price, prices_in_all


class MoneySerializer(serializers.Serializer):
    """One amount in every currency. Null = no price."""

    USD = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    EUR = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    PLN = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)


class PricesAllSerializer(serializers.Serializer):
    """Per finish, the price in every currency."""

    nonfoil = MoneySerializer()
    foil = MoneySerializer()
    etched = MoneySerializer()


class PricesSerializer(serializers.Serializer):
    """Price per copy for each finish, in the viewer's currency. Null = no price."""

    nonfoil = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    foil = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    etched = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)


class CanCommandSerializer(serializers.Serializer):
    commander = serializers.BooleanField()
    brawl = serializers.BooleanField()


def can_command(printing) -> dict:
    """Formats this card may lead (spec 005, AC-5). The rules live with deck legality."""
    from decks.legality import FORMATS, can_be_commander
    return {key: can_be_commander(printing, FORMATS[key]) for key in ('commander', 'brawl')}


class PrintingSerializer(serializers.ModelSerializer):
    """A printing with prices. Needs `currency` and `rates` in the context."""

    set_code = serializers.CharField(source='set_id')
    set_name = serializers.CharField(source='set.name')
    prices = serializers.SerializerMethodField()
    prices_all = serializers.SerializerMethodField()
    can_command = serializers.SerializerMethodField()

    class Meta:
        model = Printing
        fields = [
            'id', 'oracle_id', 'name', 'set_code', 'set_name', 'collector_number',
            'released_at', 'rarity', 'colors', 'type_line', 'mana_cost', 'finishes',
            'image_small', 'image_normal', 'image_large', 'image_back_normal', 'image_back_large', 'prices', 'prices_all', 'can_command',
        ]
        read_only_fields = fields  # output only; also marks them required in the schema

    def get_can_command(self, printing) -> CanCommandSerializer:
        return can_command(printing)

    def get_prices(self, printing) -> PricesSerializer:
        currency, rates = self.context['currency'], self.context['rates']
        return {
            finish: price(printing, finish, currency, rates) if finish in printing.finishes else None
            for finish in Finish.values
        }

    def get_prices_all(self, printing) -> PricesAllSerializer:
        empty = dict.fromkeys(CURRENCIES)
        return {
            finish: prices_in_all(printing, finish, self.context['rates']) if finish in printing.finishes else empty
            for finish in Finish.values
        }


class CardDetailSerializer(serializers.Serializer):
    oracle_id = serializers.UUIDField()
    name = serializers.CharField()
    owned = serializers.IntegerField(help_text="Copies the viewer owns across printings (0 when logged out)")
    wanted = serializers.IntegerField(help_text="Copies on the viewer's want list (spec 010, AC-4)")
    printings = PrintingSerializer(many=True)


class EdhrecCardSerializer(serializers.Serializer):
    name = serializers.CharField()
    oracle_id = serializers.UUIDField(allow_null=True, help_text='Null when the card is not in our catalog')
    image_small = serializers.CharField(allow_blank=True)
    image_normal = serializers.CharField(allow_blank=True)


class EdhrecCommanderSerializer(EdhrecCardSerializer):
    share = serializers.FloatField(help_text="Share of this commander's decks that play the card (0-1)")


class EdhrecSynergyCardSerializer(EdhrecCardSerializer):
    synergy = serializers.FloatField(allow_null=True)


class EdhrecGroupSerializer(serializers.Serializer):
    group = serializers.CharField()
    cards = EdhrecSynergyCardSerializer(many=True)


class EdhrecSerializer(serializers.Serializer):
    available = serializers.BooleanField()
    commanders = EdhrecCommanderSerializer(many=True)
    played_with = EdhrecGroupSerializer(many=True)
    similar = EdhrecCardSerializer(many=True)


class CardSearchResultSerializer(serializers.Serializer):
    oracle_id = serializers.UUIDField()
    name = serializers.CharField()
    image_small = serializers.CharField()
    image_normal = serializers.CharField()


class SetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Set
        fields = ['code', 'name']


class CatalogStatusSerializer(serializers.Serializer):
    prices_updated_at = serializers.DateTimeField(allow_null=True)


class TokenSerializer(serializers.Serializer):
    """A token, emblem or marker a card makes (spec 015)."""

    id = serializers.UUIDField()
    oracle_id = serializers.UUIDField(allow_null=True)
    name = serializers.CharField()
    type_line = serializers.CharField()
    set_code = serializers.CharField()
    collector_number = serializers.CharField()
    image_small = serializers.CharField()
    image_normal = serializers.CharField()
    image_large = serializers.CharField()


class TokenPrintingSerializer(serializers.Serializer):
    """A printing of a token, with the fields the printing picker reads (spec 021, AC-10).
    Needs `currency` and `rates` in the context."""

    id = serializers.UUIDField()
    name = serializers.CharField()
    set_code = serializers.CharField()
    set_name = serializers.CharField()
    collector_number = serializers.CharField()
    finishes = serializers.ListField(child=serializers.ChoiceField(Finish.choices))
    image_small = serializers.CharField()
    image_normal = serializers.CharField()
    image_large = serializers.CharField()
    prices = serializers.SerializerMethodField()
    prices_all = serializers.SerializerMethodField()

    def get_prices(self, token) -> PricesSerializer:
        ns = SimpleNamespace(**token)
        return {f: price(ns, f, self.context['currency'], self.context['rates']) if f in token['finishes'] else None for f in Finish.values}

    def get_prices_all(self, token) -> PricesAllSerializer:
        ns, empty = SimpleNamespace(**token), dict.fromkeys(CURRENCIES)
        return {f: prices_in_all(ns, f, self.context['rates']) if f in token['finishes'] else empty for f in Finish.values}
