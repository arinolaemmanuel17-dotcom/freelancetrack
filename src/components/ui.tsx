import { useEffect, type ReactNode } from 'react'

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
