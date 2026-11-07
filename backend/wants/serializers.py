from rest_framework import serializers

from cards.models import Finish, Printing
from cards.pricing import prices_in_all
from cards.serializers import MoneySerializer
from collection.serializers import MONEY, PrintingBriefSerializer

from .models import ANY, FINISH_CHOICES, WantItem


def priced_finish(finish: str) -> str:
    """Any finish is priced as non-foil (spec 010, AC-8)."""
    return Finish.NONFOIL if finish == ANY else finish


class PublicWantSerializer(serializers.ModelSerializer):
    """What visitors see of a public want list (AC-18): no decks."""

    printing = PrintingBriefSerializer()
    unit_price = serializers.DecimalField(**MONEY, read_only=True)
    unit_prices = serializers.SerializerMethodField(help_text='Price per copy in every currency')

    class Meta:
        model = WantItem
        fields = ['id', 'printing', 'any_printing', 'quantity', 'finish', 'unit_price', 'unit_prices']
        read_only_fields = fields  # output only; also marks them required in the schema

    def get_unit_prices(self, entry) -> MoneySerializer:
        return prices_in_all(entry.printing, priced_finish(entry.finish), self.context['rates'])


class WantSerializer(PublicWantSerializer):
    deck = serializers.IntegerField(source='deck_id', allow_null=True, read_only=True)
    deck_name = serializers.CharField(source='deck.name', allow_null=True, default=None, read_only=True)
    deck_location = serializers.IntegerField(source='deck.location_id', allow_null=True, default=None,
                                             read_only=True,
                                             help_text="The linked deck's box, where Add to collection puts copies")

    class Meta(PublicWantSerializer.Meta):
        fields = PublicWantSerializer.Meta.fields + ['deck', 'deck_name', 'deck_location', 'added_at']
        read_only_fields = fields


class WantPageSerializer(serializers.Serializer):
    currency = serializers.CharField()
    prices_updated_at = serializers.DateTimeField(allow_null=True)
    count = serializers.IntegerField(help_text='Matching entries')
    total_quantity = serializers.IntegerField(help_text='Cards in matching entries')
    total_value = serializers.DecimalField(**MONEY)
    total_values = MoneySerializer()
    results = WantSerializer(many=True)


class PublicWantPageSerializer(WantPageSerializer):
    results = PublicWantSerializer(many=True)


class WantWriteSerializer(serializers.Serializer):
    printing = serializers.PrimaryKeyRelatedField(queryset=Printing.objects.all())
    any_printing = serializers.BooleanField(default=True, help_text='False pins `printing`')
    finish = serializers.ChoiceField(FINISH_CHOICES, default=ANY)
    deck = serializers.IntegerField(required=False, allow_null=True, help_text='The deck this card is for')
    quantity = serializers.IntegerField(min_value=1, max_value=999, default=1)

    def validate_deck(self, value):
        if value is None:
            return None
        from decks.models import Deck
        deck = Deck.objects.filter(user=self.context['request'].user, pk=value).first()
        if deck is None:
            raise serializers.ValidationError('Unknown deck.')
        return deck


class WantSaveResultSerializer(serializers.Serializer):
    want = WantSerializer()
    merged = serializers.BooleanField()
    wanted = serializers.IntegerField(help_text='Copies of this card on the want list now')


class WantSettingsSerializer(serializers.Serializer):
    is_public = serializers.BooleanField()


class WantMissingRequestSerializer(serializers.Serializer):
    card = serializers.IntegerField(required=False, help_text='One deck card; omit for every missing card')


def want_missing_result_serializer():
    from decks.serializers import DeckDetailSerializer

    class WantMissingResultSerializer(serializers.Serializer):
        added = serializers.IntegerField(help_text='Copies put on the want list')
        deck = DeckDetailSerializer()

    return WantMissingResultSerializer
