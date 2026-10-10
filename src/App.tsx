import { useState } from 'react'
import { StoreProvider } from './store'
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

      <main key={route.key}>
        {route.page === 'home' && <Home />}
        {route.page === 'clients' && <Clients initialId={route.id} />}
        {route.page === 'orders' && <Orders initialId={route.id} />}
        {route.page === 'money' && <Money initialId={route.id} />}
        {route.page === 'daily' && <DailyLog />}
        {route.page === 'settings' && <Settings />}
      </main>

      <footer className="foot muted small">
        Saved on this device for now. Export a CSV backup from Settings.
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
