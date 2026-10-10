import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { StoreProvider, useStore } from './store'
import { supabase } from './supabase'
import { AuthScreen, NewPasswordScreen } from './pages/AuthScreen'
import { Home } from './pages/Home'
import { ClientDetail, Clients } from './pages/Clients'
import { OrderDetail, Orders } from './pages/Orders'
import { Money } from './pages/Money'
import { Reports } from './pages/Reports'
import { DailyLog } from './pages/DailyLog'
import { Settings } from './pages/Settings'
import { Search } from './components/Search'
import { Notifications } from './components/Notifications'
import { QuickAdd, type QuickKind } from './components/QuickAdd'
import { ClientForm, ExpenseForm, OrderForm, PaymentForm } from './components/Forms'
import { Icon } from './components/Icon'
import { CurrencySwitch } from './components/CurrencySwitch'
import { SetupWelcome } from './components/Setup'
import logo from './assets/logo-mark.png?inline'
import './App.css'

export type Page = 'home' | 'clients' | 'client' | 'orders' | 'order' | 'money' | 'reports' | 'daily' | 'settings'
export type Go = (page: Page, id?: string | null) => void

const NAV: { id: Page; label: string; icon: string; also?: Page[] }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'orders', label: 'Orders', icon: 'orders', also: ['order'] },
  { id: 'clients', label: 'Clients', icon: 'clients', also: ['client'] },
  { id: 'money', label: 'Money', icon: 'money' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'daily', label: 'Check-in', icon: 'checkin' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]
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
  const { data, mode, status, error, dismissError, reload, account } = useStore()

  const go: Go = (page, id = null) => {
    setMoreOpen(false)
    setRoute((r) => ({ page, id, key: r.key + 1 }))
    window.scrollTo({ top: 0 })
  }

  const onQuick = (k: QuickKind) => (k === 'checkin' ? go('daily') : setQuick(k))
  const isActive = (n: (typeof NAV)[number]) => route.page === n.id || !!n.also?.includes(route.page)
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
          {NAV.map((n) => (
            <button key={n.id} className={isActive(n) ? 'side-link active' : 'side-link'} onClick={() => go(n.id)} aria-current={isActive(n) ? 'page' : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          {account ? (
            <>
              <span className="muted small ellipsis" title={account.email}>{account.email}</span>
              <button className="link small" onClick={account.signOut}>Sign out</button>
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
            {route.page === 'daily' && <DailyLog />}
            {route.page === 'settings' && <Settings />}
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
      <QuickAdd onPick={onQuick} variant="fab" />

      {moreOpen && (
        <div className="sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            {NAV.filter((n) => !TABS.includes(n.id)).map((n) => (
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

      {quick === 'client' && <ClientForm client={null} onClose={() => setQuick(null)} onSaved={(id) => go('client', id)} onOpenExisting={(id) => go('client', id)} />}
      {quick === 'order' && <OrderForm order={null} onClose={() => setQuick(null)} onSaved={(id) => go('order', id)} />}
      {quick === 'payment' && <PaymentForm payment={null} onClose={() => setQuick(null)} />}
      {quick === 'expense' && <ExpenseForm expense={null} onClose={() => setQuick(null)} />}
    </div>
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

  const account = useMemo(
    () => (session ? { userId: session.user.id, email: session.user.email ?? '', signOut: () => void supabase.auth.signOut() } : null),
    [session],
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

export default function App() {
  if (PREVIEW) {
    return (
      <StoreProvider>
        <Shell />
      </StoreProvider>
    )
  }
  return <AccountGate />
}
