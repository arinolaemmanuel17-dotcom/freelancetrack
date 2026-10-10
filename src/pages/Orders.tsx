import { useMemo, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Badge, Empty } from '../components/ui'
import { ExpenseForm, OrderForm, PaymentForm } from '../components/Forms'
import { Icon } from '../components/Icon'
import type { Go } from '../App'
import { ORDER_STATUSES, OPEN_STATUSES, type Order, type OrderStatus } from '../types'
import { clientName, daysBetween, formatMoney, orderBalance, orderReceived, today } from '../utils'
import { newId } from '../storage'

const TONE: Record<OrderStatus, 'good' | 'warn' | 'bad' | 'muted' | 'info'> = {
  Lead: 'muted',
  Proposal: 'info',
  'Waiting on client': 'warn',
  Active: 'info',
  Delivered: 'warn',
  Paid: 'good',
  'On hold': 'muted',
  Cancelled: 'bad',
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return <Badge tone={TONE[status]}>{status}</Badge>
}

type View = 'open' | 'overdue' | 'unpaid' | 'all' | OrderStatus

function dueLabel(o: Order, now: string): { text: string; tone: 'bad' | 'warn' | 'muted' } | null {
  if (!o.dueDate || !OPEN_STATUSES.includes(o.status)) return null
  const d = daysBetween(now, o.dueDate)
  if (d < 0) return { text: `${-d}d overdue`, tone: 'bad' }
  if (d === 0) return { text: 'Due today', tone: 'warn' }
  if (d <= 2) return { text: `Due in ${d}d`, tone: 'warn' }
  return { text: `Due ${o.dueDate}`, tone: 'muted' }
}

