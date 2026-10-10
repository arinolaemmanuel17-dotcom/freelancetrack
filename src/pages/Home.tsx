import { useStore } from '../store'
import { formatMoney, monthOf, toBase, today } from '../utils'

export function Home() {
  const { data } = useStore()
  const month = monthOf(today())
  const base = data.settings.baseCurrency

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
