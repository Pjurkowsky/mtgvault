from rest_framework import serializers

from cards.models import Finish, Printing
from cards.serializers import CanCommandSerializer, MoneySerializer, TokenSerializer, can_command
from collection.filters import ItemFilterSerializer
from collection.models import Condition, Language
from collection.serializers import ImportErrorSerializer, PrintingBriefSerializer, SelectionSerializer

from .models import Deck, DeckCard

MONEY = dict(max_digits=12, decimal_places=2, allow_null=True)


class DeckPrintingSerializer(PrintingBriefSerializer):
    can_command = serializers.SerializerMethodField()

    class Meta(PrintingBriefSerializer.Meta):
        fields = PrintingBriefSerializer.Meta.fields + ['mana_cost', 'cmc', 'types', 'color_identity', 'produced_mana', 'can_command']
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
    wanted = serializers.IntegerField(help_text='On the want list, for this deck or no deck (spec 010); 0 for visitors')
    free_copies = FreeCopySerializer(many=True, help_text='Empty for visitors')
    box_copies = FreeCopySerializer(many=True, help_text="Rows in this deck's box; empty for visitors")
    other_decks = OtherDeckSerializer(many=True, help_text='Empty for visitors')


class DeckCardSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    zone = serializers.ChoiceField(DeckCard.Zone.choices)
    quantity = serializers.IntegerField()
    printing = DeckPrintingSerializer()
    price = serializers.DecimalField(**MONEY)
    prices = MoneySerializer()
    ownership = OwnershipSerializer()
    swap_for = serializers.ListField(child=serializers.IntegerField(), help_text='Deck cards this Maybeboard card could replace (spec 021, AC-13)')
    categories = serializers.ListField(child=serializers.CharField(), help_text='Your names for the card; the first is primary')


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


class DeckTokenSerializer(TokenSerializer):
    makers = serializers.ListField(child=serializers.IntegerField(), help_text='Deck cards that make it, by name')
    kind = serializers.CharField(help_text='Oracle id, else name: one entry per kind (spec 021, AC-10)')
    chosen = serializers.BooleanField(help_text="The deck's owner picked this printing")
    set_name = serializers.CharField()
    price = serializers.DecimalField(**MONEY, help_text='Non-foil, else its only finish; counts toward nothing (spec 021, AC-11)')
    prices = MoneySerializer()


class TokenPrintingChoiceSerializer(serializers.Serializer):
    kind = serializers.CharField()
    token = serializers.UUIDField(allow_null=True, help_text='Null goes back to the first maker\'s art')


class SaltyCardSerializer(serializers.Serializer):
    name = serializers.CharField()
    salt = serializers.FloatField()


class DeckSaltSerializer(serializers.Serializer):
    """Spec 022, AC-12 to AC-14."""

    total = serializers.FloatField(help_text='Sum of the counted cards\' EDHREC salt known so far')
    average = serializers.IntegerField(help_text="EDHREC's average deck")
    pending = serializers.IntegerField(help_text='Counted cards whose score is not fetched yet or is stale')
    top = SaltyCardSerializer(many=True, help_text='The five saltiest counted cards')


class DeckThemeSerializer(serializers.Serializer):
    name = serializers.CharField()
    count = serializers.IntegerField(help_text='EDHREC decks with this commander and theme')
    url = serializers.CharField()


class DeckInsightsSerializer(serializers.Serializer):
    salt = DeckSaltSerializer()
    themes = DeckThemeSerializer(many=True, help_text="The commander's most played EDHREC themes (spec 022, AC-15)")


class BranchRefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    is_main = serializers.BooleanField()


class ForkedFromSerializer(serializers.Serializer):
    """Spec 027, AC-15: the deck a fork came from; `public` says whether a link can open it."""
    id = serializers.IntegerField()
    name = serializers.CharField()
    username = serializers.CharField()
    public = serializers.BooleanField()


class DeckDetailSerializer(DeckSummarySerializer):
    username = serializers.CharField()
    branch = BranchRefSerializer(help_text='The branch shown (spec 027)')
    forked_from = ForkedFromSerializer(allow_null=True)
    fork_count = serializers.IntegerField()
    currency = serializers.CharField()
    cards = DeckCardSerializer(many=True)
    tokens = DeckTokenSerializer(many=True, help_text='Made by Commander, Mainboard and Sideboard cards, one per kind (spec 015)')
    legality = LegalitySerializer()
    stats = StatsSerializer()
    salt = DeckSaltSerializer()


class ComboCardSerializer(serializers.Serializer):
    oracle_id = serializers.UUIDField()
    name = serializers.CharField()
    image = serializers.CharField()
    in_deck = serializers.BooleanField()
    owned = serializers.BooleanField(help_text='A missing card the viewer has in their collection')
    printing = serializers.UUIDField(allow_null=True, help_text='Newest printing, to add a missing card')


