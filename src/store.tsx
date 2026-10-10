import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppData, Client, DayEntry, Expense, Order, Payment, Settings } from './types'
import { EMPTY_DATA, exampleData, loadData, newId, saveData } from './storage'
import * as db from './db'
import { altRate, formatMoney, orderBalance, rateFor, today } from './utils'

export interface Account {
  userId: string
  email: string
  signOut: () => void
}

export interface MoneyView {
  currency: string // currency totals are shown in right now
  factor: number // multiply a main-currency amount by this to get the shown amount
  showingAlt: boolean
  canSwitch: boolean // a second currency and its rate are set
  altCurrency: string
  altRate: number | null // 1 main = altRate second
}

interface StoreValue {
  data: AppData
  view: MoneyView
  setShowAlt: (on: boolean) => void
  money: (mainAmount: number) => string // format a main-currency total in the shown currency
  toView: (mainAmount: number) => number
  mode: 'local' | 'cloud'
  status: 'loading' | 'ready'
  error: string | null
  account: Account | null
  dismissError: () => void
  reload: () => void
  saveClient: (c: Partial<Client> & Pick<Client, 'name'>) => string
  deleteClient: (id: string) => void
  markContact: (clientId: string, date?: string) => void
  saveOrder: (o: Partial<Order> & Pick<Order, 'clientId' | 'title'>) => string
  deleteOrder: (id: string) => void
  settleOrder: (id: string) => number // records what's still owed as received; returns the amount
  savePayment: (p: Partial<Payment> & Pick<Payment, 'amount' | 'currency'>) => string
  deletePayment: (id: string) => void
  saveExpense: (e: Partial<Expense> & Pick<Expense, 'amount' | 'currency'>) => string
  deleteExpense: (id: string) => void
  importClients: (rows: Pick<Client, 'name' | 'contact' | 'platform' | 'notes'>[]) => number
  saveDay: (d: DayEntry) => void
  updateSettings: (s: Partial<Settings>) => void
  resetAll: () => void
  loadExamples: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

// Two modes:
// - local: data in this browser only (the preview, or no account)
// - cloud: data in Supabase for the signed-in user; the screen updates at once
//   and the change is saved in the background. If a save fails, we show the
//   error and reload what the database actually has.
export function StoreProvider({ account, children }: { account?: Account | null; children: ReactNode }) {
  const cloud = !!account
  const [data, setData] = useState<AppData>(() => (cloud ? EMPTY_DATA : loadData()))
  const [status, setStatus] = useState<'loading' | 'ready'>(cloud ? 'loading' : 'ready')
  const [error, setError] = useState<string | null>(null)
  const [showAlt, setShowAltState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ft-show-alt') === '1'
    } catch {
      return false
    }
  })
  const setShowAlt = useCallback((on: boolean) => {
    setShowAltState(on)
    try {
      localStorage.setItem('ft-show-alt', on ? '1' : '0')
    } catch {
      // Remembering the choice is optional.
    }
  }, [])
  const dataRef = useRef(data)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => {
    dataRef.current = data
  }, [data])

  const fetchIntoState = useCallback(() => {
    return db
      .fetchAll()
      .then((d) => {
        setData(d)
        setStatus('ready')
      })
      .catch((e: Error) => {
        setError(`Couldn't load your data: ${e.message}. Check your connection and try again.`)
        setStatus('ready')
      })
  }, [])

  const reload = useCallback(() => {
    if (!cloud) return
    setStatus('loading')
    void fetchIntoState()
  }, [cloud, fetchIntoState])

  // First load for a signed-in user (status starts as 'loading').
  useEffect(() => {
    if (cloud) void fetchIntoState()
  }, [cloud, fetchIntoState])

  useEffect(() => {
    if (!cloud) saveData(data)
  }, [cloud, data])

  const value = useMemo<StoreValue>(() => {
    const now = () => new Date().toISOString()
    const userId = account?.userId ?? ''

    // Runs database writes one after another in cloud mode, so a new client is
    // saved before the order that points to it. On failure, tell the user and resync.
    const persist = (label: string, op: () => Promise<void>) => {
      if (!cloud) return
      queueRef.current = queueRef.current.then(op).catch((e: Error) => {
        setError(`${label} wasn't saved: ${e.message}`)
        reload()
      })
    }

    // Marks an order as fully paid: expected payments for it become received,
    // and any remaining balance is recorded as a payment received today.
    const settle = (order: Order, d0: AppData): number => {
      const expected = d0.payments.filter((p) => p.orderId === order.id && p.status === 'Expected')
      const received = expected.map((p) => ({ ...p, status: 'Received' as const }))
      const after: AppData = { ...d0, payments: d0.payments.map((p) => received.find((r) => r.id === p.id) ?? p) }
      const bal = orderBalance(after, order) ?? 0
      const extra: Payment[] = []
      if (bal > 0.004) {
        const lastMethod = [...d0.payments].sort((a, b) => b.date.localeCompare(a.date))[0]?.method ?? ''
        extra.push({
          id: newId(),
          orderId: order.id,
          clientId: order.clientId,
          date: today(),
          amount: Math.round(bal * 100) / 100,
          currency: order.currency,
          rateToBase: rateFor(d0, order.currency) ?? 0,
          method: lastMethod,
          status: 'Received',
          notes: 'Recorded when the order was marked Completed',
        })
      }
      if (!received.length && !extra.length) return 0
      setData((d) => ({
        ...d,
        payments: [...d.payments.map((p) => received.find((r) => r.id === p.id) ?? p), ...extra],
      }))
      for (const p of [...received, ...extra]) persist('The payment', () => db.upsertPayment(p))
      return extra[0]?.amount ?? 0
    }

    const ar = altRate(data)
    const canSwitch = ar !== null
    const showingAlt = canSwitch && showAlt
    const view: MoneyView = {
      currency: showingAlt ? data.settings.altCurrency : data.settings.baseCurrency,
      factor: showingAlt && ar ? ar : 1,
      showingAlt,
      canSwitch,
      altCurrency: data.settings.altCurrency,
      altRate: ar,
    }

    return {
      data,
      view,
      setShowAlt,
      money: (x: number) => formatMoney(x * view.factor, view.currency),
      toView: (x: number) => x * view.factor,
      mode: cloud ? 'cloud' : 'local',
      status,
      error,
      account: account ?? null,
      dismissError: () => setError(null),
      reload,

      saveClient(c) {
        const id = c.id ?? newId()
        const existing = dataRef.current.clients.find((x) => x.id === id)
        const row: Client = {
          id,
          name: c.name,
          contact: c.contact ?? existing?.contact ?? '',
          platform: c.platform ?? existing?.platform ?? '',
          notes: c.notes ?? existing?.notes ?? '',
          lastContact: c.lastContact ?? existing?.lastContact ?? null,
          createdAt: existing?.createdAt ?? now(),
        }
        setData((d) => ({ ...d, clients: [...d.clients.filter((x) => x.id !== id), row] }))
        persist('The client', () => db.upsertClient(row))
        return id
      },

      deleteClient(id) {
        setData((d) => {
          const orderIds = d.orders.filter((o) => o.clientId === id).map((o) => o.id)
          return {
            ...d,
            clients: d.clients.filter((c) => c.id !== id),
            orders: d.orders.filter((o) => o.clientId !== id),
            payments: d.payments.filter((p) => p.clientId !== id && !(p.orderId && orderIds.includes(p.orderId))),
            expenses: d.expenses.map((e) => ({
              ...e,
              clientId: e.clientId === id ? null : e.clientId,
              orderId: e.orderId && orderIds.includes(e.orderId) ? null : e.orderId,
            })),
          }
        })
        const orderIds = dataRef.current.orders.filter((o) => o.clientId === id).map((o) => o.id)
        persist('Deleting the client', async () => {
          await db.remove('clients', id)
          // Clean up the client's uploaded files too (best effort).
          await Promise.allSettled([
            db.removeFolder(`${userId}/clients/${id}`),
            ...orderIds.map((oid) => db.removeFolder(`${userId}/orders/${oid}`)),
          ])
        })
      },

      markContact(clientId, date = today()) {
        const existing = dataRef.current.clients.find((c) => c.id === clientId)
        if (!existing) return
        const row = { ...existing, lastContact: date }
        setData((d) => ({ ...d, clients: d.clients.map((c) => (c.id === clientId ? row : c)) }))
        persist('The contact date', () => db.upsertClient(row))
      },

      saveOrder(o) {
        const id = o.id ?? newId()
        const d0 = dataRef.current
        const existing = d0.orders.find((x) => x.id === id)
        const row: Order = {
          id,
          clientId: o.clientId,
          title: o.title,
          service: o.service ?? existing?.service ?? '',
          status: o.status ?? existing?.status ?? 'Lead',
          platform: o.platform ?? existing?.platform ?? '',
          price: o.price !== undefined ? o.price : (existing?.price ?? null),
          currency: o.currency ?? existing?.currency ?? d0.settings.baseCurrency,
          startDate: o.startDate ?? existing?.startDate ?? null,
          dueDate: o.dueDate !== undefined ? o.dueDate : (existing?.dueDate ?? null),
          notes: o.notes ?? existing?.notes ?? '',
          checklist: o.checklist ?? existing?.checklist ?? [],
          createdAt: existing?.createdAt ?? now(),
          updatedAt: now(),
        }
        setData((d) => ({ ...d, orders: [...d.orders.filter((x) => x.id !== id), row] }))
        persist('The order', () => db.upsertOrder(row))
        // Completed means paid: settle whatever is still owed.
        if (row.status === 'Completed' && existing?.status !== 'Completed') settle(row, { ...d0, orders: [...d0.orders.filter((x) => x.id !== id), row] })
        return id
      },

      settleOrder(id) {
        const d0 = dataRef.current
        const order = d0.orders.find((o) => o.id === id)
        return order ? settle(order, d0) : 0
      },

      deleteOrder(id) {
        setData((d) => ({
          ...d,
          orders: d.orders.filter((o) => o.id !== id),
          payments: d.payments.filter((p) => p.orderId !== id),
          expenses: d.expenses.map((e) => (e.orderId === id ? { ...e, orderId: null } : e)),
        }))
        persist('Deleting the order', async () => {
          await db.remove('orders', id)
          await Promise.allSettled([db.removeFolder(`${userId}/orders/${id}`)])
        })
      },

      savePayment(p) {
        const id = p.id ?? newId()
        const d0 = dataRef.current
        const existing = d0.payments.find((x) => x.id === id)
        const currency = p.currency
        const row: Payment = {
          id,
          orderId: p.orderId ?? existing?.orderId ?? null,
          clientId: p.clientId ?? existing?.clientId ?? null,
          date: p.date ?? existing?.date ?? today(),
          amount: p.amount,
          currency,
          rateToBase: currency === d0.settings.baseCurrency ? 1 : (p.rateToBase ?? existing?.rateToBase ?? 0),
          method: p.method ?? existing?.method ?? '',
          status: p.status ?? existing?.status ?? 'Received',
          notes: p.notes ?? existing?.notes ?? '',
        }
        setData((d) => ({ ...d, payments: [...d.payments.filter((x) => x.id !== id), row] }))
        persist('The payment', () => db.upsertPayment(row))
        return id
      },

      deletePayment(id) {
        setData((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== id) }))
        persist('Deleting the payment', () => db.remove('payments', id))
      },

      saveExpense(e) {
        const id = e.id ?? newId()
        const d0 = dataRef.current
        const existing = d0.expenses.find((x) => x.id === id)
        const currency = e.currency
        const row: Expense = {
          id,
          orderId: e.orderId !== undefined ? e.orderId : (existing?.orderId ?? null),
          clientId: e.clientId !== undefined ? e.clientId : (existing?.clientId ?? null),
          date: e.date ?? existing?.date ?? today(),
          amount: e.amount,
          currency,
          rateToBase: currency === d0.settings.baseCurrency ? 1 : (e.rateToBase ?? existing?.rateToBase ?? 0),
          category: e.category ?? existing?.category ?? '',
          method: e.method ?? existing?.method ?? '',
          notes: e.notes ?? existing?.notes ?? '',
        }
        setData((d) => ({ ...d, expenses: [...d.expenses.filter((x) => x.id !== id), row] }))
        persist('The expense', () => db.upsertExpense(row))
        return id
      },

      deleteExpense(id) {
        setData((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== id) }))
        persist('Deleting the expense', () => db.remove('expenses', id))
      },

      importClients(rows) {
        const existingNames = new Set(dataRef.current.clients.map((c) => c.name.trim().toLowerCase()))
        const fresh: Client[] = rows
          .filter((r) => r.name.trim() && !existingNames.has(r.name.trim().toLowerCase()))
          .map((r) => ({ id: newId(), name: r.name.trim(), contact: r.contact, platform: r.platform, notes: r.notes, lastContact: null, createdAt: now() }))
        if (fresh.length === 0) return 0
        setData((d) => ({ ...d, clients: [...d.clients, ...fresh] }))
        persist('Importing clients', () => db.insertClients(fresh))
        return fresh.length
      },

      saveDay(day) {
        setData((d) => ({ ...d, days: [...d.days.filter((x) => x.date !== day.date), day] }))
        persist('The check-in', () => db.upsertDay(userId, day))
      },

      updateSettings(s) {
        const next = { ...dataRef.current.settings, ...s }
        setData((d) => ({ ...d, settings: next }))
        persist('Your settings', () => db.upsertSettings(userId, next))
      },

      resetAll() {
        setData({ ...EMPTY_DATA, example: false })
        persist('Erasing your data', () => db.eraseAll(userId))
      },

      loadExamples() {
        // Example records are only for the browser-only mode, never written to an account.
        if (!cloud) setData(exampleData())
      },
    }
  }, [account, cloud, data, error, reload, status, showAlt, setShowAlt])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
