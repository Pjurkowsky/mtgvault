from rest_framework import serializers

from cards.models import Set
from cards.serializers import PrintingSerializer
from collection.serializers import BinderCursorSerializer, BinderPlaceSerializer, ItemSerializer, TotalsSerializer

from .bundles import REPO_RE
from .models import ScannerSettings, ScannerSource


class ScannerSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScannerSettings
        fields = ['fast', 'sounds', 'ding_low', 'ding_high', 'show_total', 'locked_sets',
                  'glare_hint', 'glare_sensitivity', 'combine_frames', 'suggest_guesses']

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


class InstalledBundleSerializer(serializers.Serializer):
    version = serializers.CharField()
    created = serializers.CharField(help_text='When the bundle was exported (manifest)')


class ScannerSourceSerializer(serializers.ModelSerializer):
    """Where the recognition model comes from (spec 020). Staff only."""

    installed = InstalledBundleSerializer(read_only=True, allow_null=True, source='installed_bundle')

    class Meta:
        model = ScannerSource
        fields = ['kind', 'repo', 'path', 'installed', 'syncing', 'last_sync_at', 'last_error']
        read_only_fields = ['installed', 'syncing', 'last_sync_at', 'last_error']

    def validate(self, attrs):
        kind = attrs.get('kind', getattr(self.instance, 'kind', ScannerSource.GITHUB))
        if kind == ScannerSource.GITHUB:
            repo = (attrs.get('repo') or '').strip() or ScannerSource.DEFAULT_REPO
            if not REPO_RE.match(repo):
                raise serializers.ValidationError({'repo': 'Use owner/name, for example cfbender/manavault.'})
            attrs['repo'] = repo
        else:
            path = (attrs.get('path') or '').strip()
            if not path.startswith('/'):
                raise serializers.ValidationError({'path': 'Enter an absolute path on the server, for example /srv/mtgvault-bundles.'})
            attrs['path'] = path
        return attrs


class ScannerSourceRequestSerializer(serializers.Serializer):
    """What staff send when saving the source (schema only; validated by ScannerSourceSerializer)."""

    kind = serializers.ChoiceField(ScannerSource.KINDS)
    repo = serializers.CharField(required=False, allow_blank=True, help_text='owner/name, for GitHub releases')
    path = serializers.CharField(required=False, allow_blank=True, help_text='Absolute folder of bundles on the server')


class BundleInfoSerializer(serializers.Serializer):
    version = serializers.CharField()
    created = serializers.CharField()
    gallery = serializers.DictField()
    constants = serializers.DictField()
    files = serializers.DictField(child=serializers.CharField())
    sizes = serializers.DictField(child=serializers.IntegerField())


class ScanTargetSerializer(serializers.Serializer):
    """Where scans go (spec 005, AC-16). Without one they go to the cart (spec 003)."""

    kind = serializers.ChoiceField(['cart', 'location', 'deck'])
    location = serializers.IntegerField(required=False, allow_null=True, help_text='kind=location: id, or null for Unfiled')
    deck = serializers.IntegerField(required=False, help_text='kind=deck: the decklist (no copy is added)')
    binder = BinderCursorSerializer(required=False, help_text='kind=location, a binder: scan in order from here (spec 007, AC-20)')

    def validate(self, data):
        if data['kind'] == 'deck' and not data.get('deck'):
            raise serializers.ValidationError({'deck': ['Choose a deck.']})
        return data


class ScanRequestSerializer(serializers.Serializer):
    gallery_id = serializers.CharField(max_length=60, help_text='Gallery art id from arts.json')
    illustration_id = serializers.UUIDField(required=False, allow_null=True)
    target = ScanTargetSerializer(required=False)


class ScannedDeckCardSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    deck = serializers.IntegerField()
    quantity = serializers.IntegerField()
    printing = PrintingSerializer()
    price = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)


class ScannedSlotSerializer(BinderPlaceSerializer):
    id = serializers.IntegerField()


class UndoRequestSerializer(serializers.Serializer):
    slot = serializers.IntegerField(required=False, help_text="Scan in order: free this pocket too (spec 007, AC-22)")


class ScanResultSerializer(serializers.Serializer):
    item = ItemSerializer(allow_null=True, help_text='The collection row (null for a decklist-only scan)')
    deck_card = ScannedDeckCardSerializer(allow_null=True, help_text='Decklist-only scans: the deck card')
    merged = serializers.BooleanField()
    totals = TotalsSerializer(help_text='Totals of where the card went: cart, location or deck')
    sound = serializers.ChoiceField(['click', 'ding', 'big_ding'], help_text='Which sound fits the price')
    slot = ScannedSlotSerializer(allow_null=True, default=None, help_text='Scan in order: the pocket the copy went to')
    binder_full = serializers.BooleanField(default=False, help_text='Scan in order found no free pocket (AC-23)')


class UndoResultSerializer(serializers.Serializer):
    remaining = serializers.IntegerField(help_text='Copies left in the row (0 = removed)')
    totals = TotalsSerializer(help_text="Totals of the row's cart or location")


class LockedIllustrationsSerializer(serializers.Serializer):
    sets = serializers.ListField(child=serializers.CharField())
    illustration_ids = serializers.ListField(child=serializers.UUIDField())
