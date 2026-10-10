import { useState } from 'react'
import { useStore } from '../store'
import { Badge, Empty } from '../components/ui'
import { ExpenseForm, PaymentForm } from '../components/Forms'
import { Icon } from '../components/Icon'
import type { Go } from '../App'
import type { Expense, Payment } from '../types'
import { clientName, formatMoney, lastMonths, monthLabel, monthOf, orderTitle, previousMonth, receivedIn, spentIn, toBase, today } from '../utils'

type Tab = 'payments' | 'expenses'

export function Money({ go, initialId, initialTab }: { go: Go; initialId?: string | null; initialTab?: Tab }) {
  const { data } = useStore()
  const base = data.settings.baseCurrency
  const [tab, setTab] = useState<Tab>(initialTab ?? 'payments')
  const [month, setMonth] = useState<string | 'all'>(monthOf(today()))
  const [editPay, setEditPay] = useState<Payment | 'new' | null>(() =>
    initialTab !== 'expenses' && initialId === 'new' ? 'new' : (data.payments.find((p) => p.id === initialId) ?? null),
  )
  const [editExp, setEditExp] = useState<Expense | 'new' | null>(() =>
    initialTab === 'expenses' && initialId === 'new' ? 'new' : (data.expenses.find((e) => e.id === initialId) ?? null),
  )

  const inPeriod = (date: string) => month === 'all' || monthOf(date) === month
  const received = month === 'all' ? data.payments.filter((p) => p.status === 'Received').reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0) : receivedIn(data, month)
  const spent = month === 'all' ? data.expenses.reduce((s, e) => s + toBase(e.amount, e.rateToBase), 0) : spentIn(data, month)
  const expected = data.payments.filter((p) => p.status === 'Expected').reduce((s, p) => s + toBase(p.amount, p.rateToBase), 0)

  const payments = data.payments.filter((p) => inPeriod(p.date)).sort((a, b) => b.date.localeCompare(a.date))
  const expenses = data.expenses.filter((e) => inPeriod(e.date)).sort((a, b) => b.date.localeCompare(a.date))

  const months = lastMonths(24)
  const step = (dir: -1 | 1) => {
    if (month === 'all') return setMonth(monthOf(today()))
    const i = months.indexOf(month)
    const next = months[i + dir]
    if (next) setMonth(next)
    else if (dir === -1) setMonth(previousMonth(month))
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Money</h1>
          <p className="muted small">Everything that came in and went out.</p>
        </div>
        <div className="head-actions">
          <button className="ghost" onClick={() => setEditExp('new')}>
            <Icon name="expense" size={18} /> Add expense
          </button>
          <button className="primary" onClick={() => setEditPay('new')}>
            <Icon name="plus" size={18} /> Record payment
          </button>
        </div>
      </div>

      <div className="period">
        <button className="ghost icon-btn" onClick={() => step(-1)} aria-label="Previous month">‹</button>
        <strong>{month === 'all' ? 'All time' : monthLabel(month, true)}</strong>
        <button className="ghost icon-btn" onClick={() => step(1)} aria-label="Next month" disabled={month !== 'all' && month >= monthOf(today())}>›</button>
        <button className={month === 'all' ? 'chip active' : 'chip'} onClick={() => setMonth(month === 'all' ? monthOf(today()) : 'all')}>
          All time
        </button>
      </div>

      <div className="stats four">
        <div className="stat">
          <span>Money in</span>
          <strong>{formatMoney(received, base)}</strong>
        </div>
        <div className="stat">
          <span>Money out</span>
          <strong>{formatMoney(spent, base)}</strong>
        </div>
        <div className="stat">
          <span>Profit</span>
          <strong className={received - spent < 0 ? 'bad-text' : ''}>{formatMoney(received - spent, base)}</strong>
        </div>
        <div className="stat">
          <span>Expected, not in yet</span>
          <strong>{formatMoney(expected, base)}</strong>
        </div>
      </div>

      <div className="chips" role="tablist" aria-label="Money views">
        <button role="tab" aria-selected={tab === 'payments'} className={tab === 'payments' ? 'chip active' : 'chip'} onClick={() => setTab('payments')}>
          Payments in <span className="chip-count">{payments.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'expenses'} className={tab === 'expenses' ? 'chip active' : 'chip'} onClick={() => setTab('expenses')}>
          Expenses <span className="chip-count">{expenses.length}</span>
        </button>
      </div>

      {tab === 'payments' ? (
        payments.length === 0 ? (
          <Empty>No payments in this period.</Empty>
        ) : (
          <div className="table-card">
            {payments.map((p) => (
              <div key={p.id} className="trow money-grid clickable" onClick={() => setEditPay(p)}>
                <span className="cell-main">
                  <span>
                    <strong>{p.orderId ? orderTitle(data, p.orderId) : clientName(data, p.clientId) === '-' ? 'Payment' : clientName(data, p.clientId)}</strong>
                    <span className="muted small block">
                      {p.orderId ? clientName(data, p.clientId) + ' · ' : ''}
                      {p.date} · {p.method || 'Method not set'}
                    </span>
                  </span>
                </span>
                <span data-label="Status"><Badge tone={p.status === 'Received' ? 'good' : 'warn'}>{p.status}</Badge></span>
                <span className="right num strong">
                  {formatMoney(p.amount, p.currency)}
                  {p.currency !== base && <span className="muted small block">{formatMoney(toBase(p.amount, p.rateToBase), base)}</span>}
                </span>
              </div>
            ))}
          </div>
        )
      ) : expenses.length === 0 ? (
        <Empty>No expenses in this period. Add fees, data, transport and other costs to see your real profit.</Empty>
      ) : (
        <div className="table-card">
          {expenses.map((e) => (
            <div key={e.id} className="trow money-grid clickable" onClick={() => setEditExp(e)}>
              <span className="cell-main">
                <span>
                  <strong>{e.notes || e.category || 'Expense'}</strong>
                  <span className="muted small block">
                    {e.date} · {e.method || 'Method not set'}
                    {e.orderId ? ` · ${orderTitle(data, e.orderId)}` : ''}
                  </span>
                </span>
              </span>
              <span data-label="Category"><Badge tone="muted">{e.category || 'No category'}</Badge></span>
              <span className="right num strong">
                −{formatMoney(e.amount, e.currency)}
                {e.currency !== base && <span className="muted small block">{formatMoney(toBase(e.amount, e.rateToBase), base)}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="muted small">
        Need the bigger picture? <button className="link inline" onClick={() => go('reports')}>Open reports</button>
      </p>

      {editPay && <PaymentForm payment={editPay === 'new' ? null : editPay} onClose={() => setEditPay(null)} />}
      {editExp && <ExpenseForm expense={editExp === 'new' ? null : editExp} onClose={() => setEditExp(null)} />}
    </div>
  )
}
