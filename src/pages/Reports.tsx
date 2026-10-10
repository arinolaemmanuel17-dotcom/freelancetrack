import { useState } from 'react'
import { useStore } from '../store'
import { BarList, MonthColumns } from '../components/Chart'
import { clientName, downloadCsv, lastMonths, monthLabel, receivedIn, spentIn, toBase, today, totalOutstanding } from '../utils'

type Range = 6 | 12 | 0 // months; 0 = all time

export function Reports() {
  const { data, money, view, toView } = useStore()
  const base = data.settings.baseCurrency
  const [range, setRange] = useState<Range>(6)

  const months = lastMonths(range === 0 ? Math.max(1, monthsSinceFirst(data.payments.map((p) => p.date).concat(data.expenses.map((e) => e.date)))) : range)
  const fromDate = range === 0 ? null : `${months[0]}-01`
  const inRange = (d: string) => !fromDate || d >= fromDate

  const incomeByMonth = months.map((m) => receivedIn(data, m))
  const spendByMonth = months.map((m) => spentIn(data, m))
  const income = incomeByMonth.reduce((a, b) => a + b, 0)
  const spend = spendByMonth.reduce((a, b) => a + b, 0)
  const bestIdx = incomeByMonth.indexOf(Math.max(...incomeByMonth))

  const received = data.payments.filter((p) => p.status === 'Received' && inRange(p.date))
  const sumBy = (keyOf: (p: (typeof received)[number]) => string) => {
    const map = new Map<string, number>()
    for (const p of received) {
      const k = keyOf(p) || 'Not set'
      map.set(k, (map.get(k) ?? 0) + toBase(p.amount, p.rateToBase))
    }
    return [...map.entries()].map(([key, value]) => ({ key, value: toView(value) })).sort((a, b) => b.value - a.value)
  }
  const orderOf = (id: string | null) => data.orders.find((o) => o.id === id)
  const byClient = sumBy((p) => clientName(data, p.clientId)).slice(0, 8)
  const byService = sumBy((p) => orderOf(p.orderId)?.service ?? '')
  const byPlatform = sumBy((p) => orderOf(p.orderId)?.platform ?? data.clients.find((c) => c.id === p.clientId)?.platform ?? '')
  const byMethod = sumBy((p) => p.method)

  const spendByCat = (() => {
    const map = new Map<string, number>()
    for (const e of data.expenses) {
      if (!inRange(e.date)) continue
      map.set(e.category || 'Not set', (map.get(e.category || 'Not set') ?? 0) + toBase(e.amount, e.rateToBase))
    }
    return [...map.entries()].map(([key, value]) => ({ key, value: toView(value) })).sort((a, b) => b.value - a.value)
  })()

  const exportReport = () =>
    downloadCsv(
      `report-${today()}.csv`,
      months.map((m, i) => ({ month: m, money_in: incomeByMonth[i].toFixed(2), money_out: spendByMonth[i].toFixed(2), profit: (incomeByMonth[i] - spendByMonth[i]).toFixed(2), currency: base })),
    )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p className="muted small">All amounts in {view.currency}, using the rate saved with each payment{view.showingAlt && view.altRate ? ` and 1 ${base} = ${view.altRate.toLocaleString()} ${view.currency}` : ''}.</p>
        </div>
        <div className="head-actions">
          <div className="segmented" role="tablist" aria-label="Report period">
            {([6, 12, 0] as Range[]).map((r) => (
              <button key={r} role="tab" aria-selected={range === r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
                {r === 0 ? 'All time' : `${r} months`}
              </button>
            ))}
          </div>
          {import.meta.env.VITE_PREVIEW !== '1' && (
            <button className="ghost" onClick={exportReport}>
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="stats four">
        <div className="stat">
          <span>Money in</span>
          <strong>{money(income)}</strong>
        </div>
        <div className="stat">
          <span>Money out</span>
          <strong>{money(spend)}</strong>
        </div>
        <div className="stat">
          <span>Profit</span>
          <strong className={income - spend < 0 ? 'bad-text' : ''}>{money(income - spend)}</strong>
        </div>
        <div className="stat">
          <span>Owed to you now</span>
          <strong>{money(totalOutstanding(data))}</strong>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Money in and out by month</h2>
          {income > 0 && <span className="muted small">Best month: {monthLabel(months[bestIdx], true)}</span>}
        </div>
        <MonthColumns
          title="Money in and out by month"
          months={months.map((m) => monthLabel(m))}
          currency={view.currency}
          series={[
            { label: 'Money in', color: 'var(--series-1)', values: incomeByMonth.map(toView) },
            { label: 'Money out', color: 'var(--series-2)', values: spendByMonth.map(toView) },
          ]}
        />
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Top clients</h2>
          <BarList rows={byClient} currency={view.currency} empty="No payments in this period." />
        </section>
        <section className="card">
          <h2>By service</h2>
          <BarList rows={byService} currency={view.currency} empty="No payments linked to orders yet." />
        </section>
        <section className="card">
          <h2>By platform</h2>
          <BarList rows={byPlatform} currency={view.currency} empty="No payments in this period." />
        </section>
        <section className="card">
          <h2>By payment method</h2>
          <BarList rows={byMethod} currency={view.currency} empty="No payments in this period." />
        </section>
        <section className="card">
          <h2>Where money goes</h2>
          <BarList rows={spendByCat} currency={view.currency} empty="No expenses in this period." out />
        </section>
      </div>
    </div>
  )
}

function monthsSinceFirst(dates: string[]): number {
  if (dates.length === 0) return 6
  const first = dates.reduce((a, b) => (a < b ? a : b))
  const [y1, m1] = first.split('-').map(Number)
  const [y2, m2] = today().split('-').map(Number)
  return Math.min(60, (y2 - y1) * 12 + (m2 - m1) + 1)
}
