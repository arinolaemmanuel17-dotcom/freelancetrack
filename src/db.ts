import { supabase } from './supabase'
import type { AppData, ChecklistItem, Client, DayEntry, Expense, Order, OrderStatus, Payment, PaymentStatus, Settings } from './types'
import { DEFAULT_SETTINGS } from './storage'

// Maps between the app's camelCase records and the database's snake_case rows.

type Row = Record<string, unknown>
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

const toClient = (r: Row): Client => ({
  id: str(r.id),
  name: str(r.name),
  contact: str(r.contact),
  platform: str(r.platform),
  notes: str(r.notes),
  lastContact: (r.last_contact as string | null) ?? null,
  createdAt: str(r.created_at),
})

const toOrder = (r: Row): Order => ({
  id: str(r.id),
  clientId: str(r.client_id),
  title: str(r.title),
  service: str(r.service),
  status: r.status as OrderStatus,
  platform: str(r.platform),
  price: num(r.price),
  currency: str(r.currency),
  startDate: (r.start_date as string | null) ?? null,
  dueDate: (r.due_date as string | null) ?? null,
  notes: str(r.notes),
  checklist: Array.isArray(r.checklist) ? (r.checklist as ChecklistItem[]) : [],
  createdAt: str(r.created_at),
  updatedAt: str(r.updated_at),
})

const toPayment = (r: Row): Payment => ({
  id: str(r.id),
  orderId: (r.order_id as string | null) ?? null,
  clientId: (r.client_id as string | null) ?? null,
  date: str(r.date),
  amount: num(r.amount) ?? 0,
  currency: str(r.currency),
  rateToBase: num(r.rate_to_base) ?? 0,
  method: str(r.method),
  status: r.status as PaymentStatus,
  notes: str(r.notes),
})

const toExpense = (r: Row): Expense => ({
  id: str(r.id),
  orderId: (r.order_id as string | null) ?? null,
  clientId: (r.client_id as string | null) ?? null,
  date: str(r.date),
  amount: num(r.amount) ?? 0,
  currency: str(r.currency),
  rateToBase: num(r.rate_to_base) ?? 0,
  category: str(r.category),
  method: str(r.method),
  notes: str(r.notes),
})

const toDay = (r: Row): DayEntry => ({
  date: str(r.date),
  hours: num(r.hours) ?? 0,
  outreach: num(r.outreach) ?? 0,
  blockers: str(r.blockers),
  notes: str(r.notes),
})

const toSettings = (r: Row | null): Settings =>
  r
    ? {
        baseCurrency: str(r.base_currency),
        currencies: (r.currencies as string[]) ?? DEFAULT_SETTINGS.currencies,
        services: (r.services as string[]) ?? DEFAULT_SETTINGS.services,
        platforms: (r.platforms as string[]) ?? DEFAULT_SETTINGS.platforms,
        methods: (r.methods as string[]) ?? DEFAULT_SETTINGS.methods,
        categories: (r.categories as string[]) ?? DEFAULT_SETTINGS.categories,
        monthlyGoal: num(r.monthly_goal) ?? 0,
        outreachGapDays: num(r.outreach_gap_days) ?? DEFAULT_SETTINGS.outreachGapDays,
      }
    : DEFAULT_SETTINGS

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

// Loads everything for the signed-in user. Row-level security returns only their rows.
export async function fetchAll(): Promise<AppData> {
  const [clients, orders, payments, expenses, days, settings] = await Promise.all([
    supabase.from('clients').select('*').order('name'),
    supabase.from('orders').select('*').order('created_at'),
    supabase.from('payments').select('*').order('date', { ascending: false }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('day_entries').select('*').order('date', { ascending: false }),
    supabase.from('user_settings').select('*').maybeSingle(),
  ])
  return {
    clients: (check(clients) ?? []).map(toClient),
    orders: (check(orders) ?? []).map(toOrder),
    payments: (check(payments) ?? []).map(toPayment),
    expenses: (check(expenses) ?? []).map(toExpense),
    days: (check(days) ?? []).map(toDay),
    settings: toSettings(check(settings)),
    example: false,
  }
}

export async function upsertClient(c: Client) {
  check(
    await supabase.from('clients').upsert({
      id: c.id,
      name: c.name,
      contact: c.contact,
      platform: c.platform,
      notes: c.notes,
      last_contact: c.lastContact,
    }),
  )
}

export async function upsertOrder(o: Order) {
  check(
    await supabase.from('orders').upsert({
      id: o.id,
      client_id: o.clientId,
      title: o.title,
      service: o.service,
      status: o.status,
      platform: o.platform,
      price: o.price,
      currency: o.currency,
      start_date: o.startDate,
      due_date: o.dueDate,
      notes: o.notes,
      checklist: o.checklist,
    }),
  )
}

export async function upsertPayment(p: Payment) {
  check(
    await supabase.from('payments').upsert({
      id: p.id,
      order_id: p.orderId,
      client_id: p.clientId,
      date: p.date,
      amount: p.amount,
      currency: p.currency,
      rate_to_base: p.rateToBase,
      method: p.method,
      status: p.status,
      notes: p.notes,
    }),
  )
}

export async function upsertExpense(e: Expense) {
  check(
    await supabase.from('expenses').upsert({
      id: e.id,
      order_id: e.orderId,
      client_id: e.clientId,
      date: e.date,
      amount: e.amount,
      currency: e.currency,
      rate_to_base: e.rateToBase,
      category: e.category,
      method: e.method,
      notes: e.notes,
    }),
  )
}

export async function upsertDay(userId: string, d: DayEntry) {
  check(
    await supabase.from('day_entries').upsert(
      { user_id: userId, date: d.date, hours: d.hours, outreach: d.outreach, blockers: d.blockers, notes: d.notes },
      { onConflict: 'user_id,date' },
    ),
  )
}

export async function upsertSettings(userId: string, s: Settings) {
  check(
    await supabase.from('user_settings').upsert({
      user_id: userId,
      base_currency: s.baseCurrency,
      currencies: s.currencies,
      services: s.services,
      platforms: s.platforms,
      methods: s.methods,
      categories: s.categories,
      monthly_goal: s.monthlyGoal,
      outreach_gap_days: s.outreachGapDays,
      updated_at: new Date().toISOString(),
    }),
  )
}

export async function remove(table: 'clients' | 'orders' | 'payments' | 'expenses', id: string) {
  check(await supabase.from(table).delete().eq('id', id))
}

// Import many clients at once (CSV import).
export async function insertClients(rows: Client[]) {
  if (rows.length === 0) return
  check(
    await supabase.from('clients').insert(
      rows.map((c) => ({ id: c.id, name: c.name, contact: c.contact, platform: c.platform, notes: c.notes, last_contact: c.lastContact })),
    ),
  )
}

// Deletes all of the user's records. Orders and payments linked to clients go with them.
export async function eraseAll(userId: string) {
  check(await supabase.from('clients').delete().eq('user_id', userId))
  check(await supabase.from('payments').delete().eq('user_id', userId))
  check(await supabase.from('expenses').delete().eq('user_id', userId))
  check(await supabase.from('day_entries').delete().eq('user_id', userId))
  check(await supabase.from('user_settings').delete().eq('user_id', userId))
}