class ComboSerializer(serializers.Serializer):
    id = serializers.CharField()
    cards = ComboCardSerializer(many=True)
    produces = serializers.ListField(child=serializers.CharField())
    infinite = serializers.BooleanField()
    wins = serializers.BooleanField()
    prerequisites = serializers.CharField()
    description = serializers.CharField()
    requires = serializers.ListField(child=serializers.CharField(), help_text='Pieces that are not one named card')
    url = serializers.CharField(help_text='The combo on Commander Spellbook')


class DeckCombosSerializer(serializers.Serializer):
    """Spec 022, AC-7, AC-8."""

    in_deck = ComboSerializer(many=True)
    could_build = ComboSerializer(many=True, help_text='Infinite or win combos missing one or two cards')


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
    categories = serializers.ListField(
        child=serializers.CharField(max_length=40, allow_blank=True), required=False,
        help_text='Replaces the list; trimmed, duplicates dropped, at most 10',
    )


class CategorySuggestionsSerializer(serializers.Serializer):
    categories = serializers.ListField(child=serializers.CharField())


class NewCopySerializer(serializers.Serializer):
    printing = serializers.PrimaryKeyRelatedField(queryset=Printing.objects.all(), required=False)
    finish = serializers.ChoiceField(Finish.choices, required=False)
    condition = serializers.ChoiceField(Condition.choices, default=Condition.NEAR_MINT)
    language = serializers.ChoiceField(Language.choices, default=Language.ENGLISH)


class SwapProposalSerializer(serializers.Serializer):
    printing = serializers.PrimaryKeyRelatedField(queryset=Printing.objects.all(), help_text='The card to propose')


class PairSerializer(serializers.Serializer):
    """Spec 021, AC-14: a deck card out, and a Maybeboard card or a new card in."""

    out = serializers.IntegerField(help_text='Deck card to replace')
    card = serializers.IntegerField(required=False, help_text='A Maybeboard card of this deck')
    printing = serializers.PrimaryKeyRelatedField(queryset=Printing.objects.all(), required=False,
                                                  help_text='Or a card to add to the Maybeboard')

    def validate(self, data):
        if ('card' in data) == ('printing' in data):
            raise serializers.ValidationError({'detail': 'Give a card or a printing.'})
        return data


class ApplySwapSerializer(serializers.Serializer):
    out = serializers.IntegerField(help_text='The deck card it replaces')


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
    categories = serializers.ListField(child=serializers.CharField(), help_text='From #tags on the line')


class DeckImportPreviewSerializer(serializers.Serializer):
    rows = DeckImportRowSerializer(many=True)
    errors = ImportErrorSerializer(many=True)
    cards = serializers.IntegerField()


class MissingExportSerializer(serializers.Serializer):
    filter = ItemFilterSerializer(required=False)
    printings = serializers.BooleanField(default=True, help_text='Write set and number; off gives quantity and name only')
    other_decks = serializers.BooleanField(default=False, help_text="Also copies this deck lacks that are only in other decks' boxes")


class DeckExportParamsSerializer(serializers.Serializer):
    printings = serializers.BooleanField(default=True, help_text='Write set and number (spec 014, AC-3)')
    categories = serializers.BooleanField(default=True, help_text='Write categories as #tags (spec 014, AC-4)')
    tokens = serializers.BooleanField(default=False, help_text='End with a Tokens section (spec 015, AC-8)')


class OptimizeChangeSerializer(serializers.Serializer):
    """A deck card that a cheaper printing would replace (spec 013, AC-2)."""

    card = serializers.IntegerField(help_text='Deck card id')
    name = serializers.CharField()
    zone = serializers.ChoiceField(DeckCard.Zone.choices)
    state = serializers.ChoiceField(['missing', 'other_decks'])
    copies = serializers.IntegerField(help_text='Copies To buy counts for this card')
    printing = DeckPrintingSerializer(help_text='Current printing')
    price = serializers.DecimalField(**MONEY)
    prices = MoneySerializer(allow_null=True)
    cheapest = DeckPrintingSerializer()
    cheapest_price = serializers.DecimalField(**MONEY)
    cheapest_prices = MoneySerializer()
    saving = serializers.DecimalField(**MONEY, help_text='Per copy; null when the current printing has no price')


class OptimizePreviewSerializer(serializers.Serializer):
    changes = OptimizeChangeSerializer(many=True)


class OptimizeApplySerializer(serializers.Serializer):
    cards = serializers.ListField(child=serializers.IntegerField(), allow_empty=False, help_text='Deck card ids to switch')
