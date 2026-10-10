import { useMemo, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Badge, ConfirmButton, Empty, Field, Modal, Options } from '../components/ui'
import { ORDER_STATUSES, type Order, type OrderStatus } from '../types'
import { attentionItems, clientName, formatMoney, receivedFor, today } from '../utils'

const TONE: Record<OrderStatus, 'good' | 'warn' | 'bad' | 'muted'> = {
  Lead: 'muted',
  Proposal: 'muted',
  'Waiting on client': 'warn',
  Active: 'good',
  Delivered: 'warn',
  Paid: 'good',
  'On hold': 'muted',
  Cancelled: 'bad',
}

export function Orders({ initialId }: { initialId?: string | null }) {
  const { data } = useStore()
  const [status, setStatus] = useState<OrderStatus | 'All' | 'Open'>('Open')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Order | 'new' | null>(() => {
    if (initialId === 'new') return 'new'
    return initialId ? (data.orders.find((o) => o.id === initialId) ?? null) : null
  })

  const attention = useMemo(() => attentionItems(data, today()), [data])
  const flagged = new Set(attention.map((a) => a.orderId).filter(Boolean))

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.orders
      .filter((o) => {
        if (status === 'Open') return !['Paid', 'Cancelled'].includes(o.status)
        if (status !== 'All') return o.status === status
        return true
      })
      .filter((o) => !q || [o.title, o.service, o.notes, clientName(data, o.clientId)].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  }, [data, status, query])

  return (
    <div className="page">
      <div className="page-head">
        <h1>Orders</h1>
        <button className="primary" onClick={() => setEditing('new')} disabled={data.clients.length === 0}>
          Add order
        </button>
      </div>
      {data.clients.length === 0 && <p className="muted">Add a client first, then you can create orders for them.</p>}
      <div className="toolbar">
        <input className="search-input" placeholder="Filter orders" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | 'All' | 'Open')}>
          <option value="Open">Open orders</option>
          <option value="All">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty>No orders match this view.</Empty>
      ) : (
        <ul className="list">
          {rows.map((o) => {
            const paid = receivedFor(data, o.id)
            return (
              <li key={o.id} className="row">
                <button className="link grow left" onClick={() => setEditing(o)}>
                  <strong>{o.title}</strong>
                  <span className="muted"> {clientName(data, o.clientId)}</span>
                </button>
                <Badge tone={TONE[o.status]}>{o.status}</Badge>
                {flagged.has(o.id) && <Badge tone="bad">Check</Badge>}
                <span className="muted small">{o.dueDate ? `Due ${o.dueDate}` : 'No due date'}</span>
                <span className="small">
                  {o.price !== null ? formatMoney(o.price, o.currency) : 'No price'}
                  {o.price !== null && paid > 0 ? ` · ${formatMoney(paid, data.settings.baseCurrency)} in` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <OrderForm
          order={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function OrderForm({ order, onClose, onDone }: { order: Order | null; onClose: () => void; onDone: () => void }) {
  const { data, saveOrder, deleteOrder } = useStore()
  const [clientId, setClientId] = useState(order?.clientId ?? data.clients[0]?.id ?? '')
  const [title, setTitle] = useState(order?.title ?? '')
  const [service, setService] = useState(order?.service ?? data.settings.services[0] ?? '')
  const [status, setStatus] = useState<OrderStatus>(order?.status ?? 'Lead')
  const [platform, setPlatform] = useState(order?.platform ?? '')
  const [price, setPrice] = useState(order?.price !== null && order?.price !== undefined ? String(order.price) : '')
  const [currency, setCurrency] = useState(order?.currency ?? data.settings.baseCurrency)
  const [startDate, setStartDate] = useState(order?.startDate ?? '')
  const [dueDate, setDueDate] = useState(order?.dueDate ?? '')
  const [notes, setNotes] = useState(order?.notes ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!clientId || !title.trim()) return
    saveOrder({
      id: order?.id,
      clientId,
      title: title.trim(),
      service,
      status,
      platform,
      price: price === '' ? null : Number(price),
      currency,
      startDate: startDate || null,
      dueDate: dueDate || null,
      notes: notes.trim(),
    })
    onDone()
  }

  return (
    <Modal title={order ? 'Edit order' : 'New order'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Client *">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order title *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="Service">
          <select value={service} onChange={(e) => setService(e.target.value)}>
            <Options values={data.settings.services} />
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            <Options values={ORDER_STATUSES} />
          </select>
        </Field>
        <Field label="Price">
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <Options values={data.settings.currencies} />
          </select>
        </Field>
        <Field label="Start date">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Due date">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Platform">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">-</option>
            <Options values={data.settings.platforms} />
          </select>
        </Field>
        <Field label="Notes" wide>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="actions">
          {order && (
            <ConfirmButton
              label="Delete"
              question="Delete this order and its payments?"
              onConfirm={() => {
                deleteOrder(order.id)
                onDone()
              }}
            />
          )}
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
