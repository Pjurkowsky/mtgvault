from rest_framework import serializers

from cards.models import Set
from collection.serializers import ItemSerializer, TotalsSerializer

from .models import ScannerSettings


class ScannerSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScannerSettings
        fields = ['fast', 'sounds', 'ding_low', 'ding_high', 'show_total', 'locked_sets']

    def validate_locked_sets(self, value):
        codes = sorted({code.lower() for code in value})
        known = set(Set.objects.filter(code__in=codes).values_list('code', flat=True))
        if unknown := [c for c in codes if c not in known]:
            raise serializers.ValidationError(f'Unknown sets: {", ".join(unknown)}')
        return codes

    def validate(self, attrs):
        low = attrs.get('ding_low', getattr(self.instance, 'ding_low', None))
        high = attrs.get('ding_high', getattr(self.instance, 'ding_high', None))
        if low is not None and high is not None and high < low:
            raise serializers.ValidationError({'ding_high': ['Must be at least the low threshold.']})
        return attrs


class BundleInfoSerializer(serializers.Serializer):
    version = serializers.CharField()
    created = serializers.CharField()
    gallery = serializers.DictField()
    constants = serializers.DictField()
    files = serializers.DictField(child=serializers.CharField())
    sizes = serializers.DictField(child=serializers.IntegerField())


class ScanRequestSerializer(serializers.Serializer):
    gallery_id = serializers.CharField(max_length=60, help_text='Gallery art id from arts.json')
    illustration_id = serializers.UUIDField(required=False, allow_null=True)


class ScanResultSerializer(serializers.Serializer):
    item = ItemSerializer()
    merged = serializers.BooleanField()
    cart = TotalsSerializer()
    sound = serializers.ChoiceField(['click', 'ding', 'big_ding'], help_text='Which sound fits the price')


class UndoResultSerializer(serializers.Serializer):
    remaining = serializers.IntegerField(help_text='Copies left in the row (0 = removed)')
    cart = TotalsSerializer()


class LockedIllustrationsSerializer(serializers.Serializer):
    sets = serializers.ListField(child=serializers.CharField())
    illustration_ids = serializers.ListField(child=serializers.UUIDField())
