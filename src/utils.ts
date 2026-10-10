import type { AppData, Client, Order, Payment } from './types'
import { OPEN_STATUSES } from './types'

export function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00').getTime()
  const b = new Date(to + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function toBase(amount: number, rateToBase: number): number {
  return amount * (rateToBase || 0)
}

export function clientName(data: AppData, id: string | null): string {
  if (!id) return '-'
  return data.clients.find((c) => c.id === id)?.name ?? 'Unknown client'
}

export function orderTitle(data: AppData, id: string | null): string {
  if (!id) return '-'
  return data.orders.find((o) => o.id === id)?.title ?? 'Unknown order'
}

export function receivedFor(data: AppData, orderId: string): number {
  return data.payments
    .filter((p) => p.orderId === orderId && p.status === 'Received')
    .reduce((sum, p) => sum + toBase(p.amount, p.rateToBase), 0)
}

export interface Attention {
  id: string
  level: 'high' | 'medium' | 'low'
  text: string
  orderId?: string
  clientId?: string
}

// The "Needs attention" list. Each rule is a plain check against the data.
export function attentionItems(data: AppData, now: string): Attention[] {
  const items: Attention[] = []
  const gap = data.settings.outreachGapDays

  for (const o of data.orders) {
    const open = OPEN_STATUSES.includes(o.status)
    if (open && o.dueDate) {
      const diff = daysBetween(now, o.dueDate)
      if (diff < 0) {
        items.push({ id: `od-${o.id}`, level: 'high', text: `Overdue ${-diff} day(s): ${o.title}`, orderId: o.id })
      } else if (diff <= 2) {
        items.push({ id: `dd-${o.id}`, level: 'medium', text: `Due in ${diff} day(s): ${o.title}`, orderId: o.id })
      }
    }
    if (o.status === 'Active' && !o.dueDate) {
      items.push({ id: `nd-${o.id}`, level: 'low', text: `No due date: ${o.title}`, orderId: o.id })
    }
    if (open && (o.price === null || o.price === undefined)) {
      items.push({ id: `np-${o.id}`, level: 'low', text: `No price agreed: ${o.title}`, orderId: o.id })
    }
    if (o.status === 'Delivered') {
      const paid = data.payments.some((p) => p.orderId === o.id && p.status === 'Received')
      if (!paid) {
        items.push({ id: `up-${o.id}`, level: 'high', text: `Delivered but not paid: ${o.title}`, orderId: o.id })
      }
    }
  }

  for (const p of data.payments) {
    if (p.status === 'Expected' && p.date < now) {
      const who = p.orderId ? orderTitle(data, p.orderId) : clientName(data, p.clientId)
      items.push({ id: `ep-${p.id}`, level: 'medium', text: `Expected payment is late: ${formatMoney(p.amount, p.currency)} for ${who}`, orderId: p.orderId ?? undefined, clientId: p.clientId ?? undefined })
    }
  }

  for (const c of data.clients) {
    const hasOpen = data.orders.some((o) => o.clientId === c.id && OPEN_STATUSES.includes(o.status))
    if (!hasOpen) continue
    if (!c.lastContact) {
      items.push({ id: `nc-${c.id}`, level: 'low', text: `No contact logged: ${c.name}`, clientId: c.id })
    } else if (daysBetween(c.lastContact, now) > gap) {
      items.push({
        id: `qc-${c.id}`,
        level: 'medium',
        text: `No contact in ${daysBetween(c.lastContact, now)} days: ${c.name}`,
        clientId: c.id,
      })
    }
  }

  const order = { high: 0, medium: 1, low: 2 } as const
  return items.sort((a, b) => order[a.level] - order[b.level])
}

export function searchAll(data: AppData, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return { clients: [] as Client[], orders: [] as Order[], payments: [] as Payment[] }
  const hit = (...parts: (string | null | undefined)[]) =>
    parts.some((p) => (p ?? '').toLowerCase().includes(q))
  return {
    clients: data.clients.filter((c) => hit(c.name, c.contact, c.notes, c.platform)).slice(0, 8),
    orders: data.orders.filter((o) => hit(o.title, o.service, o.notes, o.status)).slice(0, 8),
    payments: data.payments.filter((p) => hit(p.notes, p.method, p.currency, p.date)).slice(0, 8),
  }
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---------- money math ----------

// Latest known rate (base per 1 unit) for a currency, from payments and expenses.
export function rateFor(data: AppData, currency: string): number | null {
  if (currency === data.settings.baseCurrency) return 1
  let best: { date: string; rate: number } | null = null
  for (const r of [...data.payments, ...data.expenses]) {
    if (r.currency === currency && r.rateToBase > 0 && (!best || r.date > best.date)) best = { date: r.date, rate: r.rateToBase }
  }
  return best ? best.rate : null
}

// Money received for an order, in the order's own currency.
export function orderReceived(data: AppData, order: Order): number {
  const orderRate = rateFor(data, order.currency)
  return data.payments
    .filter((p) => p.orderId === order.id && p.status === 'Received')
    .reduce((sum, p) => {
      if (p.currency === order.currency) return sum + p.amount
      if (orderRate) return sum + (p.amount * p.rateToBase) / orderRate
      return sum
    }, 0)
}

// What the client still owes on an order, in the order's currency (null if no price).
export function orderBalance(data: AppData, order: Order): number | null {
  if (order.price === null) return null
  if (order.status === 'Cancelled') return 0
  return Math.max(0, order.price - orderReceived(data, order))
}

// Converts an order-currency amount to base, if a rate is known.
export function orderToBase(data: AppData, order: Order, amount: number): number | null {
  const r = rateFor(data, order.currency)
  return r === null ? null : amount * r
}

export function totalOutstanding(data: AppData): number {
  return data.orders
    .filter((o) => !['Cancelled', 'Lead', 'Proposal'].includes(o.status))
    .reduce((sum, o) => {
      const bal = orderBalance(data, o)
      const b = bal ? orderToBase(data, o, bal) : 0
      return sum + (b ?? 0)
    }, 0)
}

export function receivedIn(data: AppData, month: string): number {
  return data.payments
    .filter((p) => p.status === 'Received' && monthOf(p.date) === month)
    .reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0)
}

export function spentIn(data: AppData, month: string): number {
  return data.expenses.filter((e) => monthOf(e.date) === month).reduce((s, e) => s + toBase(e.amount, e.rateToBase), 0)
}

// The last n month keys (YYYY-MM), oldest first, ending with the current month.
export function lastMonths(n: number, from = today()): string[] {
  const [y, m] = from.split('-').map(Number)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(y, m - 1 - i, 1)
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function monthLabel(key: string, withYear = false): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, withYear ? { month: 'short', year: 'numeric' } : { month: 'short' })
}

