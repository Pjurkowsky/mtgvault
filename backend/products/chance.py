"""Chance that one booster holds at least one of some printings (spec 030, AC-4, AC-10)."""


def pack_chance(layouts, sheets, wanted) -> float:
    """`layouts`: [(weight, {sheet: count})]; `sheets`: {sheet: (total weight, fixed)};
    `wanted`: {sheet: summed weight of the wanted printings on it}.

    Per layout, no wanted card is (1 - w/W)^count per sheet; a fixed sheet gives all its cards.
    Packs never repeat a card within a slot, which this ignores (it slightly understates).
    """
    total = sum(w for w, _ in layouts)
    if not total:
        return 0.0
    none = 0.0
    for weight, slots in layouts:
        p_none = 1.0
        for sheet, count in slots.items():
            hit = wanted.get(sheet, 0)
            if not hit:
                continue
            sheet_total, fixed = sheets[sheet]
            if fixed:
                p_none = 0.0
                break
            p_none *= (1 - min(1.0, hit / sheet_total)) ** count
        none += weight * p_none
    return max(0.0, min(1.0, 1 - none / total))
