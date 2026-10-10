export type OrderStatus =
  | 'Lead'
  | 'Proposal'
  | 'Waiting on client'
  | 'Active'
  | 'Delivered'
  | 'Paid'
  | 'On hold'
  | 'Cancelled'

export const ORDER_STATUSES: OrderStatus[] = [
  'Lead',
  'Proposal',
  'Waiting on client',
  'Active',
  'Delivered',
  'Paid',
  'On hold',
  'Cancelled',
]

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

export interface DayEntry {
  date: string // YYYY-MM-DD, unique
  hours: number
  outreach: number
  blockers: string
  notes: string
}

export interface Settings {
  baseCurrency: string
  currencies: string[]
  services: string[]
  platforms: string[]
  methods: string[]
  outreachGapDays: number
}

export interface AppData {
  clients: Client[]
  orders: Order[]
  payments: Payment[]
  days: DayEntry[]
  settings: Settings
  example?: boolean // true while the app shows made-up example records
}
