import { supabase } from './supabase'
import { normalizeStatus, type MonthlyGoal, type AppData, type ChecklistItem, type Client, type DayEntry, type Expense, type Order, type Payment, type PaymentStatus, type Settings } from './types'
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
  status: normalizeStatus(str(r.status)),
  platform: str(r.platform),
  price: num(r.price),
  currency: str(r.currency),
  startDate: (r.start_date as string | null) ?? null,
  dueDate: (r.due_date as string | null) ?? null,
  notes: str(r.notes),
  checklist: Array.isArray(r.checklist) ? (r.checklist as ChecklistItem[]) : [],
  completedAt: (r.completed_at as string | null) ?? null,
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
  platforms: Array.isArray(r.platforms) ? (r.platforms as string[]) : [],
  activities: Array.isArray(r.activities) ? (r.activities as string[]) : [],
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
        activities: (r.activities as string[]) ?? DEFAULT_SETTINGS.activities,
        monthlyGoal: num(r.monthly_goal) ?? 0,
        amountStep: num(r.amount_step) ?? DEFAULT_SETTINGS.amountStep,
        onboarded: r.onboarded === true,
        altCurrency: str(r.alt_currency),
        altRate: num(r.alt_rate) ?? 0,
        outreachGapDays: num(r.outreach_gap_days) ?? DEFAULT_SETTINGS.outreachGapDays,
      }
    : DEFAULT_SETTINGS

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

// Loads everything for the signed-in user. Row-level security returns only their rows.
export async function fetchAll(): Promise<AppData> {
  const [clients, orders, payments, expenses, days, settings, goals] = await Promise.all([
    supabase.from('clients').select('*').order('name'),
    supabase.from('orders').select('*').order('created_at'),
    supabase.from('payments').select('*').order('date', { ascending: false }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('day_entries').select('*').order('date', { ascending: false }),
    supabase.from('user_settings').select('*').maybeSingle(),
    supabase.from('monthly_goals').select('month, amount').order('month'),
  ])
  return {
    clients: (check(clients) ?? []).map(toClient),
    orders: (check(orders) ?? []).map(toOrder),
    payments: (check(payments) ?? []).map(toPayment),
    expenses: (check(expenses) ?? []).map(toExpense),
    days: (check(days) ?? []).map(toDay),
    settings: toSettings(check(settings)),
    goals: (check(goals) ?? []).map((g: Row): MonthlyGoal => ({ month: str(g.month), amount: num(g.amount) ?? 0 })),
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
      completed_at: o.completedAt,
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

export async function upsertGoal(userId: string, g: MonthlyGoal) {
  check(await supabase.from('monthly_goals').upsert({ user_id: userId, month: g.month, amount: g.amount, updated_at: new Date().toISOString() }, { onConflict: 'user_id,month' }))
}

export async function upsertDay(userId: string, d: DayEntry) {
  check(
    await supabase.from('day_entries').upsert(
      { user_id: userId, date: d.date, hours: d.hours, outreach: d.outreach, blockers: d.blockers, notes: d.notes, platforms: d.platforms, activities: d.activities },
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
      activities: s.activities,
      monthly_goal: s.monthlyGoal,
      amount_step: s.amountStep,
      onboarded: s.onboarded,
      alt_currency: s.altCurrency,
      alt_rate: s.altRate,
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
  check(await supabase.from('monthly_goals').delete().eq('user_id', userId))
  check(await supabase.from('user_settings').delete().eq('user_id', userId))
}

// ---------- files (private bucket, one folder per user) ----------
const BUCKET = 'client-files'

export interface StoredFile {
  path: string
  name: string // shown name, without the upload-time prefix
  size: number
  createdAt: string
}

export async function listFiles(prefix: string): Promise<StoredFile[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((f) => f.id) // folders have no id
    .map((f) => ({
      path: `${prefix}/${f.name}`,
      name: f.name.replace(/^\d{10,}-/, ''),
      size: Number((f.metadata as { size?: number } | null)?.size ?? 0),
      createdAt: f.created_at ?? '',
    }))
}

export async function uploadFile(prefix: string, file: File): Promise<void> {
  const safe = file.name.replace(/[^\w.\- ]+/g, '_').slice(-120)
  const { error } = await supabase.storage.from(BUCKET).upload(`${prefix}/${Date.now()}-${safe}`, file, { contentType: file.type || undefined, upsert: false })
  if (error) throw new Error(error.message)
}

export async function fileLink(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(error.message)
}

export async function removeFolder(prefix: string): Promise<void> {
  const files = await listFiles(prefix)
  if (!files.length) return
  const { error } = await supabase.storage.from(BUCKET).remove(files.map((f) => f.path))
  if (error) throw new Error(error.message)
}
