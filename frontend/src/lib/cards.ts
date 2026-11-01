import { BookOpenIcon, PackageIcon, SquareStackIcon } from '@lucide/vue'
import type { Schemas } from '@/api/client'

export type LocationKind = Schemas['LocationKindEnum']
export type Finish = Schemas['FinishEnum']
export type Condition = Schemas['ConditionEnum']
export type Language = Schemas['LanguageEnum']
export type Rarity = Schemas['RarityEnum']

export const KINDS: { value: LocationKind; label: string; icon: unknown }[] = [
  { value: 'binder', label: 'Binder', icon: BookOpenIcon },
  { value: 'box', label: 'Box', icon: PackageIcon },
  { value: 'deck_box', label: 'Deck box', icon: SquareStackIcon },
]
export const kindOf = (value: string | null | undefined) => KINDS.find((k) => k.value === value)

export const FINISHES: { value: Finish; label: string }[] = [
  { value: 'nonfoil', label: 'Nonfoil' },
  { value: 'foil', label: 'Foil' },
  { value: 'etched', label: 'Etched' },
]

export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'NM', label: 'Near Mint' },
  { value: 'LP', label: 'Lightly Played' },
  { value: 'MP', label: 'Moderately Played' },
  { value: 'HP', label: 'Heavily Played' },
  { value: 'DMG', label: 'Damaged' },
]

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ru', label: 'Russian' },
  { value: 'zhs', label: 'Simplified Chinese' },
  { value: 'zht', label: 'Traditional Chinese' },
  { value: 'he', label: 'Hebrew' },
  { value: 'la', label: 'Latin' },
  { value: 'grc', label: 'Ancient Greek' },
  { value: 'ar', label: 'Arabic' },
  { value: 'sa', label: 'Sanskrit' },
  { value: 'ph', label: 'Phyrexian' },
  { value: 'qya', label: 'Quenya' },
]

export const RARITIES: { value: Rarity; label: string }[] = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'mythic', label: 'Mythic' },
  { value: 'special', label: 'Special' },
  { value: 'bonus', label: 'Bonus' },
]

export const COLORS = [
  { value: 'W', label: 'White' },
  { value: 'U', label: 'Blue' },
  { value: 'B', label: 'Black' },
  { value: 'R', label: 'Red' },
  { value: 'G', label: 'Green' },
  { value: 'C', label: 'Colorless' },
] as const

export const TYPES = ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Land', 'Planeswalker', 'Sorcery'] as const

export const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'set', label: 'Set' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'price', label: 'Price' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'added', label: 'Date added' },
  { value: 'color', label: 'Color' },
  { value: 'mana_value', label: 'Mana value' },
] as const

export const labelOf = (list: readonly { value: string; label: string }[], value: string | null | undefined) =>
  list.find((x) => x.value === value)?.label ?? value ?? ''
