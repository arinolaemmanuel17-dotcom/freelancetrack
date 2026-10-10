import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { attentionItems, today } from '../utils'
import type { Page } from '../App'

export function Notifications({ onOpen }: { onOpen: (page: Page, id: string) => void }) {
  const { data } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const items = useMemo(() => attentionItems(data, today()), [data])
  const urgent = items.filter((i) => i.level === 'high').length

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const openItem = (orderId?: string, clientId?: string) => {
    setOpen(false)
    if (orderId) onOpen('orders', orderId)
    else if (clientId) onOpen('clients', clientId)
  }

  return (
    <div className="notif" ref={ref}>
      <button
        className="bell"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications, ${items.length} item(s)`}
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {items.length > 0 && <span className={urgent > 0 ? 'count urgent' : 'count'}>{items.length > 99 ? '99+' : items.length}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="menu">
          <div className="notif-head">Notifications</div>
          {items.length === 0 ? (
            <div className="notif-empty">You're all caught up.</div>
          ) : (
            items.map((i) => (
              <button
                key={i.id}
                className="notif-item"
                role="menuitem"
                onClick={() => openItem(i.orderId, i.clientId)}
              >
                <span className={`dot ${i.level}`} aria-hidden="true" />
                <span>{i.text}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
