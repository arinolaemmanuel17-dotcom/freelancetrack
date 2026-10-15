import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { Field } from './ui'

// Which reminder emails this account gets, and when. Saved straight to the
// email_prefs table (each user can only read and change their own row).

interface Prefs {
  checkin_reminder: boolean
  goal_reminder: boolean
  order_reminder: boolean
  reminder_hour: number
  timezone: string
}

const DEFAULTS: Prefs = { checkin_reminder: true, goal_reminder: true, order_reminder: true, reminder_hour: 20, timezone: deviceTimezone() }

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos'
  } catch {
    return 'Africa/Lagos'
  }
}

function hourLabel(h: number): string {
  const d = new Date(2000, 0, 1, h)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Creates the row with this device's time zone the first time someone signs in,
// so evening reminders arrive in the evening where they live.
export async function ensureEmailPrefs(userId: string): Promise<void> {
  const { data } = await supabase.from('email_prefs').select('user_id').eq('user_id', userId).maybeSingle()
  if (!data) await supabase.from('email_prefs').insert({ user_id: userId, timezone: deviceTimezone() })
}

export function EmailReminders({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [saved, setSaved] = useState<Prefs | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  useEffect(() => {
    let live = true
    supabase
      .from('email_prefs')
      .select('checkin_reminder, goal_reminder, order_reminder, reminder_hour, timezone')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!live) return
        if (error) setMsg({ tone: 'bad', text: "Couldn't load your email settings." })
        const p = (data as Prefs | null) ?? DEFAULTS
        setPrefs(p)
        setSaved(data ? p : null)
      })
    return () => {
      live = false
    }
  }, [userId])

  if (!prefs) return <p className="muted small">Loading email settings…</p>

  const set = (patch: Partial<Prefs>) => {
    setPrefs({ ...prefs, ...patch })
    setMsg(null)
  }
  const changed = !saved || JSON.stringify(saved) !== JSON.stringify(prefs)
  const device = deviceTimezone()

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('email_prefs').upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) {
      setMsg({ tone: 'bad', text: `Couldn't save: ${error.message}` })
      return
    }
    setSaved(prefs)
    setMsg({ tone: 'good', text: 'Email settings saved.' })
  }

  const rows: [keyof Prefs, string, string][] = [
    ['checkin_reminder', 'Check-in reminder', "In the evening, if you haven't checked in that day."],
    ['order_reminder', 'Orders due or late', 'The evening before an order is due, and when it runs late.'],
    ['goal_reminder', 'Monthly goal reminder', 'On the 25th when goal setting opens, and on the 3rd if you still have none.'],
  ]

  return (
    <div className="email-prefs">
      <ul className="checklist">
        {rows.map(([key, label, hint]) => (
          <li key={key}>
            <label>
              <input type="checkbox" checked={prefs[key] as boolean} onChange={(e) => set({ [key]: e.target.checked } as Partial<Prefs>)} />
              <span>
                <strong className="block">{label}</strong>
                <span className="muted small">{hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="form">
        <Field label="Send reminders at">
          <select id="set-reminder-hour" value={prefs.reminder_hour} onChange={(e) => set({ reminder_hour: Number(e.target.value) })}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Your time zone">
          <input id="set-timezone" value={prefs.timezone} readOnly />
        </Field>
      </div>
      <div className="actions">
        {prefs.timezone !== device && (
          <button className="ghost" onClick={() => set({ timezone: device })}>
            Use this device's time zone ({device})
          </button>
        )}
        <span className="grow" />
        <button className="primary" onClick={save} disabled={busy || !changed}>
          {busy ? 'Saving…' : 'Save email settings'}
        </button>
      </div>
      {msg && <p className={`notice ${msg.tone}`} role="status">{msg.text}</p>}
      <p className="muted small">Emails come from hello@freelancetracker.app. Every email has a link to stop them.</p>
    </div>
  )
}
