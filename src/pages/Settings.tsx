import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useStore } from '../store'
import { supabase } from '../supabase'
import { ConfirmButton } from '../components/ui'
import { Icon } from '../components/Icon'
import { EmailReminders } from '../components/EmailReminders'
import { DeleteAccount } from '../components/DeleteAccount'
import { ListEditor, SettingGroup, SettingRow, currencyName, currencyOptions } from '../components/SettingsKit'
import { DEFAULT_SETTINGS } from '../storage'
import { downloadCsv, initials, today } from '../utils'

type Section = 'profile' | 'notifications' | 'money' | 'work' | 'data' | 'privacy'

const SECTIONS: { id: Section; label: string; icon: string; hint: string; cloud?: boolean }[] = [
  { id: 'profile', label: 'Profile', icon: 'clients', hint: 'Name, email, password', cloud: true },
  { id: 'notifications', label: 'Notifications', icon: 'bell', hint: 'Reminder emails', cloud: true },
  { id: 'money', label: 'Money', icon: 'money', hint: 'Currencies, methods, categories' },
  { id: 'work', label: 'Work', icon: 'orders', hint: 'Services, platforms, activities' },
  { id: 'data', label: 'Import & export', icon: 'upload', hint: 'CSV import, download, erase' },
  { id: 'privacy', label: 'Privacy & help', icon: 'shield', hint: 'Policy, terms, contact' },
]

export function Settings({ focus }: { focus?: string | null }) {
  const { mode, account } = useStore()
  const cloud = mode === 'cloud' && !!account
  const sections = SECTIONS.filter((x) => !x.cloud || cloud)
  const initial: Section | null = focus === 'name' ? 'profile' : focus === 'email' ? 'notifications' : null
  // On phones, null shows the menu; on wide screens the first section shows beside it.
  const [section, setSection] = useState<Section | null>(initial)
  const active = section ?? sections[0].id
  const current = sections.find((x) => x.id === active)!

  const open = (id: Section) => {
    setSection(id)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="page">
      <div className={section ? 'settings has-section' : 'settings'}>
        <aside className="settings-nav" aria-label="Settings sections">
          <div className="page-head">
            <div>
              <h1>Settings</h1>
              <p className="muted small">Make the app fit how you work.</p>
            </div>
          </div>
          {cloud && account && (
            <button className="settings-me" onClick={() => open('profile')}>
              <span className="avatar lg" aria-hidden="true">{initials(account.name || account.email)}</span>
              <span className="min0">
                <strong className="block ellipsis">{account.name || 'Add your name'}</strong>
                <span className="muted small block ellipsis">{account.email}</span>
              </span>
            </button>
          )}
          <nav className="settings-menu">
            {sections.map((x) => (
              <button key={x.id} className={x.id === active ? 'settings-link active' : 'settings-link'} aria-current={x.id === active ? 'page' : undefined} onClick={() => open(x.id)}>
                <span className="settings-icon" aria-hidden="true"><Icon name={x.icon} size={18} /></span>
                <span className="grow min0">
                  <span className="block">{x.label}</span>
                  <span className="muted small block ellipsis settings-link-hint">{x.hint}</span>
                </span>
                <span className="chev" aria-hidden="true">›</span>
              </button>
            ))}
          </nav>
          {cloud && account && (
            <button className="settings-signout" onClick={account.signOut}>
              <Icon name="logout" size={18} /> Sign out
            </button>
          )}
        </aside>

        <div className="settings-pane">
          <button className="settings-back" onClick={() => setSection(null)}>
            <Icon name="back" size={18} /> Settings
          </button>
          <h1 className="settings-title">{current.label}</h1>
          {active === 'profile' && <ProfileSection focusName={focus === 'name'} />}
          {active === 'notifications' && account && (
            <SettingGroup title="Reminder emails" description="We only email you about things you switch on here. Every email has a link to stop them.">
              <EmailReminders userId={account.userId} />
            </SettingGroup>
          )}
          {active === 'money' && <MoneySection />}
          {active === 'work' && <WorkSection />}
          {active === 'data' && <DataSection />}
          {active === 'privacy' && <PrivacySection />}
        </div>
      </div>
    </div>
  )
}