export function previousMonth(key: string): string {
  return lastMonths(2, `${key}-15`)[0]
}

export interface ClientStats {
  billed: number
  received: number
  outstanding: number
  openOrders: number
  orders: number
  lastPayment: string | null
}

export function clientStats(data: AppData, clientId: string): ClientStats {
  const orders = data.orders.filter((o) => o.clientId === clientId)
  let billed = 0
  let outstanding = 0
  for (const o of orders) {
    if (o.status === 'Cancelled' || o.price === null) continue
    billed += orderToBase(data, o, o.price) ?? 0
    if (!['Lead', 'Proposal'].includes(o.status)) outstanding += orderToBase(data, o, orderBalance(data, o) ?? 0) ?? 0
  }
  const pays = data.payments.filter((p) => p.clientId === clientId && p.status === 'Received')
  return {
    billed,
    received: pays.reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0),
    outstanding,
    openOrders: orders.filter((o) => OPEN_STATUSES.includes(o.status)).length,
    orders: orders.length,
    lastPayment: pays.reduce<string | null>((m, p) => (!m || p.date > m ? p.date : m), null),
  }
}

// Consecutive days with a check-in, ending today (or yesterday if today isn't logged yet).
export function checkinStreak(data: AppData, now = today()): number {
  const dates = new Set(data.days.map((d) => d.date))
  let day = dates.has(now) ? now : addDays(now, -1)
  let n = 0
  while (dates.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

// Sum received money (base) grouped by a key, largest first.
export function groupReceived(
  data: AppData,
  keyOf: (p: Payment) => string,
  fromDate: string | null,
): { key: string; value: number }[] {
  const map = new Map<string, number>()
  for (const p of data.payments) {
    if (p.status !== 'Received' || (fromDate && p.date < fromDate)) continue
    const k = keyOf(p) || 'Not set'
    map.set(k, (map.get(k) ?? 0) + toBase(p.amount, p.rateToBase))
  }
  return [...map.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)
}

// Clients whose names look like the typed one (for "did you mean" while adding).
export function similarClients(data: AppData, name: string, exceptId?: string): Client[] {
  const q = name.trim().toLowerCase()
  if (q.length < 2) return []
  const strip = (s: string) => s.toLowerCase().replace(/^example:\s*/, '').replace(/[^a-z0-9]/g, '')
  const qs = strip(q)
  return data.clients
    .filter((c) => c.id !== exceptId)
    .filter((c) => {
      const n = strip(c.name)
      return n.includes(qs) || qs.includes(n) || n.startsWith(qs.slice(0, 4))
    })
    .slice(0, 3)
}

export function compactMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount)}`
  }
}

export function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function initials(name: string): string {
  const parts = name.replace(/^example:\s*/i, '').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
