import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { ConfirmButton, Field, Modal, Options } from './ui'
import { ORDER_STATUSES, type Client, type Expense, type Order, type OrderStatus, type Payment, type PaymentStatus } from '../types'
import { clientName, similarClients, today } from '../utils'

function Actions({ onClose, onDelete, deleteQuestion }: { onClose: () => void; onDelete?: () => void; deleteQuestion?: string }) {
  return (
    <div className="actions">
      {onDelete && <ConfirmButton label="Delete" question={deleteQuestion ?? 'Delete this?'} onConfirm={onDelete} />}
      <span className="grow" />
      <button type="button" className="ghost" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" className="primary">
        Save
      </button>
    </div>
  )
}

// ---------- Client ----------
export function ClientForm({
  client,
  onClose,
  onSaved,
  onOpenExisting,
}: {
  client: Client | null
  onClose: () => void
  onSaved?: (id: string) => void
  onOpenExisting?: (id: string) => void
}) {
  const { data, saveClient, deleteClient } = useStore()
  const [name, setName] = useState(client?.name ?? '')
  const [contact, setContact] = useState(client?.contact ?? '')
  const [platform, setPlatform] = useState(client?.platform ?? '')
  const [notes, setNotes] = useState(client?.notes ?? '')
  const similar = client ? [] : similarClients(data, name)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const id = saveClient({ id: client?.id, name: name.trim(), contact: contact.trim(), platform, notes: notes.trim() })
    onSaved?.(id)
    onClose()
  }

  return (
    <Modal title={client ? 'Edit client' : 'New client'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Name *" wide>
          <input id="client-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        {similar.length > 0 && (
          <div className="hint wide" role="status">
            <span>Already have a similar client:</span>
            {similar.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                onClick={() => {
                  onClose()
                  onOpenExisting?.(c.id)
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        <Field label="Contact (email, phone or handle)">
          <input id="client-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
        </Field>
        <Field label="Where they came from">
          <select id="client-platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">Not set</option>
            <Options values={data.settings.platforms} />
          </select>
        </Field>
        <Field label="Notes" wide>
          <textarea id="client-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Actions
          onClose={onClose}
          deleteQuestion="Delete this client and all their orders and payments?"
          onDelete={
            client
              ? () => {
                  deleteClient(client.id)
                  onClose()
                }
              : undefined
          }
        />
      </form>
    </Modal>
  )
}

// ---------- Order ----------
const NEW_CLIENT = '__new__'

export function OrderForm({
  order,
  prefillClientId,
  onClose,
  onSaved,
  onDeleted,
}: {
  order: Order | null
  prefillClientId?: string | null
  onClose: () => void
  onSaved?: (id: string) => void
  onDeleted?: () => void
}) {
  const { data, saveOrder, deleteOrder, saveClient } = useStore()
  const s = data.settings
  const lastOrderOf = (cid: string) =>
    [...data.orders].filter((o) => o.clientId === cid).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  const initialClient = order?.clientId ?? prefillClientId ?? data.clients[0]?.id ?? NEW_CLIENT
  const seed = !order && initialClient !== NEW_CLIENT ? lastOrderOf(initialClient) : undefined

  const [clientId, setClientId] = useState(initialClient)
  const [newClientName, setNewClientName] = useState('')
  const [title, setTitle] = useState(order?.title ?? '')
  const [service, setService] = useState(order?.service ?? seed?.service ?? s.services[0] ?? '')
  const [status, setStatus] = useState<OrderStatus>(order?.status ?? 'Active')
  const [platform, setPlatform] = useState(order?.platform ?? seed?.platform ?? '')
  const [price, setPrice] = useState(order?.price != null ? String(order.price) : '')
  const [currency, setCurrency] = useState(order?.currency ?? seed?.currency ?? s.baseCurrency)
  const [startDate, setStartDate] = useState(order?.startDate ?? (order ? '' : today()))
  const [dueDate, setDueDate] = useState(order?.dueDate ?? '')
  const [notes, setNotes] = useState(order?.notes ?? '')

  // For a new order, picking a client fills in what they usually use.
  const pickClient = (cid: string) => {
    setClientId(cid)
    if (order || cid === NEW_CLIENT) return
    const last = lastOrderOf(cid)
    if (last) {
      setService(last.service || service)
      setPlatform(last.platform)
      setCurrency(last.currency)
    } else {
      const c = data.clients.find((x) => x.id === cid)
      if (c?.platform) setPlatform(c.platform)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    let cid = clientId
    if (cid === NEW_CLIENT) {
      if (!newClientName.trim()) return
      cid = saveClient({ name: newClientName.trim(), platform })
    }
    const id = saveOrder({
      id: order?.id,
      clientId: cid,
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
    onSaved?.(id)
    onClose()
  }

  return (
    <Modal title={order ? 'Edit order' : 'New order'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Client *">
          <select id="order-client" value={clientId} onChange={(e) => pickClient(e.target.value)} required>
            {data.clients
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            <option value={NEW_CLIENT}>+ New client…</option>
          </select>
        </Field>
        {clientId === NEW_CLIENT ? (
          <Field label="New client name *">
            <input id="order-new-client" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} required autoFocus />
          </Field>
        ) : (
          <span className="field-spacer" />
        )}
        <Field label="What's the job? *" wide>
          <input id="order-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Logo for new shop" required autoFocus={clientId !== NEW_CLIENT} />
        </Field>
        <Field label="Service">
          <select id="order-service" value={service} onChange={(e) => setService(e.target.value)}>
            <Options values={s.services.includes(service) || !service ? s.services : [service, ...s.services]} />
          </select>
        </Field>
        <Field label="Stage">
          <select id="order-status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            <Options values={ORDER_STATUSES} />
          </select>
        </Field>
        <Field label="Price">
          <input id="order-price" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Leave empty if not agreed" />
        </Field>
        <Field label="Currency">
          <select id="order-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <Options values={s.currencies.includes(currency) ? s.currencies : [currency, ...s.currencies]} />
          </select>
        </Field>
        <Field label="Start date">
          <input id="order-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Due date">
          <input id="order-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Platform">
          <select id="order-platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">Not set</option>
            <Options values={s.platforms} />
          </select>
        </Field>
        <span className="field-spacer" />
        <Field label="Notes" wide>
          <textarea id="order-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Actions
          onClose={onClose}
          deleteQuestion="Delete this order and its payments?"
          onDelete={
            order
              ? () => {
                  deleteOrder(order.id)
                  onClose()
                  onDeleted?.()
                }
              : undefined
          }
        />
      </form>
    </Modal>
  )
}

// ---------- Payment ----------
export function PaymentForm({
  payment,
  prefill,
  onClose,
}: {
  payment: Payment | null
  prefill?: { orderId?: string; clientId?: string; amount?: number; currency?: string }
  onClose: () => void
}) {
  const { data, savePayment, deletePayment } = useStore()
  const base = data.settings.baseCurrency
  const [orderId, setOrderId] = useState(payment?.orderId ?? prefill?.orderId ?? '')
  const [clientId, setClientId] = useState(payment?.clientId ?? prefill?.clientId ?? '')
  const [date, setDate] = useState(payment?.date ?? today())
  const [amount, setAmount] = useState(payment ? String(payment.amount) : prefill?.amount ? String(prefill.amount) : '')
  const [currency, setCurrency] = useState(payment?.currency ?? prefill?.currency ?? base)
  const [rate, setRate] = useState(payment && payment.currency !== base ? String(payment.rateToBase) : '')
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
      clientId: order?.clientId ?? (clientId || null),
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
    <Modal title={payment ? 'Edit payment' : 'Record a payment'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="For which order?" wide>
          <select
            id="pay-order"
            value={orderId}
            onChange={(e) => {
              setOrderId(e.target.value)
              const o = data.orders.find((x) => x.id === e.target.value)
              if (o && !payment) setCurrency(o.currency)
            }}
          >
            <option value="">No order</option>
            {data.orders
              .filter((o) => o.status !== 'Cancelled')
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} · {clientName(data, o.clientId)}
                </option>
              ))}
          </select>
        </Field>
        {!orderId && (
          <Field label="Client (optional)" wide>
            <select id="pay-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">No client</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Amount *">
          <input id="pay-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </Field>
        <Field label="Currency">
          <select id="pay-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <Options values={data.settings.currencies} />
          </select>
        </Field>
        {foreign && (
          <Field label={`Rate that day (${base} per 1 ${currency})`} wide>
            <input id="pay-rate" type="number" inputMode="decimal" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </Field>
        )}
        <Field label="Date">
          <input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Status">
          <select id="pay-status" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
            <option value="Received">Received</option>
            <option value="Expected">Expected (not in yet)</option>
          </select>
        </Field>
        <Field label="Method">
          <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <Options values={data.settings.methods} />
          </select>
        </Field>
        <span className="field-spacer" />
        <Field label="Notes" wide>
          <textarea id="pay-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Actions
          onClose={onClose}
          deleteQuestion="Delete this payment?"
          onDelete={
            payment
              ? () => {
                  deletePayment(payment.id)
                  onClose()
                }
              : undefined
          }
        />
      </form>
    </Modal>
  )
}

// ---------- Expense ----------
export function ExpenseForm({ expense, prefillOrderId, onClose }: { expense: Expense | null; prefillOrderId?: string; onClose: () => void }) {
  const { data, saveExpense, deleteExpense } = useStore()
  const base = data.settings.baseCurrency
  const [orderId, setOrderId] = useState(expense?.orderId ?? prefillOrderId ?? '')
  const [date, setDate] = useState(expense?.date ?? today())
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [currency, setCurrency] = useState(expense?.currency ?? base)
  const [rate, setRate] = useState(expense && expense.currency !== base ? String(expense.rateToBase) : '')
  const [category, setCategory] = useState(expense?.category ?? data.settings.categories[0] ?? '')
  const [method, setMethod] = useState(expense?.method ?? data.settings.methods[0] ?? '')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const order = data.orders.find((o) => o.id === orderId)
  const foreign = currency !== base

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) return
    saveExpense({
      id: expense?.id,
      orderId: orderId || null,
      clientId: order?.clientId ?? null,
      date,
      amount: amt,
      currency,
      rateToBase: foreign ? Number(rate) || 0 : 1,
      category,
      method,
      notes: notes.trim(),
    })
    onClose()
  }

  return (
    <Modal title={expense ? 'Edit expense' : 'Add an expense'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Amount *">
          <input id="exp-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </Field>
        <Field label="Currency">
          <select id="exp-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <Options values={data.settings.currencies} />
          </select>
        </Field>
        {foreign && (
          <Field label={`Rate that day (${base} per 1 ${currency})`} wide>
            <input id="exp-rate" type="number" inputMode="decimal" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </Field>
        )}
        <Field label="Category">
          <select id="exp-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <Options values={data.settings.categories} />
          </select>
        </Field>
        <Field label="Date">
          <input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Paid with">
          <select id="exp-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <Options values={data.settings.methods} />
          </select>
        </Field>
        <Field label="For an order? (optional)">
          <select id="exp-order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">General business cost</option>
            {data.orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} · {clientName(data, o.clientId)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What was it for?" wide>
          <input id="exp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Platform fee, monthly data" />
        </Field>
        <Actions
          onClose={onClose}
          deleteQuestion="Delete this expense?"
          onDelete={
            expense
              ? () => {
                  deleteExpense(expense.id)
                  onClose()
                }
              : undefined
          }
        />
      </form>
    </Modal>
  )
}
