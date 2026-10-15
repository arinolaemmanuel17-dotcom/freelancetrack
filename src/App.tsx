import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { StoreProvider, useStore, type Account } from './store'
import { supabase } from './supabase'
import { AuthScreen, NewPasswordScreen } from './pages/AuthScreen'
import { Home } from './pages/Home'
import { ClientDetail, Clients } from './pages/Clients'
import { OrderDetail, Orders } from './pages/Orders'
import { Money } from './pages/Money'
import { Reports } from './pages/Reports'
import { DailyLog } from './pages/DailyLog'
import { Settings } from './pages/Settings'
import { Admin } from './pages/Admin'
import { PrivacyPage, TermsPage } from './pages/Legal'
import { FeedbackDialog } from './components/FeedbackDialog'
import { Search } from './components/Search'
import { Notifications } from './components/Notifications'
import { QuickAdd, type QuickKind } from './components/QuickAdd'
import { ClientForm, ExpenseForm, OrderForm, PaymentForm } from './components/Forms'
import { Icon } from './components/Icon'
import { CurrencySwitch } from './components/CurrencySwitch'
import { SetupWelcome } from './components/Setup'
import { ensureEmailPrefs } from './components/EmailReminders'
import { elapsed, useNow } from './pages/DailyLog'
import logo from './assets/logo-mark.png?inline'
import './App.css'

export type Page = 'home' | 'clients' | 'client' | 'orders' | 'order' | 'money' | 'reports' | 'daily' | 'settings' | 'admin'
export type Go = (page: Page, id?: string | null) => void

const NAV: { id: Page; label: string; icon: string; also?: Page[] }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'orders', label: 'Orders', icon: 'orders', also: ['order'] },
  { id: 'clients', label: 'Clients', icon: 'clients', also: ['client'] },
  { id: 'money', label: 'Money', icon: 'money' },
  { id: 'reports', label: 'Statistics', icon: 'reports' },
  { id: 'daily', label: 'Check-ins', icon: 'checkin' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]
const ADMIN_NAV: (typeof NAV)[number] = { id: 'admin', label: 'Admin', icon: 'shield' }
const TABS: Page[] = ['home', 'orders', 'clients', 'money']

interface Route {
  page: Page
  id: string | null
  key: number
}

