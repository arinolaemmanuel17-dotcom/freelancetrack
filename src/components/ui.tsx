import { useEffect, useState, type ReactNode } from 'react'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
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

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
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
}: {
  id: string
  value: string
  onChange: (v: string) => void
  step: number
  required?: boolean
  placeholder?: string
  autoFocus?: boolean
  label?: string
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
      <button type="button" className="step-btn" onClick={() => bump(-1)} aria-label={`Decrease by ${fmtStep}`} tabIndex={-1}>
        −
      </button>
      <button type="button" className="step-btn" onClick={() => bump(1)} aria-label={`Increase by ${fmtStep}`} tabIndex={-1}>
        +
      </button>
    </span>
  )
}
