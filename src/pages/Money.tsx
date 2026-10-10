import { useMemo, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Badge, ConfirmButton, Empty, Field, Modal, Options } from '../components/ui'
import type { Payment, PaymentStatus } from '../types'
import { clientName, formatMoney, monthOf, orderTitle, toBase, today } from '../utils'

export function Money({ initialId }: { initialId?: string | null }) {
  const { data } = useStore()
  const base = data.settings.baseCurrency
  const [filter, setFilter] = useState<PaymentStatus | 'All'>('All')
  const [editing, setEditing] = useState<Payment | 'new' | null>(() => {
    if (initialId === 'new') return 'new'
    return initialId ? (data.payments.find((p) => p.id === initialId) ?? null) : null
  })

  const month = monthOf(today())
  const received = data.payments
    .filter((p) => p.status === 'Received' && monthOf(p.date) === month)
    .reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0)
  const expected = data.payments
    .filter((p) => p.status === 'Expected')
    .reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0)
  const allReceived = data.payments
    .filter((p) => p.status === 'Received')
    .reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0)

  const rows = useMemo(
    () =>
      data.payments
        .filter((p) => filter === 'All' || p.status === filter)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.payments, filter],
  )

  return (
    <div className="page">
      <div className="page-head">
        <h1>Money</h1>
        <button className="primary" onClick={() => setEditing('new')} disabled={data.settings.currencies.length === 0}>
          Add payment
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <span>Received this month</span>
          <strong>{formatMoney(received, base)}</strong>
        </div>
        <div className="stat">
          <span>Expected</span>
          <strong>{formatMoney(expected, base)}</strong>
        </div>
        <div className="stat">
          <span>Received, all time</span>
          <strong>{formatMoney(allReceived, base)}</strong>
        </div>
      </div>

      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value as PaymentStatus | 'All')}>
          <option value="All">All payments</option>
          <option value="Received">Received</option>
          <option value="Expected">Expected</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty>No payments yet.</Empty>
      ) : (
        <ul className="list">
          {rows.map((p) => (
            <li key={p.id} className="row">
              <button className="link grow left" onClick={() => setEditing(p)}>
                <strong>{formatMoney(p.amount, p.currency)}</strong>
                <span className="muted">
                  {' '}
                  {p.orderId ? orderTitle(data, p.orderId) : clientName(data, p.clientId)}
                </span>
              </button>
              <Badge tone={p.status === 'Received' ? 'good' : 'warn'}>{p.status}</Badge>
              <span className="muted small">{p.date}</span>
              <span className="muted small">{p.method}</span>
            </li>
          ))}
        </ul>
      )}

      {editing && <PaymentForm payment={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PaymentForm({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const { data, savePayment, deletePayment } = useStore()
  const base = data.settings.baseCurrency
  const [orderId, setOrderId] = useState(payment?.orderId ?? '')
  const [date, setDate] = useState(payment?.date ?? today())
  const [amount, setAmount] = useState(payment ? String(payment.amount) : '')
  const [currency, setCurrency] = useState(payment?.currency ?? base)
  const [rate, setRate] = useState(payment ? String(payment.rateToBase) : '')
  const [method, setMethod] = useState(payment?.method ?? data.settings.methods[0] ?? '')
  const [status, setStatus] = useState<PaymentStatus>(payment?.status ?? 'Received')
  const [notes, setNotes] = useState(payment?.notes ?? '')

  const order = data.orders.find((o) => o.id === orderId)
  const foreign = currency !== base

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) return
    savePayment({
      id: payment?.id,
      orderId: orderId || null,
      clientId: order?.clientId ?? payment?.clientId ?? null,
      date,
      amount: amt,
      currency,
      rateToBase: foreign ? Number(rate) || 0 : 1,
      method,
      status,
      notes: notes.trim(),
    })
    onClose()
  }

  return (
    <Modal title={payment ? 'Edit payment' : 'New payment'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Order (optional)" wide>
          <select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">No order</option>
            {data.orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} ({clientName(data, o.clientId)})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
            <option>Received</option>
            <option>Expected</option>
          </select>
        </Field>
        <Field label="Amount *">
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <Options values={data.settings.currencies} />
          </select>
        </Field>
        {foreign && (
          <Field label={`Rate on this day (${base} per 1 ${currency})`}>
            <input type="number" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </Field>
        )}
        <Field label="Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <Options values={data.settings.methods} />
          </select>
        </Field>
        <Field label="Notes" wide>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="actions">
          {payment && (
            <ConfirmButton
              label="Delete"
              question="Delete this payment?"
              onConfirm={() => {
                deletePayment(payment.id)
                onClose()
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
