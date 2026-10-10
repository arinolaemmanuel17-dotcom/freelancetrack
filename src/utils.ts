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
