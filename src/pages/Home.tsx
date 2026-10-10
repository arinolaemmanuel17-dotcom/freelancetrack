import { useMemo } from 'react'
import { useStore } from '../store'
import { attentionItems, formatMoney, monthOf, toBase, today } from '../utils'
import { Badge, Empty } from '../components/ui'
import type { Page } from '../App'

export function Home({ go }: { go: (p: Page) => void }) {
  const { data } = useStore()
  const now = today()
  const month = monthOf(now)
  const base = data.settings.baseCurrency

  const items = useMemo(() => attentionItems(data, now), [data, now])

  const received = data.payments
    .filter((p) => p.status === 'Received' && monthOf(p.date) === month)
    .reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0)

  const expected = data.payments
    .filter((p) => p.status === 'Expected')
    .reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0)

  const openOrders = data.orders.filter((o) => !['Paid', 'Cancelled'].includes(o.status)).length

  return (
    <div className="page">
      <h1>Home</h1>
      <div className="stats">
        <div className="stat">
          <span>Received this month</span>
          <strong>{formatMoney(received, base)}</strong>
        </div>
        <div className="stat">
          <span>Expected (not yet received)</span>
          <strong>{formatMoney(expected, base)}</strong>
        </div>
        <div className="stat">
          <span>Open orders</span>
          <strong>{openOrders}</strong>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Needs attention</h2>
          <span className="muted">{items.length} item(s)</span>
        </div>
        {items.length === 0 ? (
          <Empty>Nothing needs attention right now.</Empty>
        ) : (
          <ul className="list">
            {items.map((i) => (
              <li key={i.id}>
                <Badge tone={i.level === 'high' ? 'bad' : i.level === 'medium' ? 'warn' : 'muted'}>
                  {i.level === 'high' ? 'Urgent' : i.level === 'medium' ? 'Soon' : 'Check'}
                </Badge>
                <span className="grow">{i.text}</span>
                <button className="link" onClick={() => go(i.orderId ? 'orders' : 'clients')}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Quick counts</h2>
        </div>
        <p className="muted">
          {data.clients.length} client(s), {data.orders.length} order(s), {data.payments.length} payment(s),{' '}
          {data.days.length} daily check-in(s).
        </p>
      </section>
    </div>
  )
}
