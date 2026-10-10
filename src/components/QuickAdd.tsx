import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export type QuickKind = 'client' | 'order' | 'payment' | 'expense' | 'checkin'

const ITEMS: { kind: QuickKind; label: string; icon: string }[] = [
  { kind: 'order', label: 'New order', icon: 'orders' },
  { kind: 'client', label: 'New client', icon: 'clients' },
  { kind: 'payment', label: 'Record payment', icon: 'money' },
  { kind: 'expense', label: 'Add expense', icon: 'expense' },
  { kind: 'checkin', label: "Today's check-in", icon: 'checkin' },
]

// The "New" button. variant="fab" is the round button on phones.
export function QuickAdd({ onPick, variant = 'button' }: { onPick: (k: QuickKind) => void; variant?: 'button' | 'fab' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  return (
    <div className={`quick ${variant}`} ref={ref}>
      <button className={variant === 'fab' ? 'fab-btn' : 'primary new-btn'} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Add new">
        <Icon name="plus" size={variant === 'fab' ? 26 : 18} />
        {variant === 'button' && <span>New</span>}
      </button>
      {open && (
        <div className="menu" role="menu">
          {ITEMS.map((i) => (
            <button
              key={i.kind}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onPick(i.kind)
              }}
            >
              <Icon name={i.icon} size={18} />
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
