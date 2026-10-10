import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppData, Client, DayEntry, Order, Payment, Settings } from './types'
import { loadData, newId, saveData } from './storage'
import { today } from './utils'

interface StoreValue {
  data: AppData
  saveClient: (c: Partial<Client> & Pick<Client, 'name'>) => string
  deleteClient: (id: string) => void
  markContact: (clientId: string, date?: string) => void
  saveOrder: (o: Partial<Order> & Pick<Order, 'clientId' | 'title'>) => string
  deleteOrder: (id: string) => void
  savePayment: (p: Partial<Payment> & Pick<Payment, 'amount' | 'currency'>) => string
  deletePayment: (id: string) => void
  saveDay: (d: DayEntry) => void
  updateSettings: (s: Partial<Settings>) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData())

  useEffect(() => {
    saveData(data)
  }, [data])

  const value = useMemo<StoreValue>(() => {
    const now = () => new Date().toISOString()

    return {
      data,

      saveClient(c) {
        const id = c.id ?? newId('cl')
        setData((d) => {
          const existing = d.clients.find((x) => x.id === id)
          const row: Client = {
            id,
            name: c.name,
            contact: c.contact ?? existing?.contact ?? '',
            platform: c.platform ?? existing?.platform ?? '',
            notes: c.notes ?? existing?.notes ?? '',
            lastContact: c.lastContact ?? existing?.lastContact ?? null,
            createdAt: existing?.createdAt ?? now(),
          }
          return { ...d, clients: [...d.clients.filter((x) => x.id !== id), row] }
        })
        return id
      },

      deleteClient(id) {
        setData((d) => {
          const orderIds = d.orders.filter((o) => o.clientId === id).map((o) => o.id)
          return {
            ...d,
            clients: d.clients.filter((c) => c.id !== id),
            orders: d.orders.filter((o) => o.clientId !== id),
            payments: d.payments.filter(
              (p) => p.clientId !== id && !(p.orderId && orderIds.includes(p.orderId)),
            ),
          }
        })
      },

      markContact(clientId, date = today()) {
        setData((d) => ({
          ...d,
          clients: d.clients.map((c) => (c.id === clientId ? { ...c, lastContact: date } : c)),
        }))
      },

      saveOrder(o) {
        const id = o.id ?? newId('or')
        setData((d) => {
          const existing = d.orders.find((x) => x.id === id)
          const row: Order = {
            id,
            clientId: o.clientId,
            title: o.title,
            service: o.service ?? existing?.service ?? '',
            status: o.status ?? existing?.status ?? 'Lead',
            platform: o.platform ?? existing?.platform ?? '',
            price: o.price !== undefined ? o.price : (existing?.price ?? null),
            currency: o.currency ?? existing?.currency ?? d.settings.baseCurrency,
            startDate: o.startDate ?? existing?.startDate ?? null,
            dueDate: o.dueDate !== undefined ? o.dueDate : (existing?.dueDate ?? null),
            notes: o.notes ?? existing?.notes ?? '',
            createdAt: existing?.createdAt ?? now(),
            updatedAt: now(),
          }
          return { ...d, orders: [...d.orders.filter((x) => x.id !== id), row] }
        })
        return id
      },

      deleteOrder(id) {
        setData((d) => ({
          ...d,
          orders: d.orders.filter((o) => o.id !== id),
          payments: d.payments.filter((p) => p.orderId !== id),
        }))
      },

      savePayment(p) {
        const id = p.id ?? newId('pm')
        setData((d) => {
          const existing = d.payments.find((x) => x.id === id)
          const currency = p.currency
          const row: Payment = {
            id,
            orderId: p.orderId ?? existing?.orderId ?? null,
            clientId: p.clientId ?? existing?.clientId ?? null,
            date: p.date ?? existing?.date ?? today(),
            amount: p.amount,
            currency,
            rateToBase:
              currency === d.settings.baseCurrency ? 1 : (p.rateToBase ?? existing?.rateToBase ?? 0),
            method: p.method ?? existing?.method ?? '',
            status: p.status ?? existing?.status ?? 'Received',
            notes: p.notes ?? existing?.notes ?? '',
          }
          return { ...d, payments: [...d.payments.filter((x) => x.id !== id), row] }
        })
        return id
      },

      deletePayment(id) {
        setData((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== id) }))
      },

      saveDay(day) {
        setData((d) => ({ ...d, days: [...d.days.filter((x) => x.date !== day.date), day] }))
      },

      updateSettings(s) {
        setData((d) => ({ ...d, settings: { ...d.settings, ...s } }))
      },
    }
  }, [data])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
