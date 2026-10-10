import { normalizeStatus, type AppData, type Settings } from './types'
import { addDays, today } from './utils'

const KEY = 'freelance-tracker-v1'

export const DEFAULT_SETTINGS: Settings = {
  baseCurrency: 'USD',
  currencies: ['USD', 'EUR', 'GBP', 'NGN'],
  services: [],
  platforms: ['Fiverr', 'Upwork', 'Freelancer', 'LinkedIn', 'WhatsApp', 'Instagram', 'Referral', 'Direct', 'Other'],
  methods: ['Bank', 'Cash', 'Card', 'Other'],
  categories: ['Fees', 'Data', 'Transport', 'Software', 'Other'],
  monthlyGoal: 0,
  amountStep: 10,
  altCurrency: '',
  altRate: 0,
  outreachGapDays: 3,
  onboarded: false,
}

export const EMPTY_DATA: AppData = {
  clients: [],
  orders: [],
  payments: [],
  expenses: [],
  days: [],
  settings: DEFAULT_SETTINGS,
}

// Browser-only storage, used by the preview build (no account).
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return import.meta.env.VITE_PREVIEW === '1' ? exampleData() : EMPTY_DATA
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      clients: parsed.clients ?? [],
      orders: (parsed.orders ?? []).map((o) => ({ ...o, status: normalizeStatus(o.status), checklist: o.checklist ?? [] })),
      payments: parsed.payments ?? [],
      expenses: parsed.expenses ?? [],
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

