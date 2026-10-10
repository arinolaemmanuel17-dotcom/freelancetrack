import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Badge, Empty } from '../components/ui'
import { ClientForm, OrderForm, PaymentForm } from '../components/Forms'
import { Icon } from '../components/Icon'
import type { Go } from '../App'
import { clientStats, daysBetween, formatMoney, initials, orderBalance, today } from '../utils'
import { StatusPill } from './Orders'

type Sort = 'name' | 'paid' | 'contact'

export function Clients({ go, initialId }: { go: Go; initialId?: string | null }) {
  const { data, markContact } = useStore()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const [adding, setAdding] = useState(initialId === 'new')
  const base = data.settings.baseCurrency

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.clients
      .filter((c) => !q || [c.name, c.contact, c.platform, c.notes].some((v) => v.toLowerCase().includes(q)))
      .map((c) => ({ c, st: clientStats(data, c.id) }))
      .sort((a, b) =>
        sort === 'paid'
          ? b.st.received - a.st.received
          : sort === 'contact'
            ? (b.c.lastContact ?? '').localeCompare(a.c.lastContact ?? '')
            : a.c.name.localeCompare(b.c.name),
      )
  }, [data, query, sort])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <p className="muted small">{data.clients.length} client(s)</p>
        </div>
        <button className="primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> New client
        </button>
      </div>

      <div className="toolbar">
        <input id="client-filter" className="search-input" placeholder="Filter by name, contact or notes" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select id="client-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort clients">
          <option value="name">A to Z</option>
          <option value="paid">Paid you the most</option>
          <option value="contact">Recently contacted</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <Empty>{data.clients.length === 0 ? 'No clients yet. Add your first client to get started.' : 'No clients match that filter.'}</Empty>
      ) : (
        <div className="table-card">
          <div className="trow thead clients-grid">
            <span>Client</span>
            <span>Open</span>
            <span className="right">Paid you</span>
            <span className="right">Owes you</span>
            <span>Last contact</span>
            <span />
          </div>
          {rows.map(({ c, st }) => {
            const gap = c.lastContact ? daysBetween(c.lastContact, today()) : null
            return (
              <div key={c.id} className="trow clients-grid clickable" onClick={() => go('client', c.id)}>
                <span className="cell-main">
                  <span className="avatar" aria-hidden="true">{initials(c.name)}</span>
                  <span>
                    <strong>{c.name}</strong>
                    <span className="muted small block">{c.platform || 'Source not set'}</span>
                  </span>
                </span>
                <span data-label="Open">{st.openOrders > 0 ? <Badge tone="good">{st.openOrders} open</Badge> : <span className="muted">None</span>}</span>
                <span className="right num" data-label="Paid you">{formatMoney(st.received, base)}</span>
                <span className="right num" data-label="Owes you">{st.outstanding > 0 ? formatMoney(st.outstanding, base) : '–'}</span>
                <span className="muted small" data-label="Last contact">
                  {gap === null ? 'Never' : gap === 0 ? 'Today' : `${gap} days ago`}
                </span>
                <span className="right">
                  <button
                    className="ghost small-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      markContact(c.id)
                    }}
                  >
                    Log contact
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {adding && <ClientForm client={null} onClose={() => setAdding(false)} onSaved={(id) => go('client', id)} onOpenExisting={(id) => go('client', id)} />}
    </div>
  )
}

export function ClientDetail({ go, id }: { go: Go; id: string }) {
  const { data, markContact } = useStore()
  const [editing, setEditing] = useState(false)
  const [newOrder, setNewOrder] = useState(false)
  const [newPayment, setNewPayment] = useState(false)
  const client = data.clients.find((c) => c.id === id)
  const base = data.settings.baseCurrency

  if (!client) {
    return (
      <div className="page">
        <button className="link back" onClick={() => go('clients')}>
          <Icon name="back" size={18} /> Clients
        </button>
        <Empty>This client was deleted or doesn't exist.</Empty>
      </div>
    )
  }

  const st = clientStats(data, id)
  const orders = data.orders.filter((o) => o.clientId === id).sort((a, b) => (b.startDate ?? b.createdAt).localeCompare(a.startDate ?? a.createdAt))
  const payments = data.payments.filter((p) => p.clientId === id).sort((a, b) => b.date.localeCompare(a.date))
  const gap = client.lastContact ? daysBetween(client.lastContact, today()) : null

  return (
    <div className="page">
      <button className="link back" onClick={() => go('clients')}>
        <Icon name="back" size={18} /> Clients
      </button>

      <div className="detail-head">
        <span className="avatar lg" aria-hidden="true">{initials(client.name)}</span>
        <div className="grow">
          <h1>{client.name}</h1>
          <p className="muted small">
            {client.platform || 'Source not set'} · {gap === null ? 'No contact logged' : gap === 0 ? 'Contacted today' : `Last contact ${gap} days ago`}
          </p>
          {client.contact && <p className="contact-line selectable">{client.contact}</p>}
        </div>
        <div className="head-actions">
          <button className="ghost" onClick={() => markContact(client.id)}>
            <Icon name="phone" size={18} /> Log contact
          </button>
          <button className="ghost" onClick={() => setEditing(true)}>
            <Icon name="edit" size={18} /> Edit
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span>Paid you</span>
          <strong>{formatMoney(st.received, base)}</strong>
        </div>
        <div className="stat">
          <span>Still owes you</span>
          <strong>{formatMoney(st.outstanding, base)}</strong>
        </div>
        <div className="stat">
          <span>Orders</span>
          <strong>{st.orders}</strong>
          <small className="muted">{st.openOrders} open</small>
        </div>
      </div>

      {client.notes && (
        <section className="card">
          <h2>Notes</h2>
          <p className="prewrap">{client.notes}</p>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Orders</h2>
          <button className="ghost small-btn" onClick={() => setNewOrder(true)}>
            <Icon name="plus" size={16} /> New order
          </button>
        </div>
        {orders.length === 0 ? (
          <p className="muted small">No orders for this client yet.</p>
        ) : (
          <ul className="rows">
            {orders.map((o) => {
              const bal = orderBalance(data, o)
              return (
                <li key={o.id} className="clickable" onClick={() => go('order', o.id)}>
                  <span className="grow">
                    <strong>{o.title}</strong>
                    <span className="muted small block">{o.service || 'No service'}{o.dueDate ? ` · due ${o.dueDate}` : ''}</span>
                  </span>
                  <StatusPill status={o.status} />
                  <span className="num right">
                    {o.price !== null ? formatMoney(o.price, o.currency) : <span className="muted">No price</span>}
                    {bal !== null && bal > 0 && !['Lead', 'Proposal'].includes(o.status) && <span className="small warn-text block">{formatMoney(bal, o.currency)} due</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Payments</h2>
          <button className="ghost small-btn" onClick={() => setNewPayment(true)}>
            <Icon name="plus" size={16} /> Record payment
          </button>
        </div>
        {payments.length === 0 ? (
          <p className="muted small">No payments from this client yet.</p>
        ) : (
          <ul className="rows">
            {payments.map((p) => (
              <li key={p.id}>
                <span className="grow">
                  <strong className="num">{formatMoney(p.amount, p.currency)}</strong>
                  <span className="muted small block">
                    {p.date} · {p.method || 'Method not set'}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </span>
                </span>
                <Badge tone={p.status === 'Received' ? 'good' : 'warn'}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && <ClientForm client={client} onClose={() => setEditing(false)} />}
      {newOrder && <OrderForm order={null} prefillClientId={client.id} onClose={() => setNewOrder(false)} onSaved={(oid) => go('order', oid)} />}
      {newPayment && <PaymentForm payment={null} prefill={{ clientId: client.id }} onClose={() => setNewPayment(false)} />}
    </div>
  )
}
