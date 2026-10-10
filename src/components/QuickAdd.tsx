import { useEffect, useRef, useState } from 'react'
import type { Page } from '../App'

export function QuickAdd({ onAdd }: { onAdd: (page: Page) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [])

  const items: { label: string; page: Page }[] = [
    { label: 'New client', page: 'clients' },
    { label: 'New order', page: 'orders' },
    { label: 'New payment', page: 'money' },
    { label: "Today's check-in", page: 'daily' },
  ]

  return (
    <div className="quick" ref={ref}>
      <button className="primary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        + Add
      </button>
      {open && (
        <div className="menu">
          {items.map((i) => (
            <button
              key={i.label}
              onClick={() => {
                setOpen(false)
                onAdd(i.page)
              }}
            >
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
