import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { MonthColumns } from '../components/Chart'
import { clientName, daysBetween, downloadCsv, lastMonths, monthLabel, orderToBase, receivedIn, spentIn, toBase, today, totalOutstanding } from '../utils'
import { OPEN_STATUSES } from '../types'

type Range = 3 | 6 | 12 | 0 // months; 0 = all time

function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={tone ? `${tone}-text` : ''}>{value}</strong>
      {note && <small className="muted">{note}</small>}
    </div>
  )
}

const pct = (n: number) => `${Math.round(n * 100)}%`

export function Reports() {
  const { data, money, toView, view } = useStore()
  const [range, setRange] = useState<Range>(6)
  const now = today()

  const allDates = [...data.payments.map((p) => p.date), ...data.expenses.map((e) => e.date), ...data.orders.map((o) => (o.startDate ?? o.createdAt).slice(0, 10))]
  const spanAll = (() => {
    if (!allDates.length) return 6
    const first = allDates.reduce((a, b) => (a < b ? a : b))
    const [y1, m1] = first.split('-').map(Number)
    const [y2, m2] = now.split('-').map(Number)
    return Math.min(60, Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1))
  })()
  const months = lastMonths(range === 0 ? spanAll : range)
  const from = `${months[0]}-01`
  const inRange = (d: string) => d >= from && d <= now

  // ---------- money ----------
  const incomeByMonth = months.map((m) => receivedIn(data, m))
  const spendByMonth = months.map((m) => spentIn(data, m))
  const income = incomeByMonth.reduce((a, b) => a + b, 0)
  const spend = spendByMonth.reduce((a, b) => a + b, 0)
  const profit = income - spend
  const received = data.payments.filter((p) => p.status === 'Received' && inRange(p.date))
  const bestIdx = incomeByMonth.indexOf(Math.max(...incomeByMonth))
  const activeMonths = incomeByMonth.filter((v) => v > 0).length

  // ---------- orders ----------
  const started = data.orders.filter((o) => inRange((o.startDate ?? o.createdAt).slice(0, 10)))
  const completed = data.orders.filter((o) => o.status === 'Completed' && o.completedAt && inRange(o.completedAt))
  const cancelled = started.filter((o) => o.status === 'Cancelled')
  const priced = started.filter((o) => o.status !== 'Cancelled' && o.price !== null)
  const avgOrder = priced.length ? priced.reduce((s, o) => s + (orderToBase(data, o, o.price as number) ?? 0), 0) / priced.length : 0
  const withDue = completed.filter((o) => o.dueDate)
  const onTime = withDue.filter((o) => (o.completedAt as string) <= (o.dueDate as string)).length
  const withStart = completed.filter((o) => o.startDate)
  const avgDays = withStart.length ? withStart.reduce((s, o) => s + Math.max(0, daysBetween(o.startDate as string, o.completedAt as string)), 0) / withStart.length : null
  const openNow = data.orders.filter((o) => OPEN_STATUSES.includes(o.status))
  const pipeline = data.orders
    .filter((o) => ['Lead', 'Proposal'].includes(o.status) && o.price !== null)
    .reduce((s, o) => s + (orderToBase(data, o, o.price as number) ?? 0), 0)

  // ---------- clients ----------
  const newClients = data.clients.filter((c) => inRange(c.createdAt.slice(0, 10))).length
  const ordersPerClient = new Map<string, number>()
  for (const o of data.orders) ordersPerClient.set(o.clientId, (ordersPerClient.get(o.clientId) ?? 0) + 1)
  const withOrders = [...ordersPerClient.values()].filter((n) => n > 0).length
  const repeat = [...ordersPerClient.values()].filter((n) => n > 1).length
  const byClient = new Map<string, { value: number; count: number }>()
  for (const p of received) {
    const k = p.clientId ?? ''
    const cur = byClient.get(k) ?? { value: 0, count: 0 }
    byClient.set(k, { value: cur.value + toBase(p.amount, p.rateToBase), count: cur.count + 1 })
  }
  const clientRows = [...byClient.entries()]
    .filter(([k]) => k)
    .map(([k, v]) => ({ name: clientName(data, k), ...v, orders: data.orders.filter((o) => o.clientId === k && inRange((o.startDate ?? o.createdAt).slice(0, 10))).length }))
    .sort((a, b) => b.value - a.value)
  const payingClients = clientRows.length
  const topShare = income > 0 && clientRows[0] ? clientRows[0].value / income : 0

  // ---------- work ----------
  const days = data.days.filter((d) => inRange(d.date))
  const hours = days.reduce((s, d) => s + d.hours, 0)
  const outreach = days.reduce((s, d) => s + d.outreach, 0)

  // ---------- breakdowns ----------
  const group = (keyOf: (orderId: string | null, clientId: string | null) => string) => {
    const m = new Map<string, { value: number; orders: Set<string> }>()
    for (const p of received) {
      const k = keyOf(p.orderId, p.clientId) || 'Not set'
      const cur = m.get(k) ?? { value: 0, orders: new Set<string>() }
      cur.value += toBase(p.amount, p.rateToBase)
      if (p.orderId) cur.orders.add(p.orderId)
      m.set(k, cur)
    }
    return [...m.entries()].map(([key, v]) => ({ key, value: v.value, orders: v.orders.size })).sort((a, b) => b.value - a.value)
  }
  const orderOf = (id: string | null) => data.orders.find((o) => o.id === id)
  const byService = group((oid) => orderOf(oid)?.service ?? '')
  const byPlatform = group((oid, cid) => orderOf(oid)?.platform || data.clients.find((c) => c.id === cid)?.platform || '')
  const costs = (() => {
    const m = new Map<string, number>()
    for (const e of data.expenses.filter((x) => inRange(x.date))) m.set(e.category || 'Not set', (m.get(e.category || 'Not set') ?? 0) + toBase(e.amount, e.rateToBase))
    return [...m.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)
  })()

  const exportReport = () =>
    downloadCsv(
      `statistics-${now}.csv`,
      months.map((m, i) => ({ month: m, money_in: incomeByMonth[i].toFixed(2), money_out: spendByMonth[i].toFixed(2), profit: (incomeByMonth[i] - spendByMonth[i]).toFixed(2), currency: data.settings.baseCurrency })),
    )

  const share = (v: number, total: number) => (total > 0 ? pct(v / total) : '–')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Statistics</h1>
          <p className="muted small">
            {monthLabel(months[0], true)} to {monthLabel(months[months.length - 1], true)}
          </p>
        </div>
        <div className="head-actions">
          <div className="segmented" role="tablist" aria-label="Period">
            {([3, 6, 12, 0] as Range[]).map((r) => (
              <button key={r} role="tab" aria-selected={range === r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
                {r === 0 ? 'All time' : `${r} months`}
              </button>
            ))}
          </div>
          {import.meta.env.VITE_PREVIEW !== '1' && (
            <button className="ghost" onClick={exportReport}>
              Export
            </button>
          )}
        </div>
      </div>

      <section className="stat-section">
        <h2>Money</h2>
        <div className="stats four">
          <Stat label="Money in" value={money(income)} note={`${received.length} payment(s)`} />
          <Stat label="Profit" value={money(profit)} tone={profit < 0 ? 'bad' : undefined} note={income > 0 ? `${pct(profit / income)} margin` : 'No income yet'} />
          <Stat label="Average per month" value={money(income / months.length)} note={`${activeMonths} of ${months.length} months with income`} />
          <Stat label="Best month" value={income > 0 ? monthLabel(months[bestIdx], true) : '–'} note={income > 0 ? money(incomeByMonth[bestIdx]) : undefined} />
          <Stat label="Money out" value={money(spend)} note={income > 0 ? `${pct(spend / income)} of income` : undefined} />
          <Stat label="Average payment" value={received.length ? money(income / received.length) : '–'} />
          <Stat label="Owed to you now" value={money(totalOutstanding(data))} note="On unfinished work" />
          <Stat label="In the pipeline" value={money(pipeline)} note="Leads and proposals with a price" />
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Money in and out by month</h2>
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

      <section className="stat-section">
        <h2>Orders</h2>
        <div className="stats four">
          <Stat label="Orders started" value={started.length} note={`${openNow.length} open right now`} />
          <Stat label="Completed" value={completed.length} note={avgDays === null ? `${cancelled.length} cancelled` : `Avg ${Math.round(avgDays)} days to finish · ${cancelled.length} cancelled`} />
          <Stat label="Average order value" value={priced.length ? money(avgOrder) : '–'} />
          <Stat label="Finished on time" value={withDue.length ? pct(onTime / withDue.length) : '–'} note={withDue.length ? `${onTime} of ${withDue.length} with a due date` : 'Needs due dates'} tone={withDue.length && onTime / withDue.length < 0.7 ? 'bad' : undefined} />
        </div>
      </section>

      <section className="stat-section">
        <h2>Clients</h2>
        <div className="stats four">
          <Stat label="Paying clients" value={payingClients} note={`${data.clients.length} in total`} />
          <Stat label="New clients" value={newClients} note="Added in this period" />
          <Stat label="Come back for more" value={withOrders ? pct(repeat / withOrders) : '–'} note={`${repeat} with 2+ orders`} />
          <Stat label="Earned per client" value={payingClients ? money(income / payingClients) : '–'} note={topShare ? `Top client brings ${pct(topShare)} of income` : undefined} />
        </div>
      </section>

      <section className="stat-section">
        <h2>Your work</h2>
        <div className="stats four">
          <Stat label="Hours logged" value={hours} note={`${days.length} check-in day(s)`} />
          <Stat label="Earned per hour" value={hours > 0 ? money(income / hours) : '–'} note={hours > 0 ? 'Money in ÷ hours logged' : 'Check in to see this'} />
          <Stat label="People contacted" value={outreach} />
          <Stat label="New clients per 10 contacts" value={outreach > 0 ? (Math.round((newClients / outreach) * 100) / 10).toString() : '–'} note="New clients for every 10 people you reach" />
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Top clients</h2>
          <Table
            head={['Client', 'Orders', 'Money in', 'Share']}
            rows={clientRows.slice(0, 8).map((r) => [r.name, String(r.orders), money(r.value), share(r.value, income)])}
            empty="No payments in this period."
          />
        </section>
        <section className="card">
          <h2>By service</h2>
          <Table
            head={['Service', 'Orders', 'Money in', 'Average']}
            rows={byService.map((r) => [r.key, String(r.orders), money(r.value), r.orders ? money(r.value / r.orders) : '–'])}
            empty="No payments linked to orders yet."
          />
        </section>
        <section className="card">
          <h2>By platform</h2>
          <Table head={['Platform', 'Orders', 'Money in', 'Share']} rows={byPlatform.map((r) => [r.key, String(r.orders), money(r.value), share(r.value, income)])} empty="No payments in this period." />
        </section>
        <section className="card">
          <h2>Where money goes</h2>
          <Table head={['Category', 'Spent', 'Share']} rows={costs.map((r) => [r.key, money(r.value), share(r.value, spend)])} empty="No expenses in this period." />
        </section>
      </div>
    </div>
  )
}

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p className="muted small">{empty}</p>
  return (
    <div className="stat-table-wrap">
      <table className="stat-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i ? 'right' : ''}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j ? 'right num' : ''}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
