import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { useStore } from '../store'
import { Badge, Empty } from '../components/ui'
import { CountBars } from '../components/Chart'
import { Icon } from '../components/Icon'
import { addDays, daysBetween, initials, today } from '../utils'
import { shortDate } from './Orders'
import { AdminFeedback, useFeedbackInbox } from '../components/AdminFeedback'

// Owner-only overview of the whole app. The numbers come from one database
// function that refuses every account except the owner's, so hiding the menu
// link is only cosmetic: nobody else can load this data.

interface AdminUser {
  email: string
  name: string | null
  created_at: string
  confirmed: boolean
  last_sign_in_at: string | null
  last_active: string | null
  clients: number
  orders: number
  payments: number
  checkins: number
  files: number
  onboarded: boolean
}

interface Overview {
  generated_at: string
  total_users: number
  confirmed_users: number
  new_7d: number
  new_30d: number
  active_7d: number
  using_app: number
  signups_90d: string[]
  totals: {
    clients: number
    orders: number
    completed_orders: number
    payments: number
    expenses: number
    checkins: number
    files: number
    storage_bytes: number
  }
  users: AdminUser[]
}

type Filter = 'all' | 'active' | 'unconfirmed' | 'empty'

const WEEK = 7 * 24 * 60 * 60 * 1000

