from rest_framework import serializers

from .models import SimGame, SimRun
from .services import PROFILES, can_cancel, commanders, printings_by_name


def art(name: str | None, found: dict) -> str:
    p = found.get(name) if name else None
    return p.image_normal.replace('/normal/', '/art_crop/') if p and p.image_normal else ''


class StatusSerializer(serializers.Serializer):
    available = serializers.BooleanField()
    version = serializers.CharField()


class CardRowSerializer(serializers.Serializer):
    name = serializers.CharField()
    quantity = serializers.IntegerField()
    commander = serializers.BooleanField()


class SeatSpecSerializer(serializers.Serializer):
    deck = serializers.IntegerField(required=False, allow_null=True)
    pool = serializers.IntegerField(required=False, allow_null=True)
    profile = serializers.ChoiceField(choices=PROFILES, default='Default')

    def validate(self, attrs):
        if bool(attrs.get('deck')) == bool(attrs.get('pool')):
            raise serializers.ValidationError('A seat is a deck or a pool deck.')
        return attrs


class PodSerializer(serializers.Serializer):
    seats = SeatSpecSerializer(many=True)


class StartRunSerializer(PodSerializer):
    """Seat 0 is the tested deck (spec 025, AC-3)."""
    games = serializers.IntegerField(min_value=1, default=10)
    minutes = serializers.IntegerField(min_value=1, default=5)
    seat_mode = serializers.ChoiceField(choices=SimRun.SeatMode.choices, default=SimRun.SeatMode.ROTATE)
    # Fixed mode: seat indexes in turn order; seat 0 is the tested deck.
    order = serializers.ListField(child=serializers.IntegerField(min_value=0), required=False)


class UnsupportedCardSerializer(serializers.Serializer):
    name = serializers.CharField()
    swap = serializers.CharField(allow_null=True)


class SeatCheckSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    label = serializers.CharField()
    source = serializers.CharField()
    id = serializers.IntegerField()
    unsupported = UnsupportedCardSerializer(many=True)


class SwapSerializer(serializers.Serializer):
    # `from` is a keyword, so the field is declared below.
    to = serializers.CharField(max_length=300)


SwapSerializer._declared_fields['from'] = serializers.CharField(max_length=300)


class SaveSwapsSerializer(serializers.Serializer):
    deck = serializers.IntegerField(required=False, allow_null=True)
    pool = serializers.IntegerField(required=False, allow_null=True)
    swaps = SwapSerializer(many=True)


class SuggestionSerializer(serializers.Serializer):
    name = serializers.CharField()
    image_small = serializers.CharField()
    image_normal = serializers.CharField()


class OpponentSerializer(serializers.Serializer):
    """A deck for an opponent seat: a pool deck or a player's deck (AC-4, AC-10)."""
    id = serializers.IntegerField()
    source = serializers.ChoiceField(choices=['deck', 'pool'])
    name = serializers.CharField()
    commanders = serializers.ListField(child=serializers.CharField())
    image = serializers.CharField()
    owner = serializers.CharField()
    precon = serializers.BooleanField()


class OpponentsSerializer(serializers.Serializer):
    pool = OpponentSerializer(many=True)
    mine = OpponentSerializer(many=True)
    public = OpponentSerializer(many=True)


class PoolDeckWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    deck = serializers.IntegerField(required=False)
    text = serializers.CharField(required=False, max_length=20000)

    def validate(self, attrs):
        if bool(attrs.get('deck')) == bool(attrs.get('text')):
            raise serializers.ValidationError('Add a deck or a list.')
        if attrs.get('text') and not attrs.get('name', '').strip():
            raise serializers.ValidationError({'name': 'Give the list a name.'})
        return attrs


class PoolDeckRenameSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)


class SeatSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    label = serializers.CharField()
    owner = serializers.CharField()
    source = serializers.CharField()
    source_id = serializers.IntegerField(allow_null=True)
    profile = serializers.CharField()
    commanders = serializers.ListField(child=serializers.CharField())
    image = serializers.CharField()
    cards = CardRowSerializer(many=True)


class GameSerializer(serializers.Serializer):
    number = serializers.IntegerField()
    status = serializers.ChoiceField(choices=SimGame.Status.choices)
    winner_seat = serializers.IntegerField(allow_null=True)
    turn = serializers.IntegerField()
    winner_turn = serializers.IntegerField(allow_null=True)
    seat_order = serializers.ListField(child=serializers.IntegerField())
    error = serializers.CharField()


class SeatStatsSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    wins = serializers.IntegerField()
    draws = serializers.IntegerField()
    avg_win_turn = serializers.FloatField(allow_null=True)
    went_first = serializers.IntegerField()


class RunStatsSerializer(serializers.Serializer):
    finished = serializers.IntegerField()
    wins = serializers.IntegerField()
    win_rate = serializers.FloatField(allow_null=True)
    avg_win_turn = serializers.FloatField(allow_null=True)
    seats = SeatStatsSerializer(many=True)


class RunSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    deck = serializers.IntegerField(allow_null=True, help_text='The tested deck; null for a pool deck')
    deck_name = serializers.CharField()
    user = serializers.CharField()
    mine = serializers.BooleanField()
    can_cancel = serializers.BooleanField()
    status = serializers.ChoiceField(choices=SimRun.Status.choices)
    cancelling = serializers.BooleanField()
    cancelled_by = serializers.CharField(allow_null=True, help_text='The admin who cancelled it; null when the runner did (spec 025, AC-15)')
    games = serializers.IntegerField()
    minutes = serializers.IntegerField()
    seat_mode = serializers.ChoiceField(choices=SimRun.SeatMode.choices)
    fixed_order = serializers.ListField(child=serializers.IntegerField())
    played = serializers.IntegerField()
    error = serializers.CharField()
    created_at = serializers.DateTimeField()
    started_at = serializers.DateTimeField(allow_null=True)
    finished_at = serializers.DateTimeField(allow_null=True)
    seats = SeatSerializer(many=True)
    stats = RunStatsSerializer()
    results = GameSerializer(many=True)


class QueueEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    deck_name = serializers.CharField(help_text='"Private deck" when the user can\'t see the run (spec 025, AC-11)')
    user = serializers.CharField()
    mine = serializers.BooleanField()
    visible = serializers.BooleanField()
    can_cancel = serializers.BooleanField()
    status = serializers.ChoiceField(choices=SimRun.Status.choices)
    played = serializers.IntegerField()
    games = serializers.IntegerField()


class RunRowSeatSerializer(serializers.Serializer):
    label = serializers.CharField()
    commanders = serializers.ListField(child=serializers.CharField())
    image = serializers.CharField()


class RunRowSerializer(serializers.Serializer):
    """A run in the list (spec 025, AC-6)."""
    id = serializers.IntegerField()
    user = serializers.CharField()
    mine = serializers.BooleanField()
    status = serializers.ChoiceField(choices=SimRun.Status.choices)
    cancelling = serializers.BooleanField()
    cancelled_by = serializers.CharField(allow_null=True)
    played = serializers.IntegerField()
    games = serializers.IntegerField()
    win_rate = serializers.FloatField(allow_null=True)
    created_at = serializers.DateTimeField()
    tested = RunRowSeatSerializer()
    opponents = RunRowSeatSerializer(many=True)


class RunPageSerializer(serializers.Serializer):
    results = RunRowSerializer(many=True)
    total = serializers.IntegerField()


class ReplayPlayerSerializer(serializers.Serializer):
    seat = serializers.IntegerField()
    label = serializers.CharField()
    owner = serializers.CharField()
    profile = serializers.CharField()
    commanders = serializers.ListField(child=serializers.CharField())
    lost_on = serializers.IntegerField(allow_null=True)


class ReplayEventSerializer(serializers.Serializer):
    type = serializers.CharField()
    text = serializers.CharField()
    board = serializers.IntegerField()


class ReplayTurnSerializer(serializers.Serializer):
    number = serializers.IntegerField()
    active = serializers.IntegerField(allow_null=True)
    own_turn = serializers.IntegerField(allow_null=True)
    board = serializers.IntegerField()
    events = ReplayEventSerializer(many=True)


class BoardCardSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    row = serializers.ChoiceField(choices=['creature', 'land', 'other'], required=False)
    tapped = serializers.BooleanField(required=False)
    token = serializers.BooleanField(required=False)
    power = serializers.IntegerField(required=False)
    toughness = serializers.IntegerField(required=False)
    counters = serializers.DictField(child=serializers.IntegerField(), required=False)
    attached_to = serializers.IntegerField(required=False)
    owner = serializers.IntegerField(required=False)


class BoardSeatSerializer(serializers.Serializer):
    life = serializers.IntegerField()
    lost = serializers.BooleanField()
    hand = serializers.IntegerField()
    library = serializers.IntegerField()
    battlefield = BoardCardSerializer(many=True)
    graveyard = BoardCardSerializer(many=True)
    exile = BoardCardSerializer(many=True)
    command = BoardCardSerializer(many=True)


