import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { ConfirmButton, Field, Modal, MoneyInput, Options } from './ui'
import { ORDER_STATUSES, type Client, type Expense, type Order, type OrderStatus, type Payment, type PaymentStatus } from '../types'
import { clientName, formatMoney, rateFor, similarClients, today } from '../utils'
import type { AppData } from '../types'

type ListName = 'services' | 'platforms' | 'methods' | 'categories'
const ADD = '__add__'

// A dropdown for one of your lists, with "+ Add new…" at the bottom.
// Anything you add is saved to your list, so it's there next time.
export function ListSelect({
  id,
  list,
  value,
  onChange,
  noun,
  emptyLabel,
}: {
  id: string
  list: ListName
  value: string
  onChange: (v: string) => void
  noun: string
  emptyLabel?: string
}) {
  const { data, updateSettings } = useStore()
  const items = data.settings[list]
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const options = value && !items.includes(value) ? [value, ...items] : items

  const add = () => {
    const v = text.trim()
    if (!v) return
    const existing = items.find((i) => i.toLowerCase() === v.toLowerCase())
    if (!existing) updateSettings({ [list]: [...items, v] })
    onChange(existing ?? v)
    setAdding(false)
    setText('')
  }

  if (adding) {
    return (
      <span className="add-inline">
        <input
          id={id}
          autoFocus
          value={text}
          placeholder={`New ${noun}`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
            if (e.key === 'Escape') {
              e.nativeEvent.stopPropagation()
              setAdding(false)
            }
          }}
        />
        <button type="button" className="primary small-btn" onClick={add}>
          Add
        </button>
        <button type="button" className="ghost small-btn" onClick={() => setAdding(false)}>
          Cancel
        </button>
      </span>
    )
  }

  return (
    <select id={id} value={value} onChange={(e) => (e.target.value === ADD ? setAdding(true) : onChange(e.target.value))}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={ADD}>+ Add new {noun}…</option>
    </select>
  )
}

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


// Suggested "1 main = ? other" rate: the saved second-currency rate, else the latest one used.
function suggestPerBase(data: AppData, currency: string): string {
  const s = data.settings
  if (currency === s.baseCurrency) return ''
  if (currency === s.altCurrency && s.altRate > 0) return String(s.altRate)
  const r = rateFor(data, currency)
  return r ? String(Math.round((1 / r) * 10000) / 10000) : ''
}

