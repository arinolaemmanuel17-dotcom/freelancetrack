import { useState } from 'react'
import { useStore } from '../store'
import { ConfirmButton, Field } from '../components/ui'
import { DEFAULT_SETTINGS } from '../storage'
import { downloadCsv, today } from '../utils'

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

export function Settings() {
  const { data, updateSettings, resetAll, loadExamples } = useStore()
  const preview = import.meta.env.VITE_PREVIEW === '1'
  const s = data.settings
  const [base, setBase] = useState(s.baseCurrency)
  const [currencies, setCurrencies] = useState(s.currencies.join(', '))
  const [services, setServices] = useState(s.services.join(', '))
  const [platforms, setPlatforms] = useState(s.platforms.join(', '))
  const [methods, setMethods] = useState(s.methods.join(', '))
  const [gap, setGap] = useState(String(s.outreachGapDays))
  const [message, setMessage] = useState('')

  const save = () => {
    const cur = splitList(currencies).map((c) => c.toUpperCase())
    const baseCode = base.trim().toUpperCase() || 'USD'
    if (!cur.includes(baseCode)) cur.unshift(baseCode)
    updateSettings({
      baseCurrency: baseCode,
      currencies: cur,
      services: splitList(services),
      platforms: splitList(platforms),
      methods: splitList(methods),
      outreachGapDays: Math.max(1, Number(gap) || 3),
    })
    setMessage('Settings saved')
  }

  const exportAll = () => {
    downloadCsv(`clients-${today()}.csv`, data.clients as unknown as Record<string, unknown>[])
    downloadCsv(`orders-${today()}.csv`, data.orders as unknown as Record<string, unknown>[])
    downloadCsv(`payments-${today()}.csv`, data.payments as unknown as Record<string, unknown>[])
    downloadCsv(`daily-checkins-${today()}.csv`, data.days as unknown as Record<string, unknown>[])
    setMessage('Exported four CSV files')
  }

  return (
    <div className="page">
      <h1>Settings</h1>

      <section className="card">
        <h2>Your lists</h2>
        <p className="muted small">Separate items with commas. These show up in the forms.</p>
        <div className="form">
          <Field label="Base currency (what totals are shown in)">
            <input value={base} onChange={(e) => setBase(e.target.value)} maxLength={3} />
          </Field>
          <Field label="Currencies you use">
            <input value={currencies} onChange={(e) => setCurrencies(e.target.value)} />
          </Field>
          <Field label="Services you offer" wide>
            <input value={services} onChange={(e) => setServices(e.target.value)} />
          </Field>
          <Field label="Platforms or sources" wide>
            <input value={platforms} onChange={(e) => setPlatforms(e.target.value)} />
          </Field>
          <Field label="Payment methods" wide>
            <input value={methods} onChange={(e) => setMethods(e.target.value)} />
          </Field>
          <Field label="Flag a client after this many quiet days">
            <input type="number" min="1" value={gap} onChange={(e) => setGap(e.target.value)} />
          </Field>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => {
            setServices(DEFAULT_SETTINGS.services.join(', '))
            setPlatforms(DEFAULT_SETTINGS.platforms.join(', '))
            setMethods(DEFAULT_SETTINGS.methods.join(', '))
          }}>
            Reset lists to defaults
          </button>
          <span className="grow" />
          <button className="primary" onClick={save}>
            Save settings
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted small">Download everything as CSV to open in Excel, load example records to try the app, or erase everything on this device.</p>
        <div className="actions">
          {preview ? (
            <span className="muted small">Export downloads are turned off in this preview. They work in the full app.</span>
          ) : (
            <button className="primary" onClick={exportAll}>
              Export CSV
            </button>
          )}
          <button className="ghost" onClick={() => { loadExamples(); setMessage('Example data loaded') }}>
            Load example data
          </button>
          <span className="grow" />
          <ConfirmButton
            label="Erase all data"
            question="Erase all clients, orders, payments and check-ins on this device?"
            onConfirm={() => {
              resetAll()
              setMessage('All data erased')
            }}
          />
        </div>
      </section>

      {message && <p className="muted">{message}</p>}
    </div>
  )
}
