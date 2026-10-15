import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { SettingRow, Switch } from './SettingsKit'

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

  if (!prefs) return <p className="muted small set-loading">Loading email settings…</p>

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
    ['goal_reminder', 'Monthly goal', 'On the 25th when goal setting opens, and on the 3rd if you still have none.'],
  ]

  return (
    <>
      {rows.map(([key, label, hint]) => (
        <SettingRow key={key} label={label} hint={hint}>
          <Switch id={`set-${key}`} label={label} checked={prefs[key] as boolean} onChange={(v) => set({ [key]: v } as Partial<Prefs>)} />
        </SettingRow>
      ))}
      <SettingRow label="Send reminders at" hint="Reminders arrive at this time in your time zone." htmlFor="set-reminder-hour">
        <select id="set-reminder-hour" value={prefs.reminder_hour} onChange={(e) => set({ reminder_hour: Number(e.target.value) })}>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow
        label="Time zone"
        hint={prefs.timezone !== device ? <>This device is in {device}. <button type="button" className="link" onClick={() => set({ timezone: device })}>Use it</button></> : 'Set from this device.'}
      >
        <span className="set-value">{prefs.timezone.replace(/_/g, ' ')}</span>
      </SettingRow>
      <div className="set-save">
        {msg && <p className={`notice ${msg.tone}`} role="status">{msg.text}</p>}
        <span className="grow" />
        <button className="primary" onClick={save} disabled={busy || !changed}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  )
}
