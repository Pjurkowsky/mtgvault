from rest_framework import serializers

from cards.models import Finish, Printing
from cards.pricing import CURRENCIES, convert, convert_to_all, prices_in_all
from cards.serializers import MoneySerializer
from users.models import Currency

from .filters import ItemFilterSerializer
from .models import CollectionItem, Condition, Language, Location

MONEY = dict(max_digits=12, decimal_places=2, allow_null=True)
EMPTY_TOTALS = {'card_count': 0, 'value': None, 'values': dict.fromkeys(CURRENCIES)}


# ---------- Locations ----------

class TotalsSerializer(serializers.Serializer):
    card_count = serializers.IntegerField()
    value = serializers.DecimalField(**MONEY)
    values = MoneySerializer()


class DeckFormatField(serializers.ChoiceField):
    """A Deck box's deck format (spec 005, AC-18): read from the linked deck, written through the view."""

    def get_attribute(self, instance):
        deck = getattr(instance, 'deck', None)
        return deck.format if deck else None

    def to_representation(self, value):
        return value


class LocationSerializer(serializers.ModelSerializer):
    """Owner view of a location. Totals come from the view (context['totals'])."""

    deck_format = DeckFormatField(
        choices=[], required=False, allow_null=True,
        help_text="Deck box only: the deck's format (new deck boxes default to Commander)",
    )
    card_count = serializers.SerializerMethodField()
    value = serializers.SerializerMethodField()
    values = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = ['id', 'name', 'kind', 'is_public', 'deck_format', 'card_count', 'value', 'values', 'created_at']
        read_only_fields = ['id', 'created_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from decks.models import Deck  # decks builds on collection
        self.fields['deck_format'].choices = Deck.Format.choices

    def save(self, **kwargs):
        # Not a Location field: the view hands it to the deck.
        self.deck_format = self.validated_data.pop('deck_format', None)
        return super().save(**kwargs)

    def _totals(self, location):
        return self.context.get('totals', {}).get(location.id, EMPTY_TOTALS)

    def get_card_count(self, location) -> int:
        return self._totals(location)['card_count']

    def get_value(self, location) -> serializers.DecimalField(**MONEY):
        return self._totals(location)['value']

    def get_values(self, location) -> MoneySerializer:
        return self._totals(location)['values']

    def validate_name(self, value):
        value = value.strip()
        user = self.context['request'].user
        clash = Location.objects.filter(user=user, name__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError('You already have a location with this name.')
        return value


class LocationListSerializer(serializers.Serializer):
    currency = serializers.CharField()
    unfiled = TotalsSerializer()
    cart = TotalsSerializer(help_text='Scanned cards waiting in the cart (not part of the collection)')
    locations = LocationSerializer(many=True)


class LocationDeleteSerializer(serializers.Serializer):
    cards = serializers.ChoiceField(['move', 'unfile', 'delete'], required=False)
    target = serializers.IntegerField(required=False, help_text='Location id for "move"')


# ---------- Items ----------

class PrintingBriefSerializer(serializers.ModelSerializer):
    set_code = serializers.CharField(source='set_id')
    set_name = serializers.CharField(source='set.name')

    class Meta:
        model = Printing
        fields = [
            'id', 'oracle_id', 'name', 'set_code', 'set_name', 'collector_number', 'rarity',
            'colors', 'type_line', 'finishes', 'image_small', 'image_normal', 'image_large',
        ]
        read_only_fields = fields  # output only; also marks them required in the schema


class PublicItemSerializer(serializers.ModelSerializer):
    """What visitors see. Never add purchase or added-price fields here (AC-57)."""

    printing = PrintingBriefSerializer()
    unit_price = serializers.DecimalField(**MONEY, read_only=True)
    unit_prices = serializers.SerializerMethodField(help_text='Market price per copy in every currency')

    class Meta:
        model = CollectionItem
        fields = ['id', 'printing', 'quantity', 'finish', 'condition', 'language', 'unit_price', 'unit_prices']

    def get_unit_prices(self, item) -> MoneySerializer:
        return prices_in_all(item.printing, item.finish, self.context['rates'])


class ItemSerializer(PublicItemSerializer):
    """Owner view of a row. Needs `currency` and `rates` in the context."""

    location = serializers.IntegerField(source='location_id', allow_null=True)
    in_cart = serializers.BooleanField(read_only=True)
    location_name = serializers.CharField(source='location.name', allow_null=True, default=None)
    purchase_price_converted = serializers.SerializerMethodField(
        help_text='Purchase price per copy in the viewer currency')
    added_price = serializers.SerializerMethodField(help_text='Market price per copy when added, viewer currency')
    added_prices = serializers.SerializerMethodField()
    purchase_prices = serializers.SerializerMethodField(help_text='Purchase price converted to every currency')

    class Meta(PublicItemSerializer.Meta):
        fields = PublicItemSerializer.Meta.fields + [
            'location', 'location_name', 'in_cart', 'purchase_price', 'purchase_currency',
            'purchase_price_converted', 'purchase_prices', 'added_price', 'added_prices', 'added_at',
        ]

    def get_purchase_price_converted(self, item) -> serializers.DecimalField(**MONEY):
        return convert(item.purchase_price, item.purchase_currency, self.context['currency'], self.context['rates'])

    def get_added_price(self, item) -> serializers.DecimalField(**MONEY):
        return getattr(item, f"added_{self.context['currency'].lower()}")

    def get_added_prices(self, item) -> MoneySerializer:
        return {currency: getattr(item, f'added_{currency.lower()}') for currency in CURRENCIES}

    def get_purchase_prices(self, item) -> MoneySerializer(allow_null=True):
        return convert_to_all(item.purchase_price, item.purchase_currency, self.context['rates'])


class ItemPageSerializer(serializers.Serializer):
    currency = serializers.CharField()
    prices_updated_at = serializers.DateTimeField(allow_null=True)
    count = serializers.IntegerField(help_text='Matching rows')
    total_quantity = serializers.IntegerField(help_text='Cards in matching rows')
    total_value = serializers.DecimalField(**MONEY)
    total_values = MoneySerializer()
    results = ItemSerializer(many=True)


class PublicItemPageSerializer(ItemPageSerializer):
    results = PublicItemSerializer(many=True)


class BinderPlaceSerializer(serializers.Serializer):
    """A pocket: page, row and column, all from 1."""

    page = serializers.IntegerField(min_value=1, max_value=500)
    row = serializers.IntegerField(min_value=1, max_value=6)
    col = serializers.IntegerField(min_value=1, max_value=6)


class ItemWriteSerializer(serializers.Serializer):
    printing = serializers.PrimaryKeyRelatedField(queryset=Printing.objects.select_related('set'))
    quantity = serializers.IntegerField(min_value=1, max_value=999, default=1)
    finish = serializers.ChoiceField(Finish.choices)
    condition = serializers.ChoiceField(Condition.choices, default=Condition.NEAR_MINT)
    language = serializers.ChoiceField(Language.choices, default=Language.ENGLISH)
    purchase_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False, allow_null=True)
    purchase_currency = serializers.ChoiceField(Currency.choices, required=False, allow_null=True)
    location = serializers.IntegerField(required=False, allow_null=True, help_text='Location id; null = Unfiled')
    slot = BinderPlaceSerializer(required=False, help_text='Binder only: put one new copy in this pocket (spec 007, AC-14)')

    def validate_location(self, value):
        if value is None:
            return None
        location = Location.objects.filter(user=self.context['request'].user, pk=value).first()
        if location is None:
            raise serializers.ValidationError('Unknown location.')
        return location

    def validate(self, attrs):
        if attrs.get('purchase_price') is not None and not attrs.get('purchase_currency'):
            attrs['purchase_currency'] = self.context['request'].user.currency
        if attrs.get('slot') and getattr(attrs.get('location'), 'kind', None) != Location.Kind.BINDER:
            raise serializers.ValidationError({'slot': ['Only binders have slots.']})
        return attrs


class ItemSaveResultSerializer(serializers.Serializer):
    item = ItemSerializer()
    merged = serializers.BooleanField(help_text='True when the row merged into an existing one')


# ---------- Bulk, export, import ----------

class SelectionSerializer(serializers.Serializer):
    """Either explicit ids, or every row matching a filter minus exclusions (AC-39)."""

    ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    filter = ItemFilterSerializer(required=False)
    exclude_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)

    def validate(self, attrs):
        if ('ids' in attrs) == ('filter' in attrs):
            raise serializers.ValidationError('Send either ids or filter.')
        return attrs


