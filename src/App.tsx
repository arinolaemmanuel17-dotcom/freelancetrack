import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { StoreProvider, useStore } from './store'
import { supabase } from './supabase'
import { AuthScreen, NewPasswordScreen } from './pages/AuthScreen'
import { Home } from './pages/Home'
import { Clients } from './pages/Clients'
import { Orders } from './pages/Orders'
import { Money } from './pages/Money'
import { DailyLog } from './pages/DailyLog'
import { Settings } from './pages/Settings'
import { Search } from './components/Search'
import { Notifications } from './components/Notifications'
import { QuickAdd } from './components/QuickAdd'
import './App.css'

export type Page = 'home' | 'clients' | 'orders' | 'money' | 'daily' | 'settings'

const NAV: { id: Page; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'clients', label: 'Clients' },
  { id: 'orders', label: 'Orders' },
  { id: 'money', label: 'Money' },
  { id: 'daily', label: 'Check-in' },
  { id: 'settings', label: 'Settings' },
]

interface Route {
  page: Page
  id: string | null // record id, or 'new' to open a blank form
  key: number
}

function Shell() {
  const [route, setRoute] = useState<Route>({ page: 'home', id: null, key: 0 })
  const { mode, status, error, dismissError, reload } = useStore()

  const go = (page: Page, id: string | null = null) =>
    setRoute((r) => ({ page, id, key: r.key + 1 }))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Freelance Tracker</div>
        <Search onOpen={(page, id) => go(page, id)} />
        <Notifications onOpen={(page, id) => go(page, id)} />
        <QuickAdd onAdd={(page) => go(page, page === 'daily' ? null : 'new')} />
      </header>

      <nav className="nav" aria-label="Main">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={route.page === n.id ? 'tab active' : 'tab'}
            onClick={() => go(n.id)}
          >
            {n.label}
          </button>
        ))}
      </nav>

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
        {route.page === 'home' && <Home go={(p, id) => go(p, id ?? null)} />}
        {route.page === 'clients' && <Clients initialId={route.id} />}
        {route.page === 'orders' && <Orders initialId={route.id} />}
        {route.page === 'money' && <Money initialId={route.id} />}
        {route.page === 'daily' && <DailyLog />}
        {route.page === 'settings' && <Settings />}
      </main>
      )}

      <footer className="foot muted small">
        {mode === 'cloud' ? 'Your data is saved to your account.' : 'Preview: your data is saved in this browser only.'}
      </footer>
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
    () =>
      session
        ? { userId: session.user.id, email: session.user.email ?? '', signOut: () => void supabase.auth.signOut() }
        : null,
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
