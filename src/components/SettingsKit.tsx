import { useState, type KeyboardEvent, type ReactNode } from 'react'

// Building blocks for the Settings page: a row with the label and help text on
// the left and the control on the right, an on/off switch, and a tag editor
// for lists like services or platforms.

export function SettingRow({ label, hint, htmlFor, children, stack }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={stack ? 'set-row stack' : 'set-row'}>
      <div className="set-row-text">
        {htmlFor ? <label htmlFor={htmlFor} className="set-row-label">{label}</label> : <span className="set-row-label">{label}</span>}
        {hint && <p className="set-row-hint">{hint}</p>}
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  )
}

export function SettingGroup({ title, description, children, footer, tone }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; tone?: 'danger' }) {
  return (
    <section className={tone === 'danger' ? 'set-group danger' : 'set-group'}>
      <header className="set-group-head">
        <h2>{title}</h2>
        {description && <p className="muted small">{description}</p>}
      </header>
      <div className="set-group-body">{children}</div>
      {footer && <footer className="set-group-foot">{footer}</footer>}
    </section>
  )
}

export function Switch({ id, checked, onChange, label }: { id?: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? 'switch on' : 'switch'} onClick={() => onChange(!checked)}>
      <span className="switch-knob" />
    </button>
  )
}

export function ListEditor({ id, values, onChange, placeholder, upper }: { id: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; upper?: boolean }) {
  const [draft, setDraft] = useState('')
  const add = (raw: string) => {
    const parts = raw.split(',').map((x) => (upper ? x.trim().toUpperCase() : x.trim())).filter(Boolean)
    if (!parts.length) return
    const next = [...values]
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p)
    onChange(next)
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1))
    }
  }
  return (
    <div className="tag-editor">
      <ul className="tags" aria-label="Current items">
        {values.map((v) => (
          <li key={v} className="tag">
            <span>{v}</span>
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
          </li>
        ))}
        {values.length === 0 && <li className="muted small">None yet</li>}
      </ul>
      <div className="tag-add">
        <input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => draft.trim() && add(draft)} placeholder={placeholder} maxLength={upper ? 3 : 40} />
        <button type="button" className="ghost bordered" onClick={() => add(draft)} disabled={!draft.trim()}>Add</button>
      </div>
    </div>
  )
}

export const COMMON_CURRENCIES = ['USD', 'NGN', 'EUR', 'GBP', 'CAD', 'AUD', 'GHS', 'KES', 'ZAR', 'INR', 'AED', 'PKR', 'BDT', 'PHP', 'EGP']

export function currencyOptions(...extra: string[]): string[] {
  const all = [...COMMON_CURRENCIES]
  for (const c of extra) if (c && !all.includes(c)) all.push(c)
  return all
}

export function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}
