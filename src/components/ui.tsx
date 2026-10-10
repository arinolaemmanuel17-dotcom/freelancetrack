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

export function Badge({ tone, children }: { tone?: 'good' | 'warn' | 'bad' | 'muted'; children: ReactNode }) {
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
