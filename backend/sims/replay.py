"""A finished game, turn by turn, for the replay page (spec 024, AC-23 to AC-28)."""

import gzip
import json

from cards.models import Token

from .models import SimGame
from .services import commanders, printings_by_name

# Log entries that aren't events of a turn: the turn line is the group, the rest repeat it.
HIDDEN = {'TURN', 'MATCH_RESULTS', 'PLAYER_CONTROL'}


def remap_board(board: list[dict], order: list[int]) -> list[dict]:
    """Runner seats (turn order) -> run seats."""
    out: list[dict | None] = [None] * len(order)
    for runner_seat, seat in enumerate(board):
        seat = dict(seat)
        seat['battlefield'] = [{**c, 'owner': order[c['owner']]} if 'owner' in c else c for c in seat['battlefield']]
        out[order[runner_seat]] = seat
    return out


def card_images(names: set[str]) -> dict:
    """Name -> images: the newest printing, or a token by name ("Treasure Token" -> Treasure)."""
    found = printings_by_name(names)
    out = {n: {'image_small': p.image_small, 'image_normal': p.image_normal} for n, p in found.items()}
    tokens = {n: n.removesuffix(' Token') for n in names - set(found)}
    for t in Token.objects.filter(name__in=set(tokens.values())).order_by('-released_at').values('name', 'image_small', 'image_normal'):
        for name, short in tokens.items():
            if short == t['name'] and name not in out:
                out[name] = {'image_small': t['image_small'], 'image_normal': t['image_normal']}
    return out


def build(game: SimGame) -> dict:
    data = json.loads(gzip.decompress(bytes(game.replay))) if game.replay else {'steps': [], 'log': []}
    order = game.seat_order
    seats = {s.index: s for s in game.run.seats.all()}
    boards: list[list[dict]] = []
    turns: list[dict] = []
    own: dict[int, int] = {}
    names: set[str] = set()

    def turn_group(number: int, active):
        if turns and turns[-1]['number'] == number:
            return turns[-1]
        seat = order[active] if active is not None else None
        if seat is not None and number > 0:
            own[seat] = own.get(seat, 0) + 1
        group = {'number': number, 'active': seat, 'own_turn': own.get(seat) if number > 0 else None, 'events': []}
        turns.append(group)
        return group

    for step in data['steps']:
        group = turn_group(step.get('turn') or 0, step.get('active'))
        if 'board' in step:
            board = remap_board(step['board'], order)
            boards.append(board)
            for seat in board:
                for zone in ('battlefield', 'graveyard', 'exile', 'command'):
                    names.update(c['name'] for c in seat[zone])
        if step.get('type') in HIDDEN:
            continue
        group['events'].append({'type': step['type'], 'text': step['text'], 'board': max(len(boards) - 1, 0)})
    # A turn with no events still needs a board: the one it started with.
    last = 0
    for group in turns:
        if group['events']:
            last = group['events'][-1]['board']
        group['board'] = group['events'][-1]['board'] if group['events'] else last

    players = [{
        'seat': i, 'label': s.label, 'owner': s.owner, 'profile': s.profile, 'commanders': commanders(s.cards),
        'lost_on': game.lost_on.get(str(i)),
    } for i, s in sorted(seats.items())]
    for p in players:
        names.update(p['commanders'])
    return {
        'number': game.number, 'status': game.status, 'turn': game.turn, 'winner_seat': game.winner_seat,
        'winner_turn': game.winner_turn, 'seat_order': order, 'error': game.error,
        'players': players, 'turns': turns, 'boards': boards, 'cards': card_images(names), 'log': data['log'],
    }
