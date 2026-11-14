from rest_framework import serializers

from cards.pricing import prices_in_all
from cards.serializers import MoneySerializer, PrintingSerializer
from collection.filters import SORTS, ItemFilterSerializer
from collection.serializers import MONEY, PrintingBriefSerializer

from .deck import CARDS, PRINTINGS, SINCE
from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['code', 'kind', 'section', 'name', 'set_code', 'set_name', 'released_at', 'deck_type', 'image']
        read_only_fields = fields


class ProductCardSerializer(serializers.Serializer):
    printing = PrintingSerializer()
    copies = serializers.IntegerField(help_text='Decks: copies of this card')
    chance = serializers.FloatField(allow_null=True, help_text='Boosters: chance a pack holds this card, 0 to 1')


class DeckProductSerializer(serializers.Serializer):
    product = ProductSerializer()
    count = serializers.IntegerField(help_text="How many of the deck's cards it holds")
    commanders = PrintingSerializer(many=True, help_text="Decks: the product's commanders (spec 032, AC-3)")
    cards = ProductCardSerializer(many=True)


class ProductSectionsSerializer(serializers.Serializer):
    """The dialog's tabs (spec 032, AC-1), each most cards first."""
    precons = DeckProductSerializer(many=True)
    boosters = DeckProductSerializer(many=True)
    other_decks = DeckProductSerializer(many=True)
    other_boosters = DeckProductSerializer(many=True)


class DeckProductsSerializer(serializers.Serializer):
    synced = serializers.BooleanField(help_text='False until the first product sync (spec 030, AC-12)')
    cards = serializers.IntegerField(help_text='Cards looked for')
    sections = ProductSectionsSerializer()
    none = PrintingSerializer(many=True, help_text='Cards no listed product holds')


class DeckProductsQuerySerializer(serializers.Serializer):
    cards = serializers.ChoiceField(CARDS, default='missing')
    printing = serializers.ChoiceField(PRINTINGS, default='any')
    since = serializers.ChoiceField(SINCE, default=0, help_text='Years back; 0 for any')


class ProductDetailSerializer(ProductSerializer):
    count = serializers.IntegerField(help_text='Printings it can hold')

    class Meta(ProductSerializer.Meta):
        fields = [*ProductSerializer.Meta.fields, 'count']
        read_only_fields = fields


class ProductFilterSerializer(ItemFilterSerializer):
    """The collection filters (spec 030, AC-9), plus Owned and the chance sort (AC-10, AC-11)."""

    sort = serializers.ChoiceField([*SORTS, 'chance'], default='name')
    owned = serializers.ChoiceField(['owned', 'not_owned'], required=False, help_text='Signed in only')


class ProductItemSerializer(serializers.Serializer):
    """A printing on a product's page, shaped like a card browser row."""

    id = serializers.IntegerField()
    printing = PrintingBriefSerializer()
    quantity = serializers.IntegerField(help_text='Decks: copies; boosters: 1')
    finish = serializers.CharField()
    condition = serializers.CharField(default='NM')
    language = serializers.CharField(default='en')
    unit_price = serializers.DecimalField(**MONEY)
    unit_prices = serializers.SerializerMethodField(help_text='Singles price per copy in every currency')
    chance = serializers.FloatField(allow_null=True, help_text='Boosters: chance a pack holds this printing, 0 to 1')
    owned = serializers.IntegerField(allow_null=True, help_text="Copies of the card (any printing) the viewer owns; null signed out")

    def get_unit_prices(self, row) -> MoneySerializer:
        return prices_in_all(row.printing, row.finish, self.context['rates'])


class ProductItemPageSerializer(serializers.Serializer):
    currency = serializers.CharField()
    prices_updated_at = serializers.DateTimeField(allow_null=True)
    count = serializers.IntegerField()
    total_quantity = serializers.IntegerField()
    total_value = serializers.DecimalField(**MONEY)
    total_values = MoneySerializer()
    results = ProductItemSerializer(many=True)