export function Orders({ go, initialId }: { go: Go; initialId?: string | null }) {
  const { data } = useStore()
  const [view, setView] = useState<View>('open')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(initialId === 'new')
  const now = today()

  const counts = useMemo(() => {
    const open = data.orders.filter((o) => !['Paid', 'Cancelled'].includes(o.status))
    return {
      open: open.length,
      overdue: open.filter((o) => o.dueDate && o.dueDate < now && OPEN_STATUSES.includes(o.status)).length,
      unpaid: data.orders.filter((o) => o.status === 'Delivered').length,
    }
  }, [data.orders, now])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.orders
      .filter((o) => {
        if (view === 'open') return !['Paid', 'Cancelled'].includes(o.status)
        if (view === 'overdue') return !!o.dueDate && o.dueDate < now && OPEN_STATUSES.includes(o.status)
        if (view === 'unpaid') return o.status === 'Delivered'
        if (view === 'all') return true
        return o.status === view
      })
      .filter((o) => !q || [o.title, o.service, o.notes, clientName(data, o.clientId)].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  }, [data, view, query, now])

  const chips: { id: View; label: string; count?: number }[] = [
    { id: 'open', label: 'Open', count: counts.open },
    { id: 'overdue', label: 'Overdue', count: counts.overdue },
    { id: 'unpaid', label: 'Delivered, not paid', count: counts.unpaid },
    { id: 'all', label: 'All' },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Orders</h1>
          <p className="muted small">{counts.open} open · {counts.overdue} overdue</p>
        </div>
        <button className="primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> New order
        </button>
      </div>

      <div className="chips" role="tablist" aria-label="Order views">
        {chips.map((c) => (
          <button key={c.id} role="tab" aria-selected={view === c.id} className={view === c.id ? 'chip active' : 'chip'} onClick={() => setView(c.id)}>
            {c.label}
            {c.count !== undefined && <span className="chip-count">{c.count}</span>}
          </button>
        ))}
        <select
          id="order-stage-filter"
          className="chip-select"
          value={ORDER_STATUSES.includes(view as OrderStatus) ? view : ''}
          onChange={(e) => setView((e.target.value || 'all') as View)}
          aria-label="Filter by stage"
        >
          <option value="">By stage…</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <input id="order-filter" className="search-input" placeholder="Filter by job, client, service or notes" value={query} onChange={(e) => setQuery(e.target.value)} />

      {rows.length === 0 ? (
        <Empty>{data.orders.length === 0 ? 'No orders yet. Create your first order.' : 'No orders in this view.'}</Empty>
      ) : (
        <div className="table-card">
          <div className="trow thead orders-grid">
            <span>Job</span>
            <span>Stage</span>
            <span>Due</span>
            <span className="right">Price</span>
            <span className="right">Balance</span>
          </div>
          {rows.map((o) => {
            const bal = orderBalance(data, o)
            const due = dueLabel(o, now)
            return (
              <div key={o.id} className="trow orders-grid clickable" onClick={() => go('order', o.id)}>
                <span className="cell-main">
                  <span>
                    <strong>{o.title}</strong>
                    <span className="muted small block">{clientName(data, o.clientId)}{o.service ? ` · ${o.service}` : ''}</span>
                  </span>
                </span>
                <span data-label="Stage"><StatusPill status={o.status} /></span>
                <span data-label="Due">{due ? <span className={`small ${due.tone}-text`}>{due.text}</span> : <span className="muted small">{o.dueDate ?? 'No date'}</span>}</span>
                <span className="right num" data-label="Price">{o.price !== null ? formatMoney(o.price, o.currency) : <span className="muted">Not agreed</span>}</span>
                <span className="right num" data-label="Balance">
                  {bal === null ? '–' : bal > 0 ? formatMoney(bal, o.currency) : <span className="good-text">Settled</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {adding && <OrderForm order={null} onClose={() => setAdding(false)} onSaved={(id) => go('order', id)} />}
    </div>
  )
}

export function OrderDetail({ go, id }: { go: Go; id: string }) {
  const { data, saveOrder } = useStore()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)
  const [spending, setSpending] = useState(false)
  const [newItem, setNewItem] = useState('')
  const order = data.orders.find((o) => o.id === id)
  const now = today()

  if (!order) {
    return (
      <div className="page">
        <button className="link back" onClick={() => go('orders')}>
          <Icon name="back" size={18} /> Orders
        </button>
        <Empty>This order was deleted or doesn't exist.</Empty>
      </div>
    )
  }

  const received = orderReceived(data, order)
  const bal = orderBalance(data, order)
  const due = dueLabel(order, now)
  const payments = data.payments.filter((p) => p.orderId === id).sort((a, b) => b.date.localeCompare(a.date))
  const expenses = data.expenses.filter((e) => e.orderId === id)
  const done = order.checklist.filter((c) => c.done).length
  const pct = order.price ? Math.min(100, Math.round((received / order.price) * 100)) : 0

  const update = (patch: Partial<Order>) => saveOrder({ ...order, ...patch })

  const addItem = (e: FormEvent) => {
    e.preventDefault()
    if (!newItem.trim()) return
    update({ checklist: [...order.checklist, { id: newId(), text: newItem.trim(), done: false }] })
    setNewItem('')
  }

  return (
    <div className="page">
      <button className="link back" onClick={() => go('orders')}>
        <Icon name="back" size={18} /> Orders
      </button>

      <div className="detail-head">
        <div className="grow">
          <h1>{order.title}</h1>
          <p className="muted small">
            <button className="link inline" onClick={() => go('client', order.clientId)}>
              {clientName(data, order.clientId)}
            </button>
            {order.service ? ` · ${order.service}` : ''}
            {order.platform ? ` · ${order.platform}` : ''}
          </p>
        </div>
        <div className="head-actions">
          <select id="detail-stage" className="stage-select" value={order.status} onChange={(e) => update({ status: e.target.value as OrderStatus })} aria-label="Stage">
            {ORDER_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="ghost" onClick={() => setEditing(true)}>
            <Icon name="edit" size={18} /> Edit
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span>Price</span>
          <strong>{order.price !== null ? formatMoney(order.price, order.currency) : 'Not agreed'}</strong>
        </div>
        <div className="stat">
          <span>Received</span>
          <strong>{formatMoney(received, order.currency)}</strong>
          {order.price ? (
            <span className="meter" aria-label={`${pct}% paid`}>
              <span style={{ width: `${pct}%` }} />
            </span>
          ) : null}
        </div>
        <div className="stat">
          <span>Balance due</span>
          <strong className={bal ? 'warn-text' : ''}>{bal === null ? '–' : bal > 0 ? formatMoney(bal, order.currency) : 'Settled'}</strong>
        </div>
        <div className="stat">
          <span>Due date</span>
          <strong>{order.dueDate ?? 'Not set'}</strong>
          {due && <small className={`${due.tone}-text`}>{due.text}</small>}
        </div>
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <h2>Checklist</h2>
            <span className="muted small">
              {done} of {order.checklist.length} done
            </span>
          </div>
          {order.checklist.length === 0 && <p className="muted small">Break the job into steps so nothing gets missed.</p>}
          <ul className="checklist">
            {order.checklist.map((item) => (
              <li key={item.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => update({ checklist: order.checklist.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)) })}
                  />
                  <span className={item.done ? 'done' : ''}>{item.text}</span>
                </label>
                <button className="ghost icon-btn" aria-label={`Remove ${item.text}`} onClick={() => update({ checklist: order.checklist.filter((c) => c.id !== item.id) })}>
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
          <form className="inline-add" onSubmit={addItem}>
            <input id="checklist-new" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a step" aria-label="New checklist step" />
            <button type="submit" className="ghost">Add</button>
          </form>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Payments</h2>
            <button className="primary small-btn" onClick={() => setPaying(true)}>
              <Icon name="plus" size={16} /> Record payment
            </button>
          </div>
          {payments.length === 0 ? (
            <p className="muted small">No payments for this order yet.</p>
          ) : (
            <ul className="rows">
              {payments.map((p) => (
                <li key={p.id}>
                  <span className="grow">
                    <strong className="num">{formatMoney(p.amount, p.currency)}</strong>
                    <span className="muted small block">{p.date} · {p.method || 'Method not set'}{p.notes ? ` · ${p.notes}` : ''}</span>
                  </span>
                  <Badge tone={p.status === 'Received' ? 'good' : 'warn'}>{p.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="card-head sub">
            <h3>Costs for this job</h3>
            <button className="ghost small-btn" onClick={() => setSpending(true)}>
              <Icon name="plus" size={16} /> Add cost
            </button>
          </div>
          {expenses.length === 0 ? (
            <p className="muted small">No costs linked to this order.</p>
          ) : (
            <ul className="rows">
              {expenses.map((e) => (
                <li key={e.id}>
                  <span className="grow">
                    <strong className="num">{formatMoney(e.amount, e.currency)}</strong>
                    <span className="muted small block">{e.date} · {e.category}{e.notes ? ` · ${e.notes}` : ''}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {order.notes && (
        <section className="card">
          <h2>Notes</h2>
          <p className="prewrap">{order.notes}</p>
        </section>
      )}

      {editing && <OrderForm order={order} onClose={() => setEditing(false)} onDeleted={() => go('orders')} />}
      {paying && (
        <PaymentForm
          payment={null}
          prefill={{ orderId: order.id, clientId: order.clientId, amount: bal && bal > 0 ? bal : undefined, currency: order.currency }}
          onClose={() => setPaying(false)}
        />
      )}
      {spending && <ExpenseForm expense={null} prefillOrderId={order.id} onClose={() => setSpending(false)} />}
    </div>
  )
}
