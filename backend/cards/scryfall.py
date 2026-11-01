"""Turn Scryfall card objects into our Set and Printing fields."""

from datetime import date
from decimal import Decimal

# Things nobody owns in paper, or that later specs cover.
SKIPPED_LAYOUTS = {'token', 'double_faced_token', 'emblem', 'art_series'}

CARD_TYPES = {
    'Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant',
    'Kindred', 'Land', 'Planeswalker', 'Sorcery', 'Tribal',
}

PRICE_FIELDS = ['usd', 'usd_foil', 'usd_etched', 'eur', 'eur_foil', 'eur_etched']


def should_skip(card: dict) -> bool:
    if card.get('digital', False) or card.get('layout') in SKIPPED_LAYOUTS:
        return True
    # Some tokens use a normal or double-sided layout (Role tokens, Spacecraft Illusion).
    front = (card.get('card_faces') or [{}])[0]
    type_line = front.get('type_line') or card.get('type_line', '')
    return type_line.startswith('Token')


def card_types(type_line: str) -> list[str]:
    """'Legendary Creature — Elf Druid' -> ['Creature']."""
    before_dash = type_line.split('—')[0]
    return [word for word in before_dash.split() if word in CARD_TYPES]


def _decimal(value) -> Decimal | None:
    return Decimal(value) if value not in (None, '') else None


def set_fields(card: dict) -> dict:
    return {
        'code': card['set'],
        'name': card['set_name'],
        'set_type': card.get('set_type', ''),
    }


def printing_fields(card: dict) -> dict:
    # Double-faced cards keep images, colors and costs on their faces.
    front = (card.get('card_faces') or [{}])[0]
    images = card.get('image_uris') or front.get('image_uris') or {}
    colors = card.get('colors')
    if colors is None:
        colors = front.get('colors', [])
    front_type_line = front.get('type_line') or card.get('type_line', '')
    prices = card.get('prices') or {}

    return {
        'id': card['id'],
        'oracle_id': card.get('oracle_id') or front.get('oracle_id'),
        'name': card['name'],
        'front_name': front.get('name') or card['name'],
        'set_id': card['set'],
        'collector_number': card['collector_number'],
        'lang': card.get('lang', 'en'),
        'released_at': date.fromisoformat(card['released_at']),
        'rarity': card['rarity'],
        'colors': colors,
        'types': card_types(front_type_line),
        'type_line': card.get('type_line') or front_type_line,
        'mana_cost': card.get('mana_cost') or front.get('mana_cost', ''),
        'cmc': Decimal(str(card.get('cmc', 0))),
        'finishes': card.get('finishes', []),
        'image_small': images.get('small', ''),
        'image_normal': images.get('normal', ''),
        'image_large': images.get('large', ''),
        **{field: _decimal(prices.get(field)) for field in PRICE_FIELDS},
    }
