export type OrderStatus =
  | 'Lead'
  | 'Proposal'
  | 'Waiting on client'
  | 'Active'
  | 'Completed'
  | 'On hold'
  | 'Cancelled'

export const ORDER_STATUSES: OrderStatus[] = [
  'Lead',
  'Proposal',
  'Waiting on client',
  'Active',
  'Completed',
  'On hold',
  'Cancelled',
]

// Older records may still say Delivered or Paid; both now mean Completed.
export function normalizeStatus(s: string): OrderStatus {
  if (s === 'Delivered' || s === 'Paid') return 'Completed'
  return (ORDER_STATUSES as string[]).includes(s) ? (s as OrderStatus) : 'Active'
}

export const OPEN_STATUSES: OrderStatus[] = ['Lead', 'Proposal', 'Waiting on client', 'Active', 'On hold']

export type PaymentStatus = 'Expected' | 'Received'

export interface Client {
  id: string
  name: string
  contact: string
  platform: string
  notes: string
  lastContact: string | null // YYYY-MM-DD
  createdAt: string
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Order {
  id: string
  clientId: string
  title: string
  service: string
  status: OrderStatus
  platform: string
  price: number | null
  currency: string
  startDate: string | null
  dueDate: string | null // YYYY-MM-DD
  notes: string
  checklist: ChecklistItem[]
  completedAt: string | null // YYYY-MM-DD, set when the order becomes Completed
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  orderId: string | null
  clientId: string | null
  date: string // YYYY-MM-DD
  amount: number
  currency: string
  rateToBase: number // units of base currency per 1 unit of this currency
  method: string
  status: PaymentStatus
  notes: string
}

export interface Expense {
  id: string
  orderId: string | null
  clientId: string | null
  date: string // YYYY-MM-DD
  amount: number
  currency: string
  rateToBase: number
  category: string
  method: string
  notes: string
}

export interface DayEntry {
  date: string // YYYY-MM-DD, unique
  hours: number
  outreach: number
  blockers: string
  notes: string
  platforms: string[] // where you worked that day
  activities: string[] // what you did that day
}

// One block of work on a day: what you did, where, and for how long.
export interface CheckinEntry {
  id: string
  date: string // YYYY-MM-DD
  activity: string
  platform: string
  hours: number
  outreach: number
  note: string
  startedAt: string | null // set when the entry came from the timer
  createdAt: string
}

export interface MonthlyGoal {
  month: string // YYYY-MM
  amount: number // in base currency
}

export interface Settings {
  baseCurrency: string
  currencies: string[]
  services: string[]
  platforms: string[]
  methods: string[]
  categories: string[] // expense categories
  activities: string[] // check-in activities
  monthlyGoal: number // in base currency; 0 means no goal set
  amountStep: number // how much +/− and arrow keys change money amounts
  altCurrency: string // second currency to view totals in ('' = none)
  altRate: number // 1 base = altRate alt (e.g. 1 USD = 1500 NGN); 0 = use latest payment rate
  outreachGapDays: number
  onboarded: boolean // finished (or skipped) the first-time setup
}

export interface AppData {
  clients: Client[]
  orders: Order[]
  payments: Payment[]
  expenses: Expense[]
  days: DayEntry[]
  entries: CheckinEntry[]
  goals: MonthlyGoal[]
  settings: Settings
  example?: boolean // true while the app shows made-up example records
}
