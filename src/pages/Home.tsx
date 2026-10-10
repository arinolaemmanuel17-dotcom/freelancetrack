import { useStore } from '../store'
import { formatMoney, monthOf, toBase, today } from '../utils'
import type { Page } from '../App'

export function Home({ go }: { go: (p: Page, id?: string | null) => void }) {
  const { data, resetAll, loadExamples, mode } = useStore()
  const month = monthOf(today())
  const base = data.settings.baseCurrency

  const received = data.payments
    .filter((p) => p.status === 'Received' && monthOf(p.date) === month)
    .reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0)

  const expected = data.payments
    .filter((p) => p.status === 'Expected')
    .reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0)

  const openOrders = data.orders.filter((o) => !['Paid', 'Cancelled'].includes(o.status)).length
  const isEmpty = data.clients.length === 0 && data.orders.length === 0 && data.payments.length === 0

  return (
    <div className="page">
      {data.example && (
        <div className="banner" role="status">
          <span className="grow">
            You're looking at example data. Try adding, editing and deleting things, then clear it when you're ready to
            start for real.
          </span>
          <button className="primary" onClick={resetAll}>
            Clear examples and start
          </button>
        </div>
      )}

      <h1>Home</h1>

      {isEmpty ? (
        <section className="card welcome">
          <h2>Start with your first client</h2>
          <p className="muted">
            Add a client, then create an order for them and record payments as they come in. Anything that needs your
            attention shows up under the bell at the top.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => go('clients', 'new')}>
              Add your first client
            </button>
            {mode === 'local' && (
              <button className="ghost" onClick={loadExamples}>
                Load example data
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
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

          <p className="muted small">
            {data.clients.length} client(s), {data.orders.length} order(s), {data.payments.length} payment(s),{' '}
            {data.days.length} daily check-in(s).
          </p>
        </>
      )}
    </div>
  )
}
