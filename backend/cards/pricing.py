"""Card prices in USD, EUR or PLN, and conversion between currencies.

USD and EUR come from Scryfall (TCGplayer and Cardmarket). PLN is the EUR
price times the latest NBP EUR rate, so it's an estimate (spec 001, AC-3).
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Case, DecimalField, F, Value, When
from django.db.models.functions import Round

from .models import ExchangeRate, Finish, SyncRun

CURRENCIES = ('USD', 'EUR', 'PLN')
CENT = Decimal('0.01')
MONEY = DecimalField(max_digits=12, decimal_places=2)


def latest_rates() -> dict[str, Decimal]:
    """PLN value of one unit of each currency, from the newest NBP rates."""
    rates = {'PLN': Decimal(1)}
    for currency in ('EUR', 'USD'):
        rate = (
            ExchangeRate.objects.filter(currency=currency)
            .order_by('-effective_date')
            .values_list('rate_to_pln', flat=True)
            .first()
        )
        if rate is not None:
            rates[currency] = rate
    return rates


def prices_updated_at():
    run = (
        SyncRun.objects.filter(kind=SyncRun.Kind.CARDS, status=SyncRun.Status.SUCCESS)
        .order_by('-finished_at')
        .first()
    )
    return run.finished_at if run else None


def _column(finish: str, currency: str) -> str:
    """Printing column holding the price: usd, eur_foil, usd_etched, ..."""
    base = 'eur' if currency == 'PLN' else currency.lower()
    return base if finish == Finish.NONFOIL else f'{base}_{finish}'


def price(printing, finish: str, currency: str, rates: dict) -> Decimal | None:
    value = getattr(printing, _column(finish, currency))
    if value is None:
        return None
    if currency == 'PLN':
        if 'EUR' not in rates:
            return None
        return (value * rates['EUR']).quantize(CENT, ROUND_HALF_UP)
    return value


def price_expression(currency: str, rates: dict, finish_field='finish', printing_path='printing__'):
    """Same rule as price(), as SQL, for sorting, filtering and totals."""
    expression = Case(
        *[
            When(**{finish_field: finish}, then=F(printing_path + _column(finish, currency)))
            for finish in Finish.values
        ],
        output_field=MONEY,
    )
    if currency == 'PLN':
        if 'EUR' not in rates:
            return Value(None, output_field=MONEY)
        return Round(expression * Value(rates['EUR'], output_field=MONEY), 2, output_field=MONEY)
    return expression


def convert(amount: Decimal | None, source: str, target: str, rates: dict) -> Decimal | None:
    """Convert through PLN with the latest rates. None if a rate is missing."""
    if amount is None or source == target:
        return amount
    if source not in rates or target not in rates:
        return None
    return (amount * rates[source] / rates[target]).quantize(CENT, ROUND_HALF_UP)


def prices_in_all(printing, finish: str, rates: dict) -> dict:
    """{'USD': .., 'EUR': .., 'PLN': ..} for one printing and finish."""
    return {currency: price(printing, finish, currency, rates) for currency in CURRENCIES}


def convert_to_all(amount, source: str | None, rates: dict) -> dict | None:
    if amount is None or source is None:
        return None
    return {currency: convert(amount, source, currency, rates) for currency in CURRENCIES}
