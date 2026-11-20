import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { attentionItems, today } from '../utils'
import type { Page } from '../App'
import { Icon } from './Icon'

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

  const openItem = (orderId?: string, clientId?: string, page?: Page) => {
    setOpen(false)
    if (orderId) onOpen('order', orderId)
    else if (clientId) onOpen('client', clientId)
    else if (page) onOpen(page, '')
  }

  return (
    <div className="notif" ref={ref}>
      <button
        className="bell"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications, ${items.length} item(s)`}
        aria-expanded={open}
      >
        <Icon name="bell" size={20} />
        {items.length > 0 && <span className={urgent > 0 ? 'count urgent' : 'count'}>{items.length > 99 ? '99+' : items.length}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="menu">
          <div className="notif-head">
            <span>Needs attention</span>
            {items.length > 0 && <span className="muted small">{items.length}</span>}
          </div>
          {items.length === 0 ? (
            <div className="notif-empty">
              <span className="n-icon ok" aria-hidden="true"><Icon name="check" size={18} /></span>
              You're all caught up.
            </div>
          ) : (
            items.map((i) => (
              <button
                key={i.id}
                className="notif-item"
                role="menuitem"
                onClick={() => openItem(i.orderId, i.clientId, i.page)}
              >
                <span className={`n-icon ${i.level}`} aria-hidden="true">
                  <Icon name={i.level === 'high' ? 'alert' : i.level === 'medium' ? 'clock' : 'info'} size={18} />
                </span>
                <span className="grow">{i.text}</span>
                <Icon name="chevron" size={16} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