// ---------- Profile ----------
function ProfileSection({ focusName }: { focusName: boolean }) {
  const { account } = useStore()
  const [name, setName] = useState(account?.name ?? '')
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (focusName) nameRef.current?.focus()
  }, [focusName])
  if (!account) return null

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setMsg({ tone: 'bad', text: 'Enter a name first.' })
    setBusy(true)
    const err = await account.setName(name)
    setBusy(false)
    setMsg(err ? { tone: 'bad', text: `Couldn't save your name: ${err}` } : { tone: 'good', text: 'Name saved.' })
  }

  return (
    <>
      <SettingGroup title="Your details">
        <form onSubmit={saveName}>
          <SettingRow label="Name" hint="Shown on your Home page and in emails we send you." htmlFor="set-name">
            <input id="set-name" ref={nameRef} autoComplete="name" maxLength={60} value={name} onChange={(e) => { setName(e.target.value); setMsg(null) }} placeholder="e.g. Emmanuel" />
          </SettingRow>
          <SettingRow label="Email" hint="You sign in with this. Contact support to change it.">
            <span className="set-value selectable">{account.email}</span>
          </SettingRow>
          <div className="set-save">
            {msg && <p className={`notice ${msg.tone}`} role="status">{msg.text}</p>}
            <span className="grow" />
            <button className="primary" type="submit" disabled={busy || !name.trim() || name.trim() === account.name}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </SettingGroup>

      <PasswordGroup />

      <SettingGroup title="Danger zone" tone="danger">
        <DeleteAccount />
      </SettingGroup>
    </>
  )
}

function PasswordGroup() {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) return setMsg({ tone: 'bad', text: 'Use at least 8 characters.' })
    if (pw !== pw2) return setMsg({ tone: 'bad', text: "The two passwords don't match." })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setMsg({ tone: 'bad', text: /same|different/i.test(error.message) ? 'Choose a password you haven’t used before.' : `Couldn't change it: ${error.message}` })
    setPw('')
    setPw2('')
    setMsg({ tone: 'good', text: 'Password changed.' })
  }
  return (
    <SettingGroup title="Password">
      <form onSubmit={submit}>
        <SettingRow label="New password" hint="At least 8 characters." htmlFor="set-pw">
          <input id="set-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setMsg(null) }} />
        </SettingRow>
        <SettingRow label="Confirm new password" htmlFor="set-pw2">
          <input id="set-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setMsg(null) }} />
        </SettingRow>
        <div className="set-save">
          {msg && <p className={`notice ${msg.tone}`} role="status">{msg.text}</p>}
          <span className="grow" />
          <button className="primary" type="submit" disabled={busy || !pw || !pw2}>
            {busy ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </SettingGroup>
  )
}

// Shared "save" bar for sections that edit the app settings.
function useSaved() {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!saved) return
    const t = window.setTimeout(() => setSaved(false), 2500)
    return () => window.clearTimeout(t)
  }, [saved])
  return [saved, setSaved] as const
}

function SaveBar({ dirty, onSave, onReset, saved, resetLabel }: { dirty: boolean; onSave: () => void; onReset?: () => void; saved: boolean; resetLabel?: string }) {
  if (!dirty && !saved) {
    return onReset ? (
      <div className="set-reset">
        <button type="button" className="link" onClick={onReset}>{resetLabel ?? 'Reset'}</button>
      </div>
    ) : null
  }
  return (
    <div className={dirty ? 'set-save sticky dirty' : 'set-save sticky'}>
      {onReset && (
        <button type="button" className="ghost" onClick={onReset}>
          {resetLabel ?? 'Reset'}
        </button>
      )}
      <span className="grow muted small" role="status">{saved ? 'Saved.' : dirty ? 'You have unsaved changes.' : ''}</span>
      <button className="primary" onClick={onSave} disabled={!dirty}>
        Save changes
      </button>
    </div>
  )
}

