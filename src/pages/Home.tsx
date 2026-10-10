import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Empty } from '../components/ui'
import { MonthColumns, BarList } from '../components/Chart'
import { Icon } from '../components/Icon'
import type { Go } from '../App'
import { OPEN_STATUSES } from '../types'
import {
  checkinStreak,
  clientName,
  daysBetween,
  formatMoney,
  greeting,
  groupReceived,
  lastMonths,
  monthLabel,
  monthOf,
  previousMonth,
  receivedIn,
  spentIn,
  today,
  totalOutstanding,
} from '../utils'
import { StatusPill } from './Orders'

export function Home({ go }: { go: Go }) {
  const { data, resetAll, loadExamples, mode, updateSettings, account } = useStore()
  const now = today()
  const month = monthOf(now)
  const base = data.settings.baseCurrency
  const isEmpty = data.clients.length === 0 && data.orders.length === 0 && data.payments.length === 0

  const inThis = receivedIn(data, month)
  const inLast = receivedIn(data, previousMonth(month))
  const outThis = spentIn(data, month)
  const owed = totalOutstanding(data)
  const delta = inLast > 0 ? Math.round(((inThis - inLast) / inLast) * 100) : null

  const months = lastMonths(6)
  const goal = data.settings.monthlyGoal
  const goalPct = goal > 0 ? Math.min(100, Math.round((inThis / goal) * 100)) : 0
  const streak = checkinStreak(data, now)
  const checkedToday = data.days.some((d) => d.date === now)

  const dueSoon = data.orders
    .filter((o) => OPEN_STATUSES.includes(o.status) && o.dueDate && daysBetween(now, o.dueDate) <= 7)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .slice(0, 6)

  const yearStart = `${now.slice(0, 4)}-01-01`
  const topClients = groupReceived(data, (p) => clientName(data, p.clientId), yearStart).filter((r) => r.key !== '-').slice(0, 5)

  const [goalInput, setGoalInput] = useState('')
  const [editingGoal, setEditingGoal] = useState(false)
  const saveGoal = (e: FormEvent) => {
    e.preventDefault()
    const v = Number(goalInput)
    if (v >= 0) updateSettings({ monthlyGoal: v })
    setEditingGoal(false)
  }

  const name = account?.email ? account.email.split('@')[0] : ''

  return (
    <div className="page">
      {data.example && (
        <div className="banner" role="status">
          <span className="grow">You're looking at example data. Try things out, then clear it when you're ready to start for real.</span>
          <button className="primary" onClick={resetAll}>
            Clear examples
          </button>
        </div>
      )}

      <div className="page-head">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
        {!checkedToday && !isEmpty && (
          <button className="ghost" onClick={() => go('daily')}>
            <Icon name="checkin" size={18} /> Check in for today
          </button>
        )}
      </div>

      {isEmpty ? (
        <section className="card welcome">
          <h2>Set up your workspace</h2>
          <ol className="steps">
            <li>
              <strong>Add a client.</strong> Who you work for.
            </li>
            <li>
              <strong>Create an order.</strong> The job, price and due date.
            </li>
            <li>
              <strong>Record payments</strong> as money comes in, and expenses as it goes out.
            </li>
          </ol>
          <p className="muted small">Anything late or unpaid shows up under the bell at the top.</p>
          <div className="actions">
            <button className="primary" onClick={() => go('clients', 'new')}>
              <Icon name="plus" size={18} /> Add your first client
            </button>
            <button className="ghost" onClick={() => go('settings')}>
              Set your currencies and services
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
          <div className="kpis">
            <div className="kpi hero">
              <span className="kpi-label">Money in this month</span>
              <strong className="kpi-value">{formatMoney(inThis, base)}</strong>
              {delta !== null && (
                <span className={delta >= 0 ? 'delta up' : 'delta down'}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs {monthLabel(previousMonth(month))}
                </span>
              )}
            </div>
            <div className="kpi">
              <span className="kpi-label">Money out</span>
              <strong className="kpi-value">{formatMoney(outThis, base)}</strong>
            </div>
            <div className="kpi">
              <span className="kpi-label">Profit this month</span>
              <strong className={inThis - outThis < 0 ? 'kpi-value bad-text' : 'kpi-value'}>{formatMoney(inThis - outThis, base)}</strong>
            </div>
            <div className="kpi clickable" onClick={() => go('orders')}>
              <span className="kpi-label">Owed to you</span>
              <strong className="kpi-value">{formatMoney(owed, base)}</strong>
            </div>
          </div>

          <div className="two-col wide-left">
            <section className="card">
              <div className="card-head">
                <h2>Money in and out</h2>
                <button className="link small" onClick={() => go('reports')}>
                  Reports
                </button>
              </div>
              <MonthColumns
                title="Money in and out, last 6 months"
                months={months.map((m) => monthLabel(m))}
                currency={base}
                height={200}
                series={[
                  { label: 'Money in', color: 'var(--series-1)', values: months.map((m) => receivedIn(data, m)) },
                  { label: 'Money out', color: 'var(--series-2)', values: months.map((m) => spentIn(data, m)) },
                ]}
              />
            </section>

            <div className="stack">
              <section className="card">
                <div className="card-head">
                  <h2>
                    <Icon name="target" size={18} /> Monthly goal
                  </h2>
                  {goal > 0 && !editingGoal && (
                    <button className="link small" onClick={() => { setGoalInput(String(goal)); setEditingGoal(true) }}>
                      Change
                    </button>
                  )}
                </div>
                {editingGoal || goal === 0 ? (
                  editingGoal ? (
                    <form className="inline-add" onSubmit={saveGoal}>
                      <input id="goal-input" type="number" inputMode="decimal" min="0" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} placeholder={`Amount in ${base}`} autoFocus aria-label="Monthly goal" />
                      <button className="primary" type="submit">Save</button>
                    </form>
                  ) : (
                    <>
                      <p className="muted small">Set a target for each month and watch your progress.</p>
                      <button className="ghost" onClick={() => { setGoalInput(''); setEditingGoal(true) }}>
                        Set a goal
                      </button>
                    </>
                  )
                ) : (
                  <>
                    <p className="goal-line">
                      <strong className="num">{formatMoney(inThis, base)}</strong> <span className="muted">of {formatMoney(goal, base)}</span>
                    </p>
                    <span className="meter big" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly goal progress">
                      <span style={{ width: `${goalPct}%` }} />
                    </span>
                    <p className="muted small">{goalPct >= 100 ? 'Goal reached. Nice work.' : `${formatMoney(Math.max(0, goal - inThis), base)} to go this month.`}</p>
                  </>
                )}
              </section>

              <section className="card clickable" onClick={() => go('daily')}>
                <div className="card-head">
                  <h2>
                    <Icon name="flame" size={18} /> Check-in streak
                  </h2>
                </div>
                <p className="goal-line">
                  <strong className="num">{streak}</strong> <span className="muted">day{streak === 1 ? '' : 's'} in a row</span>
                </p>
                <p className="muted small">{checkedToday ? 'You checked in today.' : 'Log today to keep it going.'}</p>
              </section>
            </div>
          </div>

          <div className="two-col">
            <section className="card">
              <div className="card-head">
                <h2>Due soon</h2>
                <button className="link small" onClick={() => go('orders')}>
                  All orders
                </button>
              </div>
              {dueSoon.length === 0 ? (
                <p className="muted small">Nothing due in the next 7 days.</p>
              ) : (
                <ul className="rows">
                  {dueSoon.map((o) => {
                    const d = daysBetween(now, o.dueDate as string)
                    return (
                      <li key={o.id} className="clickable" onClick={() => go('order', o.id)}>
                        <span className="grow">
                          <strong>{o.title}</strong>
                          <span className="muted small block">{clientName(data, o.clientId)}</span>
                        </span>
                        <StatusPill status={o.status} />
                        <span className={d < 0 ? 'small bad-text' : d <= 2 ? 'small warn-text' : 'small muted'}>
                          {d < 0 ? `${-d}d late` : d === 0 ? 'Today' : `In ${d}d`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Top clients this year</h2>
                <button className="link small" onClick={() => go('clients')}>
                  All clients
                </button>
              </div>
              {topClients.length === 0 ? <Empty>No payments yet this year.</Empty> : <BarList rows={topClients} currency={base} empty="" />}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
