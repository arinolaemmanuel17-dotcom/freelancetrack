import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { DEFAULT_SETTINGS } from '../storage'

const SUGGESTED_SERVICES = [
  'Graphic design',
  'Logo design',
  'Web development',
  'Writing',
  'Editing and proofreading',
  'Translation',
  'Video editing',
  'Social media management',
  'Virtual assistance',
  'Data entry',
  'SEO',
  'Consulting',
]
const CURRENCIES = ['USD', 'NGN', 'EUR', 'GBP', 'GHS', 'KES', 'ZAR', 'INR', 'CAD']

// Shown once, right after a new account's first sign-in. Everything here can be changed later in Settings.
export function SetupWelcome() {
  const { data, updateSettings, account } = useStore()
  const s = data.settings
  const [services, setServices] = useState<string[]>(s.services)
  const [text, setText] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(s.platforms.length ? s.platforms : DEFAULT_SETTINGS.platforms)
  const [platformText, setPlatformText] = useState('')
  const [currency, setCurrency] = useState(s.baseCurrency)

  const addService = (v: string) => {
    const t = v.trim()
    if (t && !services.some((x) => x.toLowerCase() === t.toLowerCase())) setServices([...services, t])
  }
  const toggle = (list: string[], v: string, set: (x: string[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const finish = (e?: FormEvent) => {
    e?.preventDefault()
    const pending = text.trim()
    const finalServices = pending && !services.includes(pending) ? [...services, pending] : services
    const cur = s.currencies.includes(currency) ? s.currencies : [currency, ...s.currencies]
    updateSettings({ services: finalServices, platforms, baseCurrency: currency, currencies: cur, onboarded: true })
  }

  return (
    <div className="overlay">
      <div className="modal setup" role="dialog" aria-modal="true" aria-labelledby="setup-title">
        <p className="eyebrow">Welcome{account?.email ? `, ${account.email.split('@')[0]}` : ''}</p>
        <h2 id="setup-title" className="setup-title">Set up your workspace</h2>
        <p className="muted small">Takes a minute. You can change all of this later in Settings.</p>

        <form className="setup-form" onSubmit={finish}>
          <fieldset>
            <legend>What services do you offer?</legend>
            <div className="add-inline">
              <input
                id="setup-service"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a service and press Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addService(text)
                    setText('')
                  }
                }}
              />
              <button type="button" className="ghost" onClick={() => { addService(text); setText('') }}>
                Add
              </button>
            </div>
            {services.length > 0 && (
              <div className="chips">
                {services.map((v) => (
                  <button key={v} type="button" className="chip active" onClick={() => setServices(services.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
                    {v} ×
                  </button>
                ))}
              </div>
            )}
            <p className="muted small">Or tap to add:</p>
            <div className="chips">
              {SUGGESTED_SERVICES.filter((v) => !services.includes(v)).map((v) => (
                <button key={v} type="button" className="chip" onClick={() => addService(v)}>
                  + {v}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Where do you get clients?</legend>
            <div className="chips">
              {Array.from(new Set([...DEFAULT_SETTINGS.platforms, ...platforms])).map((p) => (
                <button key={p} type="button" className={platforms.includes(p) ? 'chip active' : 'chip'} aria-pressed={platforms.includes(p)} onClick={() => toggle(platforms, p, setPlatforms)}>
                  {p}
                </button>
              ))}
            </div>
            <div className="add-inline">
              <input
                id="setup-platform"
                value={platformText}
                onChange={(e) => setPlatformText(e.target.value)}
                placeholder="Another platform"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const t = platformText.trim()
                    if (t && !platforms.includes(t)) setPlatforms([...platforms, t])
                    setPlatformText('')
                  }
                }}
              />
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  const t = platformText.trim()
                  if (t && !platforms.includes(t)) setPlatforms([...platforms, t])
                  setPlatformText('')
                }}
              >
                Add
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Main currency</legend>
            <select id="setup-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {Array.from(new Set([currency, ...CURRENCIES])).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </fieldset>

          <div className="actions">
            <button type="button" className="ghost" onClick={() => updateSettings({ onboarded: true })}>
              Skip for now
            </button>
            <span className="grow" />
            <button type="submit" className="primary">
              Save and start
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
