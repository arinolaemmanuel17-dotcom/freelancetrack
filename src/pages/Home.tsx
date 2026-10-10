import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { MoneyInput } from '../components/ui'
import { LineChart } from '../components/Chart'
import { Icon } from '../components/Icon'
import type { Go } from '../App'
import { OPEN_STATUSES } from '../types'
import {
  checkinStreak,
  goalFor,
  goalWindow,
  clientName,
  daysBetween,
  formatMoney,
  greeting,
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

interface Activity {
  date: string
  icon: string
  text: string
  amount?: string
  tone?: 'in' | 'out'
  go: () => void
}

export function Home({ go }: { go: Go }) {
  const { data, resetAll, loadExamples, mode, saveGoal, account, money, toView, view } = useStore()
  const now = today()
  const month = monthOf(now)
  const isEmpty = data.clients.length === 0 && data.orders.length === 0 && data.payments.length === 0

  const inThis = receivedIn(data, month)
  const inLast = receivedIn(data, previousMonth(month))
  const outThis = spentIn(data, month)
  const owed = totalOutstanding(data)
  const openOrders = data.orders.filter((o) => OPEN_STATUSES.includes(o.status)).length
  const delta = inLast > 0 ? Math.round(((inThis - inLast) / inLast) * 100) : null

  const months = lastMonths(6)
  const gw = goalWindow(now)
  const goal = goalFor(data, month) ?? 0
  const targetGoal = gw.month ? goalFor(data, gw.month) : null
  const goalPct = goal > 0 ? Math.min(100, Math.round((inThis / goal) * 100)) : 0
  const streak = checkinStreak(data, now)
  const checkedToday = data.days.some((d) => d.date === now)

  const dueSoon = data.orders
    .filter((o) => OPEN_STATUSES.includes(o.status) && o.dueDate && daysBetween(now, o.dueDate) <= 7)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .slice(0, 5)

  const activity: Activity[] = [
    ...data.payments
      .filter((p) => p.status === 'Received')
      .map((p) => ({
        date: p.date,
        icon: 'money',
        text: `Payment from ${clientName(data, p.clientId) === '-' ? 'a client' : clientName(data, p.clientId)}`,
        amount: `+${formatMoney(p.amount, p.currency)}`,
        tone: 'in' as const,
        go: () => go('money'),
      })),
    ...data.expenses.map((e) => ({
      date: e.date,
      icon: 'expense',
      text: e.notes || e.category || 'Expense',
      amount: `−${formatMoney(e.amount, e.currency)}`,
      tone: 'out' as const,
      go: () => go('money'),
    })),
    ...data.orders.map((o) => ({
      date: (o.startDate ?? o.createdAt).slice(0, 10),
      icon: 'orders',
      text: `New order: ${o.title}`,
      go: () => go('order', o.id),
    })),
    ...data.orders
      .filter((o) => o.completedAt)
      .map((o) => ({ date: o.completedAt as string, icon: 'check', text: `Completed: ${o.title}`, go: () => go('order', o.id) })),
  ]
    .filter((a) => a.date <= now)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)

  const [goalInput, setGoalInput] = useState('')
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalError, setGoalError] = useState('')
  const submitGoal = (e: FormEvent) => {
    e.preventDefault()
    const v = Number(goalInput)
    if (!gw.month || !(v > 0)) {
      setGoalError('Enter an amount above zero.')
      return
    }
    if (saveGoal({ month: gw.month, amount: v })) {
      setEditingGoal(false)
      setGoalError('')
    } else setGoalError('The goal window is closed. Goals can be set from the 25th to the 5th.')
  }
  const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  const name = account?.email ? account.email.split('@')[0] : ''
  const when = (d: string) => (d === now ? 'Today' : daysBetween(d, now) === 1 ? 'Yesterday' : `${daysBetween(d, now)} days ago`)

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
          <p className="eyebrow">{new Date(`${now}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
        {!checkedToday && !isEmpty && (
          <button className="primary" onClick={() => go('daily', 'new')}>
            <Icon name="checkin" size={18} /> Check in
          </button>
        )}
      </div>

      {isEmpty ? (
        <section className="card welcome">
          <h2>Set up your workspace</h2>
          <ol className="steps">
            <li><strong>Add a client.</strong> Who you work for.</li>
            <li><strong>Create an order.</strong> The job, price and due date.</li>
            <li><strong>Record payments</strong> as money comes in, and expenses as it goes out.</li>
          </ol>
          <div className="actions">
            <button className="primary" onClick={() => go('clients', 'new')}>
              <Icon name="plus" size={18} /> Add your first client
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
              <strong className="kpi-value">{money(inThis)}</strong>
              <span className="delta">
                {delta === null ? 'First month with income' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs ${monthLabel(previousMonth(month))}`}
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Profit this month</span>
              <strong className={inThis - outThis < 0 ? 'kpi-value bad-text' : 'kpi-value'}>{money(inThis - outThis)}</strong>
              <span className="muted small">after {money(outThis)} costs</span>
            </div>
            <div className="kpi clickable" onClick={() => go('orders')}>
              <span className="kpi-label">Owed to you</span>
              <strong className="kpi-value">{money(owed)}</strong>
              <span className="muted small">on unfinished work</span>
            </div>
            <div className="kpi clickable" onClick={() => go('orders')}>
              <span className="kpi-label">Open orders</span>
              <strong className="kpi-value">{openOrders}</strong>
              <span className="muted small">{dueSoon.length} due this week</span>
            </div>
          </div>

          <div className="two-col wide-left">
            <section className="card">
              <div className="card-head">
                <h2>Money in, last 6 months</h2>
                <button className="link small" onClick={() => go('reports')}>
                  See statistics
                </button>
              </div>
              <LineChart
                title="Money in, last 6 months"
                labels={months.map((m) => monthLabel(m))}
                values={months.map((m) => toView(receivedIn(data, m)))}
                currency={view.currency}
                height={250}
                empty="Your income will show here once you record payments."
              />
            </section>

            <div className="stack">
              <section className="card">
                <div className="card-head">
                  <h2><Icon name="target" size={18} /> {monthLabel(month)} goal</h2>
                  <button className="link small" onClick={() => go('reports')}>
                    History
                  </button>
                </div>
                {goal > 0 ? (
                  <>
                    <p className="goal-line">
                      <strong className="num">{goalPct}%</strong> <span className="muted">of {money(goal)}</span>
                    </p>
                    <span className="meter big" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly goal progress">
                      <span style={{ width: `${goalPct}%` }} />
                    </span>
                    <p className="muted small">{goalPct >= 100 ? 'Goal reached. Nice work.' : `${money(Math.max(0, goal - inThis))} to go this month.`}</p>
                  </>
                ) : (
                  <p className="muted small">No goal set for {monthLabel(month, true)}.</p>
                )}

                {gw.open && gw.month ? (
                  editingGoal ? (
                    <form className="goal-form" onSubmit={submitGoal}>
                      <label className="field">
                        <span>Goal for {monthLabel(gw.month, true)}</span>
                        <MoneyInput id="goal-input" value={goalInput} onChange={setGoalInput} step={data.settings.amountStep * 10} placeholder={`Amount in ${data.settings.baseCurrency}`} autoFocus />
                      </label>
                      {goalError && <p className="notice bad">{goalError}</p>}
                      <div className="actions">
                        <button type="button" className="ghost" onClick={() => setEditingGoal(false)}>Cancel</button>
                        <button className="primary" type="submit">Save goal</button>
                      </div>
                    </form>
                  ) : (
                    <div className="goal-window">
                      <span className="badge good">Goal setting open until {fmtDay(gw.month === month ? `${month}-05` : `${gw.month}-05`)}</span>
                      <button
                        className="ghost bordered"
                        onClick={() => {
                          setGoalInput(targetGoal ? String(targetGoal) : '')
                          setEditingGoal(true)
                        }}
                      >
                        {targetGoal ? `Change ${monthLabel(gw.month)} goal (${money(targetGoal)})` : `Set goal for ${monthLabel(gw.month, true)}`}
                      </button>
                    </div>
                  )
                ) : (
                  <p className="muted small goal-locked">
                    <Icon name="checkin" size={14} /> You can set {monthLabel(gw.nextMonth)}'s goal from {fmtDay(gw.nextOpens)} to {fmtDay(`${gw.nextMonth}-05`)}.
                  </p>
                )}
              </section>

              <section className="card">
                <div className="card-head">
                  <h2><Icon name="flame" size={18} /> Check-in streak</h2>
                </div>
                <p className="goal-line">
                  <strong className="num">{streak}</strong> <span className="muted">day{streak === 1 ? '' : 's'} in a row</span>
                </p>
                {checkedToday ? (
                  <button className="link small" onClick={() => go('daily')}>You checked in today. See your week</button>
                ) : (
                  <button className="ghost bordered" onClick={() => go('daily', 'new')}>
                    <Icon name="checkin" size={16} /> Check in for today
                  </button>
                )}
              </section>
            </div>
          </div>

          <div className="two-col">
            <section className="card">
              <div className="card-head">
                <h2>Due this week</h2>
                <button className="link small" onClick={() => go('orders')}>All orders</button>
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
                <h2>Recent activity</h2>
              </div>
              {activity.length === 0 ? (
                <p className="muted small">Your latest payments, orders and costs will show here.</p>
              ) : (
                <ul className="rows activity">
                  {activity.map((a, i) => (
                    <li key={i} className="clickable" onClick={a.go}>
                      <span className={`act-icon ${a.tone ?? ''}`} aria-hidden="true">
                        <Icon name={a.icon} size={16} />
                      </span>
                      <span className="grow">
                        <span className="act-text">{a.text}</span>
                        <span className="muted small block">{when(a.date)}</span>
                      </span>
                      {a.amount && <span className={a.tone === 'in' ? 'num good-text strong' : 'num muted strong'}>{a.amount}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