export function Admin() {
  const { account } = useStore()
  const [info, setInfo] = useState<Overview | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<'users' | 'feedback'>('users')
  const inbox = useFeedbackInbox()
  const newFeedback = (inbox.items ?? []).filter((f) => f.status === 'new').length

  const load = useCallback(async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_overview')
    setBusy(false)
    if (error) {
      setState(error.code === '42501' || /not allowed|permission/i.test(error.message) ? 'denied' : 'error')
      return
    }
    setInfo(data as Overview)
    setState('ready')
  }, [])

  // Load now, then refresh every minute while the page is open and visible.
  useEffect(() => {
    void load()
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60_000)
    return () => window.clearInterval(t)
  }, [load])

  const now = today()
  const chart = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => addDays(now, i - 29))
    const counts = new Map(days.map((d) => [d, 0]))
    for (const ts of info?.signups_90d ?? []) {
      const d = localDay(ts)
      if (counts.has(d)) counts.set(d, (counts.get(d) ?? 0) + 1)
    }
    return { labels: days.map((d) => shortDate(d)), values: days.map((d) => counts.get(d) ?? 0) }
  }, [info, now])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (info?.users ?? []).filter((u) => {
      if (q && ![u.email, u.name ?? ''].some((v) => v.toLowerCase().includes(q))) return false
      if (filter === 'active') return isActive(u)
      if (filter === 'unconfirmed') return !u.confirmed
      if (filter === 'empty') return u.clients + u.orders + u.checkins === 0
      return true
    })
  }, [info, query, filter])

  if (!account?.isAdmin || state === 'denied') {
    return (
      <div className="page">
        <h1>Admin</h1>
        <Empty>This page is only for the app owner.</Empty>
      </div>
    )
  }

  if (state === 'loading' || !info) {
    return (
      <div className="page">
        <h1>Admin</h1>
        {state === 'error' ? (
          <div className="notice bad" role="alert">
            Couldn't load the numbers. Check your connection and try again.{' '}
            <button className="link" onClick={load}>Try again</button>
          </div>
        ) : (
          <p className="muted">Loading app numbers…</p>
        )}
      </div>
    )
  }

  const t = info.totals
  const unconfirmed = info.total_users - info.confirmed_users
  const signedUpNoData = info.total_users - info.using_app
  const updated = new Date(info.generated_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="shield" size={13} /> Only you can see this
          </p>
          <h1>Admin</h1>
          <p className="muted small">Everyone using Freelance Tracker. Updated {updated}, refreshes every minute.</p>
        </div>
        <button className="ghost bordered" onClick={() => (view === 'users' ? load() : inbox.load())} disabled={busy}>
          <Icon name="refresh" size={16} /> {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="segmented admin-tabs" role="tablist" aria-label="Admin sections">
        <button role="tab" aria-selected={view === 'users'} className={view === 'users' ? 'active' : ''} onClick={() => setView('users')}>Users</button>
        <button role="tab" aria-selected={view === 'feedback'} className={view === 'feedback' ? 'active' : ''} onClick={() => setView('feedback')}>
          Feedback{newFeedback > 0 && <span className="tab-dot">{newFeedback}</span>}
        </button>
      </div>

      {view === 'feedback' ? (
        <AdminFeedback inbox={inbox} />
      ) : (
      <>

      <div className="kpis">
        <div className="kpi hero">
          <span className="kpi-label">Total users</span>
          <strong className="kpi-value">{info.total_users}</strong>
          <span className="delta">{info.confirmed_users} confirmed their email</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">New this week</span>
          <strong className="kpi-value">{info.new_7d}</strong>
          <span className="muted small">{info.new_30d} in the last 30 days</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Active this week</span>
          <strong className="kpi-value">{info.active_7d}</strong>
          <span className="muted small">signed in or saved something</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Actually using it</span>
          <strong className="kpi-value">{info.using_app}</strong>
          <span className="muted small">added a client, order or check-in</span>
        </div>
      </div>

      {(unconfirmed > 0 || signedUpNoData > 0) && (
        <div className="admin-notes">
          {unconfirmed > 0 && (
            <p className="notice warn">
              <strong>{unconfirmed}</strong> {unconfirmed === 1 ? 'person hasn’t' : 'people haven’t'} confirmed their email yet. If they say the email never arrived, the app needs an email service like Resend or Brevo.
            </p>
          )}
          {signedUpNoData > 0 && (
            <p className="notice">
              <strong>{signedUpNoData}</strong> {signedUpNoData === 1 ? 'account has' : 'accounts have'} signed up but not added anything yet.
            </p>
          )}
        </div>
      )}

      <div className="two-col wide-left">
        <section className="card">
          <div className="card-head">
            <h2>Sign-ups, last 30 days</h2>
          </div>
          <CountBars title="Sign-ups per day, last 30 days" labels={chart.labels} values={chart.values} unit={['sign-up', 'sign-ups']} empty="No sign-ups in the last 30 days." />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Across the app</h2>
          </div>
          <ul className="rows admin-totals">
            <li>
              <span className="grow">Orders tracked</span>
              <strong className="num">{t.orders}</strong>
              <span className="muted small">{t.completed_orders} completed</span>
            </li>
            <li>
              <span className="grow">Clients added</span>
              <strong className="num">{t.clients}</strong>
            </li>
            <li>
              <span className="grow">Payments recorded</span>
              <strong className="num">{t.payments}</strong>
            </li>
            <li>
              <span className="grow">Expenses recorded</span>
              <strong className="num">{t.expenses}</strong>
            </li>
            <li>
              <span className="grow">Check-ins</span>
              <strong className="num">{t.checkins}</strong>
            </li>
            <li>
              <span className="grow">Files uploaded</span>
              <strong className="num">{t.files}</strong>
              <span className="muted small">{fileSize(t.storage_bytes)}</span>
            </li>
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Users</h2>
          <span className="muted small">
            {rows.length} of {info.users.length}
          </span>
        </div>
        <div className="toolbar">
          <input id="admin-search" className="search-input" placeholder="Search by email or name" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select id="admin-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Show users">
            <option value="all">All users</option>
            <option value="active">Active this week</option>
            <option value="unconfirmed">Not confirmed</option>
            <option value="empty">Haven't added anything</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <p className="muted small">No users match.</p>
        ) : (
          <div className="table-card flat">
            <div className="trow thead admin-grid">
              <span>User</span>
              <span>Joined</span>
              <span>Last active</span>
              <span>What they've added</span>
              <span />
            </div>
            {rows.map((u) => {
              const you = u.email === account.email
              return (
                <div key={u.email} className="trow admin-grid">
                  <span className="cell-main">
                    <span className="avatar" aria-hidden="true">{initials(u.name || u.email)}</span>
                    <span className="min0">
                      <strong className="ellipsis block">
                        {u.name || u.email.split('@')[0]} {you && <Badge tone="info">You</Badge>}
                      </strong>
                      <span className="muted small block ellipsis selectable">{u.email}</span>
                    </span>
                  </span>
                  <span className="small">
                    <span className="m-label">Joined </span>
                    {joined(u.created_at, now)}
                  </span>
                  <span className="small muted">
                    <span className="m-label">Active </span>
                    {ago(u.last_active)}
                  </span>
                  <span className="small">{usage(u) || <span className="muted">Nothing yet</span>}</span>
                  <span className="right">
                    {!u.confirmed ? <Badge tone="warn">Not confirmed</Badge> : isActive(u) ? <Badge tone="good">Active</Badge> : <Badge tone="muted">Quiet</Badge>}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <p className="muted small">You see counts only. Other users' clients, payments and files stay private to them.</p>
      </section>
      </>
      )}
    </div>
  )
}

function isActive(u: AdminUser): boolean {
  return !!u.last_active && Date.now() - new Date(u.last_active).getTime() < WEEK
}

function localDay(ts: string): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function joined(ts: string, now: string): string {
  const d = localDay(ts)
  const n = daysBetween(d, now)
  if (n === 0) return 'Today'
  if (n === 1) return 'Yesterday'
  return shortDate(d, d.slice(0, 4) !== now.slice(0, 4))
}

function ago(ts: string | null): string {
  if (!ts) return 'Never'
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 2) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return shortDate(localDay(ts), true)
}

function usage(u: AdminUser): string {
  const parts: [number, string, string][] = [
    [u.orders, 'order', 'orders'],
    [u.clients, 'client', 'clients'],
    [u.payments, 'payment', 'payments'],
    [u.checkins, 'check-in', 'check-ins'],
    [u.files, 'file', 'files'],
  ]
  return parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(' · ')
}

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