class BulkChangesSerializer(serializers.Serializer):
    condition = serializers.ChoiceField(Condition.choices, required=False)
    language = serializers.ChoiceField(Language.choices, required=False)
    finish = serializers.ChoiceField(Finish.choices, required=False)


class BulkRequestSerializer(serializers.Serializer):
    action = serializers.ChoiceField(['move', 'edit', 'delete'])
    selection = SelectionSerializer()
    location = serializers.IntegerField(required=False, allow_null=True, help_text='Target for move; null = Unfiled')
    changes = BulkChangesSerializer(required=False)
    dry_run = serializers.BooleanField(default=False)


class BulkResultSerializer(serializers.Serializer):
    rows = serializers.IntegerField()
    cards = serializers.IntegerField()
    skipped = serializers.IntegerField(help_text='Rows left unchanged (e.g. finish not available)')


class ExportRequestSerializer(serializers.Serializer):
    selection = SelectionSerializer()


class PublicExportRequestSerializer(serializers.Serializer):
    filter = ItemFilterSerializer(required=False)


class ExportResultSerializer(serializers.Serializer):
    text = serializers.CharField()
    rows = serializers.IntegerField()


class ImportRequestSerializer(serializers.Serializer):
    text = serializers.CharField(allow_blank=True, trim_whitespace=False)
    location = serializers.IntegerField(required=False, allow_null=True)
    condition = serializers.ChoiceField(Condition.choices, default=Condition.NEAR_MINT)
    language = serializers.ChoiceField(Language.choices, default=Language.ENGLISH)
    purchase_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False, allow_null=True)
    purchase_currency = serializers.ChoiceField(Currency.choices, required=False, allow_null=True)

    validate_location = ItemWriteSerializer.validate_location
    validate = ItemWriteSerializer.validate


