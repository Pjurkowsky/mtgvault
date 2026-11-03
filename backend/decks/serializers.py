from rest_framework import serializers

from cards.models import Finish, Printing
from cards.serializers import CanCommandSerializer, MoneySerializer, can_command
from collection.filters import ItemFilterSerializer
from collection.models import Condition, Language
from collection.serializers import ImportErrorSerializer, PrintingBriefSerializer, SelectionSerializer

from .models import Deck, DeckCard

MONEY = dict(max_digits=12, decimal_places=2, allow_null=True)


class DeckPrintingSerializer(PrintingBriefSerializer):
    can_command = serializers.SerializerMethodField()

    class Meta(PrintingBriefSerializer.Meta):
        fields = PrintingBriefSerializer.Meta.fields + ['mana_cost', 'cmc', 'types', 'color_identity', 'can_command']
        read_only_fields = fields

    def get_can_command(self, printing) -> CanCommandSerializer:
        return can_command(printing)


class FreeCopySerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    quantity = serializers.IntegerField()
    location = serializers.CharField()
    location_id = serializers.IntegerField(allow_null=True)
    set_code = serializers.CharField()
    collector_number = serializers.CharField()
    finish = serializers.CharField()


class OtherDeckSerializer(serializers.Serializer):
    deck = serializers.CharField()
    quantity = serializers.IntegerField()


class OwnershipSerializer(serializers.Serializer):
    state = serializers.ChoiceField(['in_box', 'owned', 'other_decks', 'missing'])
    needed = serializers.IntegerField()
    in_box = serializers.IntegerField()
    free = serializers.IntegerField()
    in_other_decks = serializers.IntegerField()
    missing = serializers.IntegerField()
    free_copies = FreeCopySerializer(many=True, help_text='Empty for visitors')
    other_decks = OtherDeckSerializer(many=True, help_text='Empty for visitors')


class DeckCardSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    zone = serializers.ChoiceField(DeckCard.Zone.choices)
    quantity = serializers.IntegerField()
    printing = DeckPrintingSerializer()
    price = serializers.DecimalField(**MONEY)
    prices = MoneySerializer()
    ownership = OwnershipSerializer()
    swap_for = serializers.IntegerField(allow_null=True, help_text='Deck card this Maybeboard card could replace')


class IssueSerializer(serializers.Serializer):
    code = serializers.CharField()
    message = serializers.CharField()
    cards = serializers.ListField(child=serializers.CharField())


class LegalitySerializer(serializers.Serializer):
    legal = serializers.BooleanField()
    issues = IssueSerializer(many=True)


class ValueSplitSerializer(serializers.Serializer):
    total = serializers.DecimalField(**MONEY)
    owned = serializers.DecimalField(**MONEY)
    missing = serializers.DecimalField(**MONEY)


class ValuesSplitSerializer(serializers.Serializer):
    total = MoneySerializer()
    owned = MoneySerializer()
    missing = MoneySerializer()


class StatsSerializer(serializers.Serializer):
    curve = serializers.DictField(child=serializers.IntegerField())
    pips = serializers.DictField(child=serializers.IntegerField())
    types = serializers.DictField(child=serializers.IntegerField())
    average_mana_value = serializers.FloatField()
    value = ValueSplitSerializer()
    values = ValuesSplitSerializer()


class CountsSerializer(serializers.Serializer):
    commander = serializers.IntegerField()
    main = serializers.IntegerField()
    side = serializers.IntegerField()
    maybe = serializers.IntegerField()
    size = serializers.IntegerField(help_text='Commander + Mainboard')
    target = serializers.IntegerField(allow_null=True, help_text="The format's deck size")
    owned = serializers.IntegerField()
    missing = serializers.IntegerField()


class DeckSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    format = serializers.ChoiceField(Deck.Format.choices)
    is_public = serializers.BooleanField()
    location = serializers.IntegerField(allow_null=True)
    location_name = serializers.CharField(allow_null=True)
    image = serializers.CharField(allow_blank=True)
    counts = CountsSerializer()
    value = serializers.DecimalField(**MONEY)
    values = MoneySerializer()


class DeckDetailSerializer(DeckSummarySerializer):
    username = serializers.CharField()
    currency = serializers.CharField()
    cards = DeckCardSerializer(many=True)
    legality = LegalitySerializer()
    stats = StatsSerializer()


class DeckListSerializer(serializers.Serializer):
    currency = serializers.CharField()
    decks = DeckSummarySerializer(many=True)


class DeckWriteSerializer(serializers.ModelSerializer):
    create_box = serializers.BooleanField(write_only=True, default=False)
    text = serializers.CharField(write_only=True, required=False, allow_blank=True, help_text='Decklist to import')

    class Meta:
        model = Deck
        fields = ['name', 'format', 'is_public', 'create_box', 'text']


class DeckDeleteSerializer(serializers.Serializer):
    box = serializers.ChoiceField(['keep', 'unfile', 'delete'], required=False)


class DeckCardWriteSerializer(serializers.Serializer):
    printing = serializers.PrimaryKeyRelatedField(queryset=Printing.objects.all())
    quantity = serializers.IntegerField(min_value=1, max_value=999, default=1)
    zone = serializers.ChoiceField(DeckCard.Zone.choices, default=DeckCard.Zone.MAIN)


class DeckCardEditSerializer(serializers.Serializer):
    printing = serializers.PrimaryKeyRelatedField(queryset=Printing.objects.all(), required=False)
    quantity = serializers.IntegerField(min_value=1, max_value=999, required=False)
    zone = serializers.ChoiceField(DeckCard.Zone.choices, required=False)


class NewCopySerializer(serializers.Serializer):
    printing = serializers.PrimaryKeyRelatedField(queryset=Printing.objects.all(), required=False)
    finish = serializers.ChoiceField(Finish.choices, required=False)
    condition = serializers.ChoiceField(Condition.choices, default=Condition.NEAR_MINT)
    language = serializers.ChoiceField(Language.choices, default=Language.ENGLISH)


class SwapProposalSerializer(serializers.Serializer):
    printing = serializers.PrimaryKeyRelatedField(queryset=Printing.objects.all(), help_text='The card to propose')


class MarkOwnedSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=999, default=1)
    item_id = serializers.IntegerField(required=False, help_text='Move this free copy into the deck box')
    new = NewCopySerializer(required=False, help_text='Or record a new copy')

    def validate(self, attrs):
        if ('item_id' in attrs) == ('new' in attrs):
            raise serializers.ValidationError('Send either item_id or new.')
        return attrs


class BoxMoveSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class CreateBoxSerializer(serializers.Serializer):
    moves = BoxMoveSerializer(many=True, default=list)


class AddFromCollectionSerializer(serializers.Serializer):
    deck = serializers.IntegerField()
    zone = serializers.ChoiceField(DeckCard.Zone.choices, default=DeckCard.Zone.MAIN)
    selection = SelectionSerializer()


class AddResultSerializer(serializers.Serializer):
    cards = serializers.IntegerField(help_text='Distinct cards added')


class DeckTextSerializer(serializers.Serializer):
    text = serializers.CharField(allow_blank=True, trim_whitespace=False)


class DeckImportRowSerializer(serializers.Serializer):
    line = serializers.IntegerField()
    zone = serializers.CharField()
    quantity = serializers.IntegerField()
    printing = PrintingBriefSerializer()


class DeckImportPreviewSerializer(serializers.Serializer):
    rows = DeckImportRowSerializer(many=True)
    errors = ImportErrorSerializer(many=True)
    cards = serializers.IntegerField()


class MissingExportSerializer(serializers.Serializer):
    filter = ItemFilterSerializer(required=False)
