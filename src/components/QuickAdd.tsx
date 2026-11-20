import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Sheet, SheetRow } from './ui'

export type QuickKind = 'client' | 'order' | 'payment' | 'expense' | 'checkin' | 'timer'

const ITEMS: { kind: QuickKind; label: string; hint: string; icon: string }[] = [
  { kind: 'order', label: 'New order', hint: 'A job with a price and a due date', icon: 'orders' },
  { kind: 'payment', label: 'Record payment', hint: 'Money that came in', icon: 'money' },
  { kind: 'expense', label: 'Add expense', hint: 'Money that went out', icon: 'expense' },
  { kind: 'client', label: 'New client', hint: 'Someone you work for', icon: 'clients' },
  { kind: 'checkin', label: 'Add check-in entry', hint: 'Log what you did today', icon: 'checkin' },
  { kind: 'timer', label: 'Start work timer', hint: 'Track time as you work', icon: 'clock' },
]

// The one place to add anything.
// variant="button": the "New" button and menu in the desktop sidebar.
// variant="top": the round + in the phone top bar, which opens a sheet.
export function QuickAdd({ onPick, variant = 'button' }: { onPick: (k: QuickKind) => void; variant?: 'button' | 'top' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (variant !== 'button') return
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
  }, [variant])

  const pick = (k: QuickKind) => {
    setOpen(false)
    onPick(k)
  }

  return (
    <div className={`quick ${variant}`} ref={ref}>
      <button className={variant === 'top' ? 'add-top' : 'primary new-btn'} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" aria-label="Add new">
        <Icon name="plus" size={variant === 'top' ? 22 : 18} />
        {variant === 'button' && <span>New</span>}
      </button>
      {open && variant === 'button' && (
        <div className="menu" role="menu">
          {ITEMS.map((i) => (
            <button key={i.kind} role="menuitem" onClick={() => pick(i.kind)}>
              <Icon name={i.icon} size={18} />
              {i.label}
            </button>
          ))}
        </div>
      )}
      {open && variant === 'top' && (
        <Sheet title="Add" onClose={() => setOpen(false)}>
          {ITEMS.map((i) => (
            <SheetRow key={i.kind} icon={i.icon} label={i.label} hint={i.hint} onClick={() => pick(i.kind)} />
          ))}
        </Sheet>
      )}
    </div>
  )
}