class ImportRowSerializer(serializers.Serializer):
    line = serializers.IntegerField()
    quantity = serializers.IntegerField()
    finish = serializers.CharField()
    printing = PrintingBriefSerializer()


class ImportErrorSerializer(serializers.Serializer):
    line = serializers.IntegerField()
    text = serializers.CharField()
    reason = serializers.CharField()


class ImportPreviewSerializer(serializers.Serializer):
    rows = ImportRowSerializer(many=True)
    errors = ImportErrorSerializer(many=True)
    cards = serializers.IntegerField()


class ImportResultSerializer(serializers.Serializer):
    rows = serializers.IntegerField()
    cards = serializers.IntegerField()


# ---------- Public ----------

class DirectoryUserSerializer(serializers.Serializer):
    username = serializers.CharField()
    public_locations = serializers.IntegerField()
    public_decks = serializers.IntegerField()


class PublicLocationSerializer(serializers.ModelSerializer):
    card_count = serializers.SerializerMethodField()
    value = serializers.SerializerMethodField()
    values = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = ['id', 'name', 'kind', 'card_count', 'value', 'values']

    get_card_count = LocationSerializer.get_card_count
    get_value = LocationSerializer.get_value
    get_values = LocationSerializer.get_values
    _totals = LocationSerializer._totals


class PublicLocationListSerializer(serializers.Serializer):
    currency = serializers.CharField()
    locations = PublicLocationSerializer(many=True)


# ---------- binders (spec 007) ----------

