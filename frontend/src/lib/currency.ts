import type { Schemas } from '@/api/client'

export type Currency = Schemas['CurrencyEnum']

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'PLN', label: 'Polish Złoty (PLN)' },
]

export const PLN_NOTE = 'PLN prices are estimates, converted from EUR at the daily NBP rate.'