// Record ids are UUIDs so the same record id works locally and in the database.
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// Made-up records so a new user can see how the app works. Marked with
// example: true so the app shows a banner and can clear them in one tap.
export function exampleData(): AppData {
  const t = today()
  const d = (n: number) => addDays(t, n)
  const item = (id: string, text: string, done: boolean) => ({ id, text, done })
  return {
    example: true,
    settings: {
      ...DEFAULT_SETTINGS,
      services: ['Logo design', 'Website copy', 'Consulting call', 'Social media pack', 'Other'],
      monthlyGoal: 1500,
      onboarded: true,
      altCurrency: 'NGN',
      altRate: 1500,
    },
    clients: [
      { id: 'ex_c1', name: 'Example: Lagos Bakery', contact: 'hello@example.com', platform: 'Direct', notes: 'Likes weekly updates', lastContact: d(-1), createdAt: d(-160) },
      { id: 'ex_c2', name: 'Example: Rivera Studio', contact: '@rivera', platform: 'Fiverr', notes: '', lastContact: d(-6), createdAt: d(-120) },
      { id: 'ex_c3', name: 'Example: Bright Path NGO', contact: 'team@example.org', platform: 'Referral', notes: '', lastContact: null, createdAt: d(-3) },
      { id: 'ex_c4', name: 'Example: Okafor Legal', contact: '+234 800 000 0000', platform: 'Referral', notes: 'Pays on time', lastContact: d(-12), createdAt: d(-90) },
    ],
    orders: [
      { id: 'ex_o1', clientId: 'ex_c1', title: 'New logo and menu', service: 'Logo design', status: 'Active', platform: 'Direct', price: 400, currency: 'USD', startDate: d(-10), dueDate: d(-2), notes: '', checklist: [item('k1', 'Moodboard', true), item('k2', 'Three logo drafts', true), item('k3', 'Final files', false)], createdAt: d(-10), updatedAt: d(-1) },
      { id: 'ex_o2', clientId: 'ex_c2', title: 'Homepage copy', service: 'Website copy', status: 'Completed', platform: 'Fiverr', price: 180, currency: 'USD', startDate: d(-14), dueDate: d(-4), notes: '', checklist: [], createdAt: d(-14), updatedAt: d(-4) },
      { id: 'ex_o3', clientId: 'ex_c3', title: 'Strategy call', service: 'Consulting call', status: 'Proposal', platform: 'Referral', price: null, currency: 'NGN', startDate: null, dueDate: d(2), notes: 'Waiting on budget', checklist: [], createdAt: d(-3), updatedAt: d(-3) },
      { id: 'ex_o4', clientId: 'ex_c1', title: 'Social media pack', service: 'Social media pack', status: 'Completed', platform: 'Direct', price: 120, currency: 'USD', startDate: d(-40), dueDate: d(-30), notes: '', checklist: [], createdAt: d(-40), updatedAt: d(-28) },
      { id: 'ex_o5', clientId: 'ex_c4', title: 'Website refresh', service: 'Website copy', status: 'Completed', platform: 'Referral', price: 650, currency: 'USD', startDate: d(-95), dueDate: d(-70), notes: '', checklist: [], createdAt: d(-95), updatedAt: d(-68) },
      { id: 'ex_o6', clientId: 'ex_c2', title: 'Brand guide', service: 'Logo design', status: 'Completed', platform: 'Fiverr', price: 300, currency: 'USD', startDate: d(-130), dueDate: d(-110), notes: '', checklist: [], createdAt: d(-130), updatedAt: d(-105) },
      { id: 'ex_o7', clientId: 'ex_c4', title: 'Monthly advice call', service: 'Consulting call', status: 'Active', platform: 'Referral', price: 150000, currency: 'NGN', startDate: d(-5), dueDate: d(6), notes: '', checklist: [], createdAt: d(-5), updatedAt: d(-5) },
    ],
    payments: [
      { id: 'ex_p1', orderId: 'ex_o6', clientId: 'ex_c2', date: d(-105), amount: 300, currency: 'USD', rateToBase: 1, method: 'Other', status: 'Received', notes: '' },
      { id: 'ex_p2', orderId: 'ex_o5', clientId: 'ex_c4', date: d(-80), amount: 300, currency: 'USD', rateToBase: 1, method: 'Bank', status: 'Received', notes: 'Deposit' },
      { id: 'ex_p3', orderId: 'ex_o5', clientId: 'ex_c4', date: d(-68), amount: 350, currency: 'USD', rateToBase: 1, method: 'Bank', status: 'Received', notes: 'Balance' },
      { id: 'ex_p4', orderId: 'ex_o4', clientId: 'ex_c1', date: d(-28), amount: 120, currency: 'USD', rateToBase: 1, method: 'Bank', status: 'Received', notes: '' },
      { id: 'ex_p5', orderId: 'ex_o1', clientId: 'ex_c1', date: d(-9), amount: 200, currency: 'USD', rateToBase: 1, method: 'Bank', status: 'Received', notes: 'Deposit' },
      { id: 'ex_p6', orderId: 'ex_o7', clientId: 'ex_c4', date: d(-4), amount: 75000, currency: 'NGN', rateToBase: 0.00066, method: 'Bank', status: 'Received', notes: 'Half upfront' },
      { id: 'ex_p7', orderId: 'ex_o2', clientId: 'ex_c2', date: d(3), amount: 180, currency: 'USD', rateToBase: 1, method: 'Other', status: 'Expected', notes: 'Platform clearing' },
    ],
    expenses: [
      { id: 'ex_e1', orderId: null, clientId: null, date: d(-60), amount: 15, currency: 'USD', rateToBase: 1, category: 'Software', method: 'Card', notes: 'Design app' },
      { id: 'ex_e2', orderId: null, clientId: null, date: d(-30), amount: 15, currency: 'USD', rateToBase: 1, category: 'Software', method: 'Card', notes: 'Design app' },
      { id: 'ex_e3', orderId: null, clientId: null, date: d(-8), amount: 8000, currency: 'NGN', rateToBase: 0.00066, category: 'Data', method: 'Bank', notes: 'Monthly data' },
      { id: 'ex_e4', orderId: 'ex_o2', clientId: 'ex_c2', date: d(-4), amount: 36, currency: 'USD', rateToBase: 1, category: 'Fees', method: 'Other', notes: 'Platform fee' },
    ],
    days: [
      { date: d(-1), hours: 5, outreach: 3, blockers: '', notes: '' },
      { date: d(-2), hours: 3.5, outreach: 1, blockers: 'Waiting on client files', notes: '' },
      { date: d(-3), hours: 6, outreach: 2, blockers: '', notes: '' },
    ],
  }
}
