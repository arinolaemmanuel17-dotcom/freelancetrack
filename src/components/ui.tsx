import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

// Stops the page behind a sheet or dialog from scrolling while it is open.
function useScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
}

// Bottom sheet on phones, centred dialog on larger screens. Used by the forms.

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useScrollLock()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Rendered on the page body so no parent (the top bar blurs its background) can trap it.
  return createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <span className="grabber" aria-hidden="true" />
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="ghost icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Badge({ tone, children }: { tone?: 'good' | 'warn' | 'bad' | 'muted' | 'info'; children: ReactNode }) {
  return <span className={`badge ${tone ?? 'muted'}`}>{children}</span>
}

// Nothing here yet: say what goes here and offer the next step.
export function Empty({ children, icon = 'inbox', title, action }: { children: ReactNode; icon?: string; title?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      {title && <strong>{title}</strong>}
      <p>{children}</p>
      {action}
    </div>
  )
}

// A sheet that rises from the bottom on phones. Menus and quick actions use it.
export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  useScrollLock()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title ?? 'Menu'} onClick={(e) => e.stopPropagation()}>
        <span className="grabber" aria-hidden="true" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

// One row in a sheet: coloured icon tile, label, optional hint.
export function SheetRow({ icon, label, hint, onClick, tone }: { icon: string; label: string; hint?: string; onClick: () => void; tone?: 'danger' }) {
  return (
    <button className={tone === 'danger' ? 'sheet-row danger' : 'sheet-row'} onClick={onClick}>
      <span className="sheet-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className="grow">
        <span className="sheet-label">{label}</span>
        {hint && <span className="muted small block">{hint}</span>}
      </span>
      <Icon name="chevron" size={18} />
    </button>
  )
}

// Grey placeholders shown while data loads, shaped like the page that is coming.
export function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading your data">
      <div className="skel skel-title" />
      <div className="skel skel-line" />
      <div className="skel skel-hero" />
      <div className="skel-tiles">
        <div className="skel skel-tile" />
        <div className="skel skel-tile" />
        <div className="skel skel-tile" />
      </div>
      <div className="skel skel-card" />
    </div>
  )
}

export function Options({ values }: { values: string[] }) {
  return (
    <>
      {values.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </>
  )
}

// Two-step delete: the first tap asks, the second tap does it.
// Built into the page because some viewers block pop-up confirm dialogs.
export function ConfirmButton({
  label,
  question,
  onConfirm,
}: {
  label: string
  question: string
  onConfirm: () => void
}) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" className="danger" onClick={() => setAsking(true)}>
        {label}
      </button>
    )
  }
  return (
    <span className="confirm" role="group" aria-label={question}>
      <span className="small">{question}</span>
      <button type="button" className="danger solid" onClick={onConfirm} autoFocus>
        Yes, delete
      </button>
      <button type="button" className="ghost" onClick={() => setAsking(false)}>
        No
      </button>
    </span>
  )
}

// Money amount box: type any amount, or use the − / + buttons and the
// arrow keys to change it by `step` (Shift + arrow changes it by 10 steps).
// The input comes first so the surrounding <label> focuses the input, not a button.
export function MoneyInput({
  id,
  value,
  onChange,
  step,
  required,
  placeholder,
  autoFocus,
  label,
  disabled,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  step: number
  required?: boolean
  placeholder?: string
  autoFocus?: boolean
  label?: string
  disabled?: boolean
}) {
  const bump = (dir: 1 | -1, times = 1) => {
    const current = Number(value) || 0
    const next = Math.max(0, Math.round((current + dir * step * times) * 100) / 100)
    onChange(String(next))
  }
  const fmtStep = step.toLocaleString()
  return (
    <span className="money-input">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={label}
        pattern="[0-9]*[.]?[0-9]{0,2}"
        title="Numbers only, up to 2 decimal places"
        onChange={(e) => onChange(e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            bump(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey ? 10 : 1)
          }
        }}
      />
      <button type="button" className="step-btn" onClick={() => bump(-1)} aria-label={`Decrease by ${fmtStep}`} tabIndex={-1} disabled={disabled}>
        −
      </button>
      <button type="button" className="step-btn" onClick={() => bump(1)} aria-label={`Increase by ${fmtStep}`} tabIndex={-1} disabled={disabled}>
        +
      </button>
    </span>
  )
}

// Makes a tappable row work with the keyboard too: Tab to it, Enter or Space to open.
export function rowProps(run: () => void) {
  return {
    onClick: run,
    role: 'button' as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        run()
      }
    },
  }
}