// ---------- Money ----------
function MoneySection() {
  const { data, updateSettings } = useStore()
  const s = data.settings
  const start = useMemo(
    () => ({ base: s.baseCurrency, alt: s.altCurrency, rate: s.altRate ? String(s.altRate) : '', step: String(s.amountStep), currencies: s.currencies, methods: s.methods, categories: s.categories }),
    [s],
  )
  const [f, setF] = useState(start)
  const [saved, setSaved] = useSaved()
  const dirty = JSON.stringify(f) !== JSON.stringify(start)
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))

  const save = () => {
    const base = f.base
    const currencies = f.currencies.filter((c) => /^[A-Z]{3}$/.test(c))
    if (!currencies.includes(base)) currencies.unshift(base)
    updateSettings({
      baseCurrency: base,
      currencies,
      methods: f.methods,
      categories: f.categories,
      amountStep: Number(f.step) > 0 ? Number(f.step) : 10,
      altCurrency: f.alt && f.alt !== base ? f.alt : '',
      altRate: f.alt && f.alt !== base ? Math.max(0, Number(f.rate) || 0) : 0,
    })
    setSaved(true)
  }

  return (
    <>
      <SettingGroup title="Currency" description="How totals are shown across the app.">
        <SettingRow label="Main currency" hint="All totals, goals and statistics use this." htmlFor="set-base">
          <select id="set-base" value={f.base} onChange={(e) => set({ base: e.target.value })}>
            {currencyOptions(f.base, ...f.currencies).map((c) => (
              <option key={c} value={c}>{c} · {currencyName(c)}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Second currency" hint="Optional. Lets you flip totals to another currency, like naira." htmlFor="set-alt">
          <select id="set-alt" value={f.alt} onChange={(e) => set({ alt: e.target.value })}>
            <option value="">None</option>
            {currencyOptions(f.alt).filter((c) => c !== f.base).map((c) => (
              <option key={c} value={c}>{c} · {currencyName(c)}</option>
            ))}
          </select>
        </SettingRow>
        {f.alt && f.alt !== f.base && (
          <SettingRow label="Exchange rate" hint={`How many ${f.alt} for 1 ${f.base}. Leave empty to use the rate from your latest payment.`} htmlFor="set-alt-rate">
            <div className="input-affix">
              <span>1 {f.base} =</span>
              <input id="set-alt-rate" type="number" inputMode="decimal" min="0" step="any" value={f.rate} onChange={(e) => set({ rate: e.target.value })} placeholder="Auto" />
              <span>{f.alt}</span>
            </div>
          </SettingRow>
        )}
        <SettingRow label="Amount buttons step" hint="How much the + and − buttons change an amount." htmlFor="set-step">
          <select id="set-step" value={f.step} onChange={(e) => set({ step: e.target.value })}>
            {['1', '5', '10', '50', '100', '500', '1000', '5000'].map((v) => (
              <option key={v} value={v}>{Number(v).toLocaleString()}</option>
            ))}
          </select>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Lists" description="These show up as choices when you add payments and expenses.">
        <SettingRow label="Currencies you get paid in" hint="3-letter codes, e.g. USD, NGN." stack>
          <ListEditor id="set-currencies" upper values={f.currencies} onChange={(v) => set({ currencies: v })} placeholder="Add a currency code" />
        </SettingRow>
        <SettingRow label="Payment methods" hint="How clients pay you." stack>
          <ListEditor id="set-methods" values={f.methods} onChange={(v) => set({ methods: v })} placeholder="e.g. PayPal" />
        </SettingRow>
        <SettingRow label="Expense categories" hint="What you spend money on." stack>
          <ListEditor id="set-categories" values={f.categories} onChange={(v) => set({ categories: v })} placeholder="e.g. Software" />
        </SettingRow>
      </SettingGroup>

      <SaveBar dirty={dirty} saved={saved} onSave={save} onReset={dirty ? () => setF(start) : undefined} resetLabel="Undo changes" />
    </>
  )
}

// ---------- Work ----------
function WorkSection() {
  const { data, updateSettings } = useStore()
  const s = data.settings
  const start = useMemo(() => ({ services: s.services, platforms: s.platforms, activities: s.activities, gap: String(s.outreachGapDays) }), [s])
  const [f, setF] = useState(start)
  const [saved, setSaved] = useSaved()
  const dirty = JSON.stringify(f) !== JSON.stringify(start)
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const save = () => {
    updateSettings({ services: f.services, platforms: f.platforms, activities: f.activities, outreachGapDays: Math.max(1, Number(f.gap) || 3) })
    setSaved(true)
  }
  const defaults = () => set({ services: DEFAULT_SETTINGS.services, platforms: DEFAULT_SETTINGS.platforms, activities: DEFAULT_SETTINGS.activities })

  return (
    <>
      <SettingGroup title="Your work" description="These show up as choices when you add orders and check-ins.">
        <SettingRow label="Services you offer" hint="Used on orders and in Statistics." stack>
          <ListEditor id="set-services" values={f.services} onChange={(v) => set({ services: v })} placeholder="e.g. Peer review" />
        </SettingRow>
        <SettingRow label="Platforms" hint="Where clients come from and where you work." stack>
          <ListEditor id="set-platforms" values={f.platforms} onChange={(v) => set({ platforms: v })} placeholder="e.g. Fiverr" />
        </SettingRow>
        <SettingRow label="Check-in activities" hint="What you do in a day." stack>
          <ListEditor id="set-activities" values={f.activities} onChange={(v) => set({ activities: v })} placeholder="e.g. Outreach" />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Clients">
        <SettingRow label="Quiet client alert" hint="Flag a client when you haven't been in touch for this many days." htmlFor="set-gap">
          <div className="input-affix">
            <input id="set-gap" type="number" min="1" max="365" value={f.gap} onChange={(e) => set({ gap: e.target.value })} />
            <span>days</span>
          </div>
        </SettingRow>
      </SettingGroup>

      <SaveBar dirty={dirty} saved={saved} onSave={save} onReset={defaults} resetLabel="Use default lists" />
    </>
  )
}

// ---------- Import & export ----------
function DataSection() {
  const { data, resetAll, loadExamples, importClients, mode } = useStore()
  const preview = import.meta.env.VITE_PREVIEW === '1'
  const [msg, setMsg] = useState<string | null>(null)

  const exportAll = () => {
    const t = today()
    const rows = (x: unknown[]) => x as Record<string, unknown>[]
    downloadCsv(`clients-${t}.csv`, rows(data.clients))
    downloadCsv(`orders-${t}.csv`, rows(data.orders.map((o) => ({ ...o, checklist: o.checklist.map((c) => `${c.done ? '[x]' : '[ ]'} ${c.text}`).join(' | ') }))))
    downloadCsv(`payments-${t}.csv`, rows(data.payments))
    downloadCsv(`expenses-${t}.csv`, rows(data.expenses))
    downloadCsv(`daily-checkins-${t}.csv`, rows(data.days))
    downloadCsv(`checkin-entries-${t}.csv`, rows(data.entries))
    setMsg('Downloaded your data as CSV files.')
  }

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const rows = parseClientsCsv(await file.text())
      if (rows.length === 0) return setMsg('No clients found. The file needs a "name" column in the first row.')
      const added = importClients(rows)
      setMsg(`Imported ${added} new client(s). ${rows.length - added} skipped because they already exist or have no name.`)
    } catch {
      setMsg("Couldn't read that file. Save it from Excel or Google Sheets as CSV and try again.")
    }
  }

  return (
    <>
      {msg && <p className="notice good" role="status">{msg}</p>}
      <SettingGroup title="Import">
        <SettingRow
          label="Import clients"
          hint={<>From Excel or Google Sheets saved as CSV. We read <code>name</code> (required), <code>contact</code>/<code>email</code>/<code>phone</code>, <code>platform</code> and <code>notes</code>. Existing names are skipped.</>}
        >
          <label className="file-btn">
            <Icon name="upload" size={18} /> Choose CSV
            <input id="import-file" type="file" accept=".csv,text/csv" onChange={onImport} />
          </label>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Export">
        <SettingRow label="Download your data" hint="Clients, orders, payments, expenses and check-ins as CSV files you can open in Excel.">
          {preview ? <span className="muted small">Off in this preview</span> : <button className="ghost bordered" onClick={exportAll}>Download CSV</button>}
        </SettingRow>
        {mode === 'local' && (
          <SettingRow label="Example data" hint="Fill the app with sample records to try it out.">
            <button className="ghost bordered" onClick={() => { loadExamples(); setMsg('Example data loaded.') }}>Load examples</button>
          </SettingRow>
        )}
      </SettingGroup>

      <SettingGroup title="Erase" tone="danger">
        <SettingRow label="Erase all records" hint={mode === 'cloud' ? 'Removes your clients, orders, money and check-ins but keeps your account. This cannot be undone.' : 'Removes everything saved on this device.'}>
          <ConfirmButton
            label="Erase all"
            question={mode === 'cloud' ? 'Erase everything? This cannot be undone.' : 'Erase everything on this device?'}
            onConfirm={() => {
              resetAll()
              setMsg('All data erased.')
            }}
          />
        </SettingRow>
      </SettingGroup>
    </>
  )
}

// ---------- Privacy & help ----------
function PrivacySection() {
  const links: [string, string, string][] = [
    ['Privacy Policy', 'What we collect and how we protect it.', '/privacy'],
    ['Terms of Use', 'The rules for using Freelance Tracker.', '/terms'],
    ['Contact support', 'support@freelancetracker.app', 'mailto:support@freelancetracker.app'],
  ]
  return (
    <SettingGroup title="Privacy & help" description="Your records are private to your account. Only you can see them.">
      {links.map(([label, hint, href]) => (
        <a key={href} className="set-row link-row" href={href} target={href.startsWith('/') ? '_blank' : undefined} rel="noopener">
          <span className="set-row-text">
            <span className="set-row-label">{label}</span>
            <span className="set-row-hint">{hint}</span>
          </span>
          <span className="chev" aria-hidden="true">›</span>
        </a>
      ))}
    </SettingGroup>
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