function RateField({ id, base, currency, perBase, setPerBase, amount }: { id: string; base: string; currency: string; perBase: string; setPerBase: (v: string) => void; amount: string }) {
  const n = Number(perBase)
  const a = Number(amount)
  return (
    <Field label={`Exchange rate that day: 1 ${base} = how many ${currency}?`} wide>
      <input id={id} type="number" inputMode="decimal" min="0" step="any" value={perBase} onChange={(e) => setPerBase(e.target.value)} placeholder={`e.g. 1500`} required />
      {n > 0 && a > 0 && <span className="muted small">That's about {formatMoney(a / n, base)}.</span>}
    </Field>
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
          <ListSelect id="client-platform" list="platforms" noun="platform" emptyLabel="Not set" value={platform} onChange={setPlatform} />
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
  const [service, setService] = useState(order?.service ?? seed?.service ?? '')
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
          <ListSelect id="order-service" list="services" noun="service" emptyLabel={s.services.length ? 'Choose a service' : 'No services yet'} value={service} onChange={setService} />
        </Field>
        <Field label="Stage">
          <select id="order-status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            <Options values={ORDER_STATUSES} />
          </select>
        </Field>
        <Field label="Price">
          <MoneyInput id="order-price" value={price} onChange={setPrice} step={s.amountStep} placeholder="Leave empty if not agreed" />
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
          <ListSelect id="order-platform" list="platforms" noun="platform" emptyLabel="Not set" value={platform} onChange={setPlatform} />
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
  const [perBase, setPerBase] = useState(() =>
    payment && payment.currency !== base && payment.rateToBase > 0
      ? String(Math.round((1 / payment.rateToBase) * 10000) / 10000)
      : suggestPerBase(data, payment?.currency ?? prefill?.currency ?? base),
  )
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
      rateToBase: foreign && Number(perBase) > 0 ? 1 / Number(perBase) : foreign ? 0 : 1,
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
              if (o && !payment) {
                setCurrency(o.currency)
                setPerBase(suggestPerBase(data, o.currency))
              }
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
          <MoneyInput id="pay-amount" value={amount} onChange={setAmount} step={data.settings.amountStep} required autoFocus />
        </Field>
        <Field label="Currency">
          <select id="pay-currency" value={currency} onChange={(e) => { setCurrency(e.target.value); setPerBase(suggestPerBase(data, e.target.value)) }}>
            <Options values={data.settings.currencies} />
          </select>
        </Field>
        {foreign && <RateField id="pay-rate" base={base} currency={currency} perBase={perBase} setPerBase={setPerBase} amount={amount} />}
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
          <ListSelect id="pay-method" list="methods" noun="method" emptyLabel="Not set" value={method} onChange={setMethod} />
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
  const [perBase, setPerBase] = useState(() =>
    expense && expense.currency !== base && expense.rateToBase > 0
      ? String(Math.round((1 / expense.rateToBase) * 10000) / 10000)
      : suggestPerBase(data, expense?.currency ?? base),
  )
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
      rateToBase: foreign && Number(perBase) > 0 ? 1 / Number(perBase) : foreign ? 0 : 1,
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
          <MoneyInput id="exp-amount" value={amount} onChange={setAmount} step={data.settings.amountStep} required autoFocus />
        </Field>
        <Field label="Currency">
          <select id="exp-currency" value={currency} onChange={(e) => { setCurrency(e.target.value); setPerBase(suggestPerBase(data, e.target.value)) }}>
            <Options values={data.settings.currencies} />
          </select>
        </Field>
        {foreign && <RateField id="exp-rate" base={base} currency={currency} perBase={perBase} setPerBase={setPerBase} amount={amount} />}
        <Field label="Category">
          <ListSelect id="exp-category" list="categories" noun="category" emptyLabel="Not set" value={category} onChange={setCategory} />
        </Field>
        <Field label="Date">
          <input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Paid with">
          <ListSelect id="exp-method" list="methods" noun="method" emptyLabel="Not set" value={method} onChange={setMethod} />
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

// Tap to pick one or more from your list; "+ Add new" saves a new option for next time.
export function ChipPicker({
  id,
  list,
  selected,
  onChange,
  noun,
  single,
}: {
  id: string
  list: 'platforms' | 'activities'
  selected: string[]
  onChange: (v: string[]) => void
  noun: string
  single?: boolean // pick just one
}) {
  const { data, updateSettings } = useStore()
  const items = data.settings[list]
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const all = [...items, ...selected.filter((s) => !items.includes(s))]
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : single ? [v] : [...selected, v])
  const add = () => {
    const v = text.trim()
    if (!v) return
    const existing = items.find((i) => i.toLowerCase() === v.toLowerCase())
    if (!existing) updateSettings({ [list]: [...items, v] })
    const value = existing ?? v
    if (!selected.includes(value)) onChange(single ? [value] : [...selected, value])
    setText('')
    setAdding(false)
  }
  return (
    <div className="chips picker" role="group" aria-label={noun}>
      {all.map((v) => (
        <button key={v} type="button" className={selected.includes(v) ? 'chip active' : 'chip'} aria-pressed={selected.includes(v)} onClick={() => toggle(v)}>
          {selected.includes(v) && <Check />}
          {v}
        </button>
      ))}
      {adding ? (
        <span className="add-inline chip-add">
          <input
            id={id}
            autoFocus
            value={text}
            placeholder={`New ${noun}`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
              if (e.key === 'Escape') {
                e.nativeEvent.stopPropagation()
                setAdding(false)
              }
            }}
          />
          <button type="button" className="primary small-btn" onClick={add}>
            Add
          </button>
        </span>
      ) : (
        <button type="button" className="chip add-chip" onClick={() => setAdding(true)}>
          + Add new
        </button>
      )}
    </div>
  )
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  )
}
