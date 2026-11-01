from rest_framework import serializers

from cards.models import Finish, Printing
from cards.pricing import convert
from users.models import Currency

from .filters import ItemFilterSerializer
from .models import CollectionItem, Condition, Language, Location

MONEY = dict(max_digits=12, decimal_places=2, allow_null=True)


# ---------- Locations ----------

class TotalsSerializer(serializers.Serializer):
    card_count = serializers.IntegerField()
    value = serializers.DecimalField(**MONEY)


class LocationSerializer(serializers.ModelSerializer):
    """Owner view of a location. Totals come from the view (context['totals'])."""

    card_count = serializers.SerializerMethodField()
    value = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = ['id', 'name', 'kind', 'is_public', 'card_count', 'value', 'created_at']
        read_only_fields = ['id', 'created_at']

    def _totals(self, location):
        return self.context.get('totals', {}).get(location.id, {'card_count': 0, 'value': None})

    def get_card_count(self, location) -> int:
        return self._totals(location)['card_count']

    def get_value(self, location) -> serializers.DecimalField(**MONEY):
        return self._totals(location)['value']

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

    class Meta:
        model = CollectionItem
        fields = ['id', 'printing', 'quantity', 'finish', 'condition', 'language', 'unit_price']


class ItemSerializer(PublicItemSerializer):
    """Owner view of a row. Needs `currency` and `rates` in the context."""

    location = serializers.IntegerField(source='location_id', allow_null=True)
    location_name = serializers.CharField(source='location.name', allow_null=True, default=None)
    purchase_price_converted = serializers.SerializerMethodField(
        help_text='Purchase price per copy in the viewer currency')
    added_price = serializers.SerializerMethodField(help_text='Market price per copy when added, viewer currency')

    class Meta(PublicItemSerializer.Meta):
        fields = PublicItemSerializer.Meta.fields + [
            'location', 'location_name', 'purchase_price', 'purchase_currency',
            'purchase_price_converted', 'added_price', 'added_at',
        ]

    def get_purchase_price_converted(self, item) -> serializers.DecimalField(**MONEY):
        return convert(item.purchase_price, item.purchase_currency, self.context['currency'], self.context['rates'])

    def get_added_price(self, item) -> serializers.DecimalField(**MONEY):
        return getattr(item, f"added_{self.context['currency'].lower()}")


class ItemPageSerializer(serializers.Serializer):
    currency = serializers.CharField()
    prices_updated_at = serializers.DateTimeField(allow_null=True)
    count = serializers.IntegerField(help_text='Matching rows')
    total_quantity = serializers.IntegerField(help_text='Cards in matching rows')
    total_value = serializers.DecimalField(**MONEY)
    results = ItemSerializer(many=True)


class PublicItemPageSerializer(ItemPageSerializer):
    results = PublicItemSerializer(many=True)


class ItemWriteSerializer(serializers.Serializer):
    printing = serializers.PrimaryKeyRelatedField(queryset=Printing.objects.select_related('set'))
    quantity = serializers.IntegerField(min_value=1, max_value=999, default=1)
    finish = serializers.ChoiceField(Finish.choices)
    condition = serializers.ChoiceField(Condition.choices, default=Condition.NEAR_MINT)
    language = serializers.ChoiceField(Language.choices, default=Language.ENGLISH)
    purchase_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False, allow_null=True)
    purchase_currency = serializers.ChoiceField(Currency.choices, required=False, allow_null=True)
    location = serializers.IntegerField(required=False, allow_null=True, help_text='Location id; null = Unfiled')

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


class PublicLocationSerializer(serializers.ModelSerializer):
    card_count = serializers.SerializerMethodField()
    value = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = ['id', 'name', 'kind', 'card_count', 'value']

    get_card_count = LocationSerializer.get_card_count
    get_value = LocationSerializer.get_value
    _totals = LocationSerializer._totals


class PublicLocationListSerializer(serializers.Serializer):
    currency = serializers.CharField()
    locations = PublicLocationSerializer(many=True)
