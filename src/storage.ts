import type { AppData, Settings } from './types'
import { addDays, today } from './utils'

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
    if (!raw) return import.meta.env.VITE_PREVIEW === '1' ? exampleData() : EMPTY_DATA
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      clients: parsed.clients ?? [],
      orders: parsed.orders ?? [],
      payments: parsed.payments ?? [],
      days: parsed.days ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      example: parsed.example ?? false,
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

// Made-up records so a new user can see how the app works. Marked with
// example: true so the app can show a banner and clear them in one tap.
export function exampleData(): AppData {
  const t = today()
  const d = (n: number) => addDays(t, n)
  return {
    example: true,
    settings: {
      ...DEFAULT_SETTINGS,
      services: ['Logo design', 'Website copy', 'Consulting call', 'Other'],
    },
    clients: [
      { id: 'ex_c1', name: 'Example: Lagos Bakery', contact: 'hello@example.com', platform: 'Direct', notes: 'Likes weekly updates', lastContact: d(-1), createdAt: d(-30) },
      { id: 'ex_c2', name: 'Example: Rivera Studio', contact: '@rivera', platform: 'Marketplace', notes: '', lastContact: d(-6), createdAt: d(-20) },
      { id: 'ex_c3', name: 'Example: Bright Path NGO', contact: 'team@example.org', platform: 'Referral', notes: '', lastContact: null, createdAt: d(-3) },
    ],
    orders: [
      { id: 'ex_o1', clientId: 'ex_c1', title: 'New logo and menu', service: 'Logo design', status: 'Active', platform: 'Direct', price: 250, currency: 'USD', startDate: d(-10), dueDate: d(-2), notes: '', createdAt: d(-10), updatedAt: d(-1) },
      { id: 'ex_o2', clientId: 'ex_c2', title: 'Homepage copy', service: 'Website copy', status: 'Delivered', platform: 'Marketplace', price: 180, currency: 'USD', startDate: d(-14), dueDate: d(-4), notes: '', createdAt: d(-14), updatedAt: d(-4) },
      { id: 'ex_o3', clientId: 'ex_c3', title: 'Strategy call', service: 'Consulting call', status: 'Proposal', platform: 'Referral', price: null, currency: 'NGN', startDate: null, dueDate: d(2), notes: 'Waiting on budget', createdAt: d(-3), updatedAt: d(-3) },
      { id: 'ex_o4', clientId: 'ex_c1', title: 'Social media pack', service: 'Logo design', status: 'Paid', platform: 'Direct', price: 120, currency: 'USD', startDate: d(-40), dueDate: d(-30), notes: '', createdAt: d(-40), updatedAt: d(-28) },
    ],
    payments: [
      { id: 'ex_p1', orderId: 'ex_o4', clientId: 'ex_c1', date: d(-28), amount: 120, currency: 'USD', rateToBase: 1, method: 'Bank', status: 'Received', notes: '' },
      { id: 'ex_p2', orderId: 'ex_o1', clientId: 'ex_c1', date: d(-9), amount: 100, currency: 'USD', rateToBase: 1, method: 'Bank', status: 'Received', notes: 'Deposit' },
      { id: 'ex_p3', orderId: 'ex_o2', clientId: 'ex_c2', date: d(3), amount: 180, currency: 'USD', rateToBase: 1, method: 'Other', status: 'Expected', notes: 'Platform clearing' },
    ],
    days: [
      { date: d(-1), hours: 5, outreach: 3, blockers: '', notes: '' },
      { date: d(-2), hours: 3.5, outreach: 1, blockers: 'Waiting on client files', notes: '' },
    ],
  }
}