function Shell() {
  const [route, setRoute] = useState<Route>({ page: 'home', id: null, key: 0 })
  const [quick, setQuick] = useState<QuickKind | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const { data, mode, status, error, dismissError, reload, account } = useStore()
  const nav = account?.isAdmin ? [...NAV, ADMIN_NAV] : NAV

  const go: Go = (page, id = null) => {
    setMoreOpen(false)
    setRoute((r) => ({ page, id, key: r.key + 1 }))
    window.scrollTo({ top: 0 })
  }

  const onQuick = (k: QuickKind) => (k === 'checkin' ? go('daily', 'entry') : k === 'timer' ? go('daily', 'timer') : setQuick(k))
  const isActive = (n: (typeof nav)[number]) => route.page === n.id || !!n.also?.includes(route.page)
  const moreActive = !TABS.includes(route.page) && !['order', 'client'].includes(route.page)

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <img className="logo-img" src={logo} alt="" />
          <span className="wordmark">
            <span>Freelance</span>
            <span className="accent-word">Tracker</span>
          </span>
        </div>
        <QuickAdd onPick={onQuick} />
        <nav className="side-nav">
          {nav.map((n) => (
            <button key={n.id} className={isActive(n) ? 'side-link active' : 'side-link'} onClick={() => go(n.id)} aria-current={isActive(n) ? 'page' : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          {account ? (
            <>
              {account.name && <strong className="small ellipsis">{account.name}</strong>}
              <span className="muted small ellipsis" title={account.email}>{account.email}</span>
              <span className="side-foot-links small">
                <button className="link" onClick={() => setFeedbackOpen(true)}>Send feedback</button>
                <span aria-hidden="true">·</span>
                <button className="link" onClick={account.signOut}>Sign out</button>
              </span>
            </>
          ) : (
            <span className="muted small">Preview: saved in this browser</span>
          )}
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="brand mobile-only">
            <img className="logo-img" src={logo} alt="Freelance Tracker" />
          </div>
          <Search onOpen={(page, id) => go(page, id)} />
          <TimerPill onOpen={() => go('daily')} />
          <CurrencySwitch />
          <Notifications onOpen={(page, id) => go(page, id)} />
        </header>

        {error && (
          <div className="error-bar" role="alert">
            <span className="grow">{error}</span>
            <button className="ghost" onClick={reload}>Retry</button>
            <button className="ghost" onClick={dismissError} aria-label="Dismiss">×</button>
          </div>
        )}

        {status === 'loading' ? (
          <div className="page"><p className="muted">Loading your data…</p></div>
        ) : (
          <main key={route.key}>
            {route.page === 'home' && <Home go={go} />}
            {route.page === 'clients' && <Clients go={go} initialId={route.id} />}
            {route.page === 'client' && route.id && <ClientDetail go={go} id={route.id} />}
            {route.page === 'orders' && <Orders go={go} initialId={route.id} />}
            {route.page === 'order' && route.id && <OrderDetail go={go} id={route.id} />}
            {route.page === 'money' && <Money go={go} initialId={route.id} />}
            {route.page === 'reports' && <Reports />}
            {route.page === 'daily' && <DailyLog open={route.id === 'entry' || route.id === 'new' ? 'entry' : route.id === 'timer' ? 'timer' : undefined} />}
            {route.page === 'settings' && <Settings focus={route.id} />}
            {route.page === 'admin' && <Admin />}
          </main>
        )}

        <footer className="foot muted small">
          {mode === 'cloud' ? 'Saved to your account.' : 'Preview: your data stays in this browser.'}
        </footer>
      </div>

      <nav className="tabbar" aria-label="Main">
        {NAV.filter((n) => TABS.includes(n.id)).map((n) => (
          <button key={n.id} className={isActive(n) ? 'tab active' : 'tab'} onClick={() => go(n.id)} aria-current={isActive(n) ? 'page' : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </button>
        ))}
        <button className={moreActive ? 'tab active' : 'tab'} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
          <Icon name="more" size={22} />
          <span>More</span>
        </button>
      </nav>
      {!['settings', 'admin'].includes(route.page) && <QuickAdd onPick={onQuick} variant="fab" />}

      {moreOpen && (
        <div className="sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            {nav.filter((n) => !TABS.includes(n.id)).map((n) => (
              <button key={n.id} role="menuitem" onClick={() => go(n.id)}>
                <Icon name={n.icon} /> {n.label}
              </button>
            ))}
            {account && (
              <button role="menuitem" onClick={account.signOut}>
                <Icon name="logout" /> Sign out
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'cloud' && status === 'ready' && !error && !data.settings.onboarded && <SetupWelcome />}

      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
      {quick === 'client' && <ClientForm client={null} onClose={() => setQuick(null)} onSaved={(id) => go('client', id)} onOpenExisting={(id) => go('client', id)} />}
      {quick === 'order' && <OrderForm order={null} onClose={() => setQuick(null)} onSaved={(id) => go('order', id)} />}
      {quick === 'payment' && <PaymentForm payment={null} onClose={() => setQuick(null)} />}
      {quick === 'expense' && <ExpenseForm expense={null} onClose={() => setQuick(null)} />}
    </div>
  )
}

// Shows a running work timer in the top bar, from any page.
function TimerPill({ onOpen }: { onOpen: () => void }) {
  const { timer } = useStore()
  const now = useNow(!!timer)
  if (!timer) return null
  return (
    <button className="timer-pill" onClick={onOpen} aria-label={`Timer running, ${elapsed(timer.startedAt, now)}. Open check-ins`}>
      <span className="timer-dot" aria-hidden="true" />
      <span className="num">{elapsed(timer.startedAt, now)}</span>
      {timer.activity && <span className="timer-pill-label">{timer.activity}</span>}
    </button>
  )
}

const PREVIEW = import.meta.env.VITE_PREVIEW === '1'

// Signed-in users get their account data. The preview build skips sign-in and
// keeps example data in the browser.
function AccountGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Ask the database whether this account is the app owner. Anyone else gets false.
  const userId = session?.user.id ?? null
  const [adminFor, setAdminFor] = useState<string | null>(null)
  // First sign-in: save this device's time zone so reminders arrive at the right hour.
  useEffect(() => {
    if (userId) void ensureEmailPrefs(userId).catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let live = true
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (live) setAdminFor(!error && data === true ? userId : null)
    })
    return () => {
      live = false
    }
  }, [userId])

  const account = useMemo<Account | null>(
    () =>
      session
        ? {
            userId: session.user.id,
            email: session.user.email ?? '',
            name: String(session.user.user_metadata?.full_name ?? '').trim(),
            isAdmin: adminFor === session.user.id,
            setName: async (name: string) => {
              const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
              return error ? error.message : null
            },
            signOut: () => void supabase.auth.signOut(),
          }
        : null,
    [session, adminFor],
  )

  if (checking) return <div className="auth"><p className="muted">Loading…</p></div>
  if (recovering) return <NewPasswordScreen onDone={() => setRecovering(false)} />
  if (!account) return <AuthScreen />
  return (
    <StoreProvider key={account.userId} account={account}>
      <Shell />
    </StoreProvider>
  )
}

// Opened from the "Unsubscribe" link in an email: turn reminders off, no sign-in needed.
function Unsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'done' | 'bad'>('working')
  useEffect(() => {
    const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)
    if (!valid) {
      setState('bad')
      return
    }
    supabase.rpc('email_unsubscribe', { p_token: token }).then(({ data, error }) => setState(!error && data === true ? 'done' : 'bad'))
  }, [token])
  const home = () => {
    window.history.replaceState(null, '', '/')
    window.location.reload()
  }
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <img className="logo-img" src={logo} alt="" />
          <span className="wordmark">
            <span>Freelance</span>
            <span className="accent-word">Tracker</span>
          </span>
        </div>
        {state === 'working' && <p className="muted">Updating your email settings…</p>}
        {state === 'done' && (
          <>
            <h1>You're unsubscribed</h1>
            <p className="muted">You won't get reminder emails anymore. You can turn them back on anytime in Settings.</p>
          </>
        )}
        {state === 'bad' && (
          <>
            <h1>Link not recognised</h1>
            <p className="muted">This unsubscribe link didn't work. Sign in and turn reminders off in Settings instead.</p>
          </>
        )}
        <button className="primary" onClick={home}>Open Freelance Tracker</button>
      </div>
    </div>
  )
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/privacy') return <PrivacyPage />
  if (path === '/terms') return <TermsPage />
  const unsubToken = new URLSearchParams(window.location.search).get('unsubscribe')
  if (unsubToken) return <Unsubscribe token={unsubToken} />
  if (PREVIEW) {
    return (
      <StoreProvider>
        <Shell />
      </StoreProvider>
    )
  }
  return <AccountGate />
}