class CardImageSerializer(serializers.Serializer):
    image_small = serializers.CharField()
    image_normal = serializers.CharField()


class ReplaySerializer(serializers.Serializer):
    run = RunSerializer()
    number = serializers.IntegerField()
    status = serializers.CharField()
    turn = serializers.IntegerField()
    winner_seat = serializers.IntegerField(allow_null=True)
    winner_turn = serializers.IntegerField(allow_null=True)
    seat_order = serializers.ListField(child=serializers.IntegerField())
    error = serializers.CharField()
    players = ReplayPlayerSerializer(many=True)
    turns = ReplayTurnSerializer(many=True)
    boards = serializers.ListField(child=BoardSeatSerializer(many=True))
    cards = serializers.DictField(child=CardImageSerializer())
    log = serializers.ListField(child=serializers.CharField())


# Plain data -----------------------------------------------------------------

def average(values: list[int]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


def run_stats(run: SimRun, games: list[SimGame], seats: int) -> dict:
    """AC-19, AC-20: failed games don't count; draws count in the total but aren't wins."""
    finished = [g for g in games if g.status != SimGame.Status.FAILED]
    per_seat = []
    for i in range(seats):
        won = [g for g in finished if g.winner_seat == i]
        per_seat.append({
            'index': i, 'wins': len(won), 'draws': sum(1 for g in finished if g.status == SimGame.Status.DRAW),
            'avg_win_turn': average([g.winner_turn for g in won if g.winner_turn]),
            'went_first': sum(1 for g in finished if g.seat_order and g.seat_order[0] == i),
        })
    me = per_seat[0] if per_seat else {'wins': 0, 'avg_win_turn': None}
    return {'finished': len(finished), 'wins': me['wins'],
            'win_rate': round(me['wins'] / len(finished), 4) if finished else None,
            'avg_win_turn': me['avg_win_turn'], 'seats': per_seat}


def cancelled_by(run: SimRun) -> str | None:
    """An admin's name when someone other than the runner cancelled (spec 025, AC-15)."""
    if run.cancelled_by_id and run.cancelled_by_id != run.user_id:
        return run.cancelled_by.username
    return None


def row_data(run: SimRun, user, found: dict) -> dict:
    """A list row; `run` comes with seats and games prefetched."""
    seats = list(run.seats.all())
    games = [g for g in run.played.all() if g.status != SimGame.Status.FAILED]
    wins = sum(1 for g in games if g.winner_seat == 0)

    def seat(s) -> dict:
        names = commanders(s.cards)
        return {'label': s.label, 'commanders': names, 'image': art(next(iter(names), None), found)}

    return {
        'id': run.id, 'user': run.user.username, 'mine': run.user_id == user.id, 'status': run.status,
        'cancelling': run.cancel_requested and run.status == SimRun.Status.PLAYING, 'cancelled_by': cancelled_by(run),
        'played': len(run.played.all()), 'games': run.games, 'win_rate': round(wins / len(games), 4) if games else None,
        'created_at': run.created_at, 'tested': seat(seats[0]), 'opponents': [seat(s) for s in seats[1:]],
    }


def run_data(run: SimRun, user) -> dict:
    seats = list(run.seats.all())
    games = list(run.played.defer('replay'))
    found = printings_by_name([n for s in seats for n in commanders(s.cards)])
    return {
        'id': run.id, 'deck': run.deck_id, 'deck_name': seats[0].label if seats else '', 'user': run.user.username,
        'mine': user.is_authenticated and run.user_id == user.id, 'can_cancel': can_cancel(user, run), 'status': run.status,
        'cancelling': run.cancel_requested and run.status == SimRun.Status.PLAYING, 'cancelled_by': cancelled_by(run),
        'games': run.games, 'minutes': run.minutes, 'seat_mode': run.seat_mode, 'fixed_order': run.fixed_order, 'played': len(games), 'error': run.error,
        'created_at': run.created_at, 'started_at': run.started_at, 'finished_at': run.finished_at,
        'seats': [{'index': s.index, 'label': s.label, 'owner': s.owner, 'source': s.source, 'source_id': s.source_id,
                   'profile': s.profile, 'commanders': commanders(s.cards),
                   'image': art(next(iter(commanders(s.cards)), None), found), 'cards': s.cards} for s in seats],
        'stats': run_stats(run, games, len(seats)),
        'results': [{'number': g.number, 'status': g.status, 'winner_seat': g.winner_seat, 'turn': g.turn,
                     'winner_turn': g.winner_turn, 'seat_order': g.seat_order, 'error': g.error} for g in games],
    }
