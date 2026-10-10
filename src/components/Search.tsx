import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { searchAll, clientName, formatMoney } from '../utils'
import type { Page } from '../App'

export function Search({ onOpen }: { onOpen: (page: Page, id: string) => void }) {
  const { data } = useStore()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        ref.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => searchAll(data, query), [data, query])
  const hasAny = results.clients.length + results.orders.length + results.payments.length > 0

  const pick = (page: Page, id: string) => {
    setOpen(false)
    setQuery('')
    onOpen(page, id)
  }

  return (
    <div className="search">
      <input
        ref={ref}
        className="search-global"
        placeholder="Search clients, orders, payments (Ctrl+K)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Search"
      />
      {open && query.trim() && (
        <div className="search-results" role="listbox">
          {!hasAny && <div className="muted small pad">No matches.</div>}
          {results.clients.map((c) => (
            <button key={c.id} className="result" onMouseDown={() => pick('clients', c.id)}>
              <span className="tag">Client</span> {c.name}
            </button>
          ))}
          {results.orders.map((o) => (
            <button key={o.id} className="result" onMouseDown={() => pick('orders', o.id)}>
              <span className="tag">Order</span> {o.title} <span className="muted small">{clientName(data, o.clientId)}</span>
            </button>
          ))}
          {results.payments.map((p) => (
            <button key={p.id} className="result" onMouseDown={() => pick('money', p.id)}>
              <span className="tag">Payment</span> {formatMoney(p.amount, p.currency)} <span className="muted small">{p.date}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
