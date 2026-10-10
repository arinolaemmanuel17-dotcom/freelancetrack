import { useState, type ChangeEvent } from 'react'
import { useStore } from '../store'
import { ConfirmButton, Field } from '../components/ui'
import { Icon } from '../components/Icon'
import { DEFAULT_SETTINGS } from '../storage'
import { downloadCsv, today } from '../utils'

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

export function Settings() {
  const { data, updateSettings, resetAll, loadExamples, importClients, mode, account } = useStore()
  const s = data.settings
  const preview = import.meta.env.VITE_PREVIEW === '1'
  const [base, setBase] = useState(s.baseCurrency)
  const [currencies, setCurrencies] = useState(s.currencies.join(', '))
  const [services, setServices] = useState(s.services.join(', '))
  const [platforms, setPlatforms] = useState(s.platforms.join(', '))
  const [methods, setMethods] = useState(s.methods.join(', '))
  const [categories, setCategories] = useState(s.categories.join(', '))
  const [goal, setGoal] = useState(s.monthlyGoal ? String(s.monthlyGoal) : '')
  const [gap, setGap] = useState(String(s.outreachGapDays))
  const [message, setMessage] = useState('')

  const save = () => {
    const cur = splitList(currencies).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c))
    const baseCode = /^[A-Z]{3}$/.test(base.trim().toUpperCase()) ? base.trim().toUpperCase() : 'USD'
    if (!cur.includes(baseCode)) cur.unshift(baseCode)
    updateSettings({
      baseCurrency: baseCode,
      currencies: cur,
      services: splitList(services),
      platforms: splitList(platforms),
      methods: splitList(methods),
      categories: splitList(categories),
      monthlyGoal: Math.max(0, Number(goal) || 0),
      outreachGapDays: Math.max(1, Number(gap) || 3),
    })
    setMessage('Settings saved.')
  }

  const exportAll = () => {
    const t = today()
    const rows = (x: unknown[]) => x as Record<string, unknown>[]
    downloadCsv(`clients-${t}.csv`, rows(data.clients))
    downloadCsv(`orders-${t}.csv`, rows(data.orders.map((o) => ({ ...o, checklist: o.checklist.map((c) => `${c.done ? '[x]' : '[ ]'} ${c.text}`).join(' | ') }))))
    downloadCsv(`payments-${t}.csv`, rows(data.payments))
    downloadCsv(`expenses-${t}.csv`, rows(data.expenses))
    downloadCsv(`daily-checkins-${t}.csv`, rows(data.days))
    setMessage('Downloaded your data as CSV files.')
  }

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const rows = parseClientsCsv(await file.text())
      if (rows.length === 0) {
        setMessage('No clients found. The file needs a "name" column in the first row.')
        return
      }
      const added = importClients(rows)
      setMessage(`Imported ${added} new client(s). ${rows.length - added} skipped because they already exist or have no name.`)
    } catch {
      setMessage("Couldn't read that file. Save it from Excel or Google Sheets as CSV and try again.")
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted small">Make the app fit how you work.</p>
        </div>
      </div>

      {account && (
        <section className="card">
          <h2>Account</h2>
          <div className="actions">
            <span className="grow">
              Signed in as <strong>{account.email}</strong>
            </span>
            <button className="ghost" onClick={account.signOut}>
              <Icon name="logout" size={18} /> Sign out
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Money</h2>
        <div className="form">
          <Field label="Main currency (totals are shown in this)">
            <input id="set-base" value={base} onChange={(e) => setBase(e.target.value)} maxLength={3} />
          </Field>
          <Field label="Monthly income goal">
            <input id="set-goal" type="number" inputMode="decimal" min="0" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="0 = no goal" />
          </Field>
          <Field label="Currencies you get paid in (comma separated, e.g. USD, NGN)" wide>
            <input id="set-currencies" value={currencies} onChange={(e) => setCurrencies(e.target.value)} />
          </Field>
          <Field label="Payment methods" wide>
            <input id="set-methods" value={methods} onChange={(e) => setMethods(e.target.value)} />
          </Field>
          <Field label="Expense categories" wide>
            <input id="set-categories" value={categories} onChange={(e) => setCategories(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h2>Your work</h2>
        <div className="form">
          <Field label="Services you offer" wide>
            <input id="set-services" value={services} onChange={(e) => setServices(e.target.value)} />
          </Field>
          <Field label="Where clients come from" wide>
            <input id="set-platforms" value={platforms} onChange={(e) => setPlatforms(e.target.value)} />
          </Field>
          <Field label="Flag a client after this many quiet days">
            <input id="set-gap" type="number" min="1" value={gap} onChange={(e) => setGap(e.target.value)} />
          </Field>
        </div>
        <div className="actions">
          <button
            className="ghost"
            onClick={() => {
              setServices(DEFAULT_SETTINGS.services.join(', '))
              setPlatforms(DEFAULT_SETTINGS.platforms.join(', '))
              setMethods(DEFAULT_SETTINGS.methods.join(', '))
              setCategories(DEFAULT_SETTINGS.categories.join(', '))
            }}
          >
            Reset lists to defaults
          </button>
          <span className="grow" />
          <button className="primary" onClick={save}>
            Save settings
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Import clients</h2>
        <p className="muted small">
          Bring your client list from Excel or Google Sheets. Save it as CSV with a header row. Columns we read: <code>name</code> (required), <code>contact</code> or <code>email</code> or <code>phone</code>, <code>platform</code> or <code>source</code>, and <code>notes</code>. Names you already have are skipped.
        </p>
        <label className="file-btn">
          <Icon name="upload" size={18} /> Choose CSV file
          <input id="import-file" type="file" accept=".csv,text/csv" onChange={onImport} />
        </label>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted small">
          {mode === 'cloud' ? 'Your records are saved to your account and only you can see them.' : 'In this preview, records are saved in this browser only.'}
        </p>
        <div className="actions">
          {preview ? (
            <span className="muted small">Downloads are turned off in this preview. They work in the full app.</span>
          ) : (
            <button className="ghost" onClick={exportAll}>
              Download everything (CSV)
            </button>
          )}
          {mode === 'local' && (
            <button
              className="ghost"
              onClick={() => {
                loadExamples()
                setMessage('Example data loaded.')
              }}
            >
              Load example data
            </button>
          )}
          <span className="grow" />
          <ConfirmButton
            label="Erase all data"
            question={mode === 'cloud' ? 'Erase everything in your account? This cannot be undone.' : 'Erase everything on this device?'}
            onConfirm={() => {
              resetAll()
              setMessage('All data erased.')
            }}
          />
        </div>
      </section>

      {message && (
        <p className="notice good" role="status">
          {message}
        </p>
      )}
    </div>
  )
}

// Reads a simple CSV (quoted fields allowed) into client rows.
function parseClientsCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',' || ch === ';') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  if (rows.length < 2) return []
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h))
  const iName = col('name', 'client', 'client name', 'full name')
  if (iName < 0) return []
  const iContact = col('contact', 'email', 'phone', 'whatsapp')
  const iPlatform = col('platform', 'source')
  const iNotes = col('notes', 'note', 'comments')
  return rows
    .slice(1)
    .map((r) => ({
      name: (r[iName] ?? '').trim(),
      contact: iContact >= 0 ? (r[iContact] ?? '').trim() : '',
      platform: iPlatform >= 0 ? (r[iPlatform] ?? '').trim() : '',
      notes: iNotes >= 0 ? (r[iNotes] ?? '').trim() : '',
    }))
    .filter((r) => r.name)
}