class BinderCursorSerializer(BinderPlaceSerializer):
    """Scan in order: where the next card goes, and which way the scan moves (AC-20)."""

    direction = serializers.ChoiceField(['rows', 'columns'], default='rows')


class BinderSectionSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60)
    first_page = serializers.IntegerField(min_value=1, max_value=500)
    last_page = serializers.IntegerField(min_value=1, max_value=500)
    filter = serializers.DictField(required=False, default=dict,
                                   help_text='Card browser filter keys: color, type, rarity, set, finish, condition, price_min, price_max')

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Name the section.')
        return value

    def validate_filter(self, value):
        from .binder import SECTION_FILTER_KEYS, section_filter
        section_filter(value)  # raises on bad values
        return {k: v for k, v in value.items() if k in SECTION_FILTER_KEYS and v not in (None, '', [])}

    def validate(self, attrs):
        if attrs['last_page'] < attrs['first_page']:
            raise serializers.ValidationError({'last_page': ['The last page comes after the first.']})
        return attrs


class BinderSectionReadSerializer(BinderSectionSerializer):
    matching = serializers.ListField(child=serializers.IntegerField(), allow_null=True, read_only=True,
                                     help_text="Ids of the binder's rows that match the filter; null without one")


class BinderSettingsSerializer(serializers.Serializer):
    rows = serializers.IntegerField(min_value=1, max_value=6, required=False)
    cols = serializers.IntegerField(min_value=1, max_value=6, required=False)
    spread = serializers.BooleanField(required=False)
    pages = serializers.IntegerField(min_value=1, max_value=500, required=False, allow_null=True)
    sections = BinderSectionSerializer(many=True, required=False)

    def validate_sections(self, value):
        from .binder import check_sections
        check_sections(value)
        return value


class BinderSlotSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    item = serializers.IntegerField(source='item_id')
    page = serializers.IntegerField()
    row = serializers.IntegerField()
    col = serializers.IntegerField()
    position = serializers.IntegerField(help_text='Order in a shared pocket; the highest is on top')
    mismatch = serializers.BooleanField(help_text="Outside its section's filter")


class UnplacedSerializer(serializers.Serializer):
    item = serializers.IntegerField()
    count = serializers.IntegerField()


class PublicBinderSerializer(serializers.Serializer):
    rows = serializers.IntegerField()
    cols = serializers.IntegerField()
    spread = serializers.BooleanField()
    pages = serializers.IntegerField(allow_null=True, help_text='Fixed page count, or null')
    page_count = serializers.IntegerField(help_text='Pages to show')
    used = serializers.IntegerField(help_text='Pockets holding a card')
    total = serializers.IntegerField(allow_null=True, help_text='Pockets in a binder with a fixed page count')
    sections = BinderSectionReadSerializer(many=True)
    slots = BinderSlotSerializer(many=True)
    items = PublicItemSerializer(many=True, help_text="The binder's rows")
    unplaced = UnplacedSerializer(many=True)
    currency = serializers.CharField()


class BinderSerializer(PublicBinderSerializer):
    items = ItemSerializer(many=True, help_text="The binder's rows")
    unplaced_now = serializers.IntegerField(required=False, help_text='After a settings change: cards that lost their slot')


class BinderMoveSerializer(serializers.Serializer):
    slot = serializers.IntegerField(required=False, help_text='Move this placed card')
    item = serializers.IntegerField(required=False, help_text="Or place one of this row's unplaced copies")
    to = BinderPlaceSerializer(allow_null=True, help_text='null: back to Unplaced')
    mode = serializers.ChoiceField(['swap', 'share'], default='swap', help_text='When the target slot is taken')

    def validate(self, attrs):
        if ('slot' in attrs) == ('item' in attrs):
            raise serializers.ValidationError('Give a slot or an item.')
        return attrs


class BinderOrderSerializer(BinderPlaceSerializer):
    slots = serializers.ListField(child=serializers.IntegerField(), help_text='Slot ids, top first')
