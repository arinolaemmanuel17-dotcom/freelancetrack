import type { AppData, Settings } from './types'

const KEY = 'freelance-tracker-v1'

export const DEFAULT_SETTINGS: Settings = {
  baseCurrency: 'USD',
  currencies: ['USD', 'EUR', 'GBP', 'NGN'],
  services: ['Service A', 'Service B', 'Other'],
  platforms: ['Direct', 'Referral', 'Marketplace'],
  methods: ['Bank', 'Cash', 'Card', 'Other'],
  outreachGapDays: 3,
}

export const EMPTY_DATA: AppData = {
  clients: [],
  orders: [],
  payments: [],
  days: [],
  settings: DEFAULT_SETTINGS,
}

// Local-only storage for now. Replace these two functions with a database
// (Supabase) once login is added, without touching the screens.
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_DATA
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      clients: parsed.clients ?? [],
      orders: parsed.orders ?? [],
      payments: parsed.payments ?? [],
      days: parsed.days ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    }
  } catch {
    return EMPTY_DATA
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked. The app keeps working in memory.
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
