import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { ConfirmButton, Modal } from '../components/ui'
import { ChipPicker } from '../components/Forms'
import type { CheckinEntry } from '../types'
import { addDays, checkinDates, checkinStreak, dayTotals, daysBetween, today } from '../utils'

const HOUR_PICKS = [0.5, 1, 2, 3, 4]

function niceDate(d: string, withYear = false): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}
function dayLabel(d: string): string {
  const t = today()
  if (d === t) return 'Today'
  if (d === addDays(t, -1)) return 'Yesterday'
  return niceDate(d)
}
function ago(d: string): string {
  const n = daysBetween(d, today())
  if (n <= 1) return niceDate(d, true)
  return n < 7 ? `${n} days ago` : n < 14 ? 'Last week' : niceDate(d, true)
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
// 1.33 -> "1h 20m", 0.5 -> "30m", 5 -> "5h"
const fmtH = (h: number) => {
  const mins = Math.round(h * 60)
  const hh = Math.floor(mins / 60)
  const mm = mins % 60
  return hh && mm ? `${hh}h ${mm}m` : hh ? `${hh}h` : `${mm}m`
}
export function elapsed(fromIso: string, nowMs = Date.now()): string {
  const s = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Ticks once a second while a timer is running.
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

type Draft = { entry?: CheckinEntry; hours?: number; activity?: string; platform?: string; startedAt?: string | null }

// Check-ins: today's entries (add as many as you like, or use the timer), then your history.
export function DailyLog({ open }: { open?: 'entry' | 'timer' }) {
  const { data, timer, stopTimer, cancelTimer, deleteEntry, saveDay } = useStore()
  const t = today()
  const [draft, setDraft] = useState<Draft | null>(open === 'entry' ? {} : null)
  const [startOpen, setStartOpen] = useState(open === 'timer' && !timer)
  const nowMs = useNow(!!timer)

  const todayTotals = dayTotals(data, t)
  const todayDay = data.days.find((d) => d.date === t)
  const [blocker, setBlocker] = useState(todayDay?.blockers ?? '')
  const [blockerSaved, setBlockerSaved] = useState(false)

  const streak = checkinStreak(data, t)
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6))
  const weekTotals = week.map((d) => dayTotals(data, d))
  const weekHours = Math.round(weekTotals.reduce((s, d) => s + (d?.hours ?? 0), 0) * 10) / 10
  const weekOutreach = weekTotals.reduce((s, d) => s + (d?.outreach ?? 0), 0)
  const maxHours = Math.max(8, ...weekTotals.map((d) => d?.hours ?? 0))
  const history = checkinDates(data).filter((d) => d !== t).slice(0, 60).map((d) => dayTotals(data, d)).filter((x) => x !== null)
  const allHours = checkinDates(data).reduce((s, d) => s + (dayTotals(data, d)?.hours ?? 0), 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Check-ins</h1>
          <p className="muted small">Log each block of work today, or let the timer do it.</p>
        </div>
        <div className="head-actions">
          {!timer && (
            <button className="ghost bordered" onClick={() => setStartOpen(true)}>
              <Icon name="clock" size={18} /> Start timer
            </button>
          )}
          <button className="primary" onClick={() => setDraft({})}>
            <Icon name="plus" size={18} /> Add entry
          </button>
        </div>
      </div>

      {timer && (
        <section className="card timer-card" aria-live="polite">
          <div className="timer-main">
            <span className="timer-dot" aria-hidden="true" />
            <div className="grow">
              <p className="muted small">Timer running since {clock(timer.startedAt)}</p>
              <strong className="timer-time num">{elapsed(timer.startedAt, nowMs)}</strong>
              <p className="small">{[timer.activity, timer.platform].filter(Boolean).join(' · ') || 'No activity picked yet'}</p>
            </div>
          </div>
          <div className="actions">
            <ConfirmButton label="Discard" question="Stop without saving?" onConfirm={cancelTimer} />
            <span className="grow" />
            <button
              className="primary"
              onClick={() => {
                const r = stopTimer()
                if (r) setDraft({ hours: r.hours, activity: r.activity, platform: r.platform, startedAt: r.startedAt })
              }}
            >
              <Icon name="check" size={18} /> Stop and save
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Today</h2>
          <span className="muted small">{niceDate(t, true)}</span>
        </div>
        {todayTotals && todayTotals.entries.length > 0 ? (
          <>
            <ul className="rows timeline">
              {todayTotals.entries.map((e) => (
                <li key={e.id}>
                  <span className="tl-time num muted small">{clock(e.startedAt ?? e.createdAt)}</span>
                  <span className="grow">
                    <strong>{e.activity || 'Work'}</strong>
                    <span className="muted small block">
                      {[e.platform, e.outreach ? `${e.outreach} contacted` : '', e.note, e.startedAt ? 'from timer' : ''].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className="num strong">{fmtH(e.hours)}</span>
                  <span className="tl-actions">
                    <button className="ghost icon-btn" aria-label={`Edit ${e.activity || 'entry'}`} onClick={() => setDraft({ entry: e })}>
                      <Icon name="edit" size={16} />
                    </button>
                    <ConfirmButton label="Remove" question="Remove this entry?" onConfirm={() => deleteEntry(e.id)} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="today-total">
              <span>Total today</span>
              <strong className="num">{fmtH(todayTotals.hours)}</strong>
              <span className="muted small">{todayTotals.outreach} contacted</span>
            </div>
          </>
        ) : (
          <div className="chart-empty">
            <p>Nothing logged yet today. Add an entry, or start the timer when you begin work.</p>
          </div>
        )}
        <form
          className="inline-add blocker-row"
          onSubmit={(ev) => {
            ev.preventDefault()
            saveDay({ date: t, hours: todayDay?.hours ?? 0, outreach: todayDay?.outreach ?? 0, notes: todayDay?.notes ?? '', platforms: todayDay?.platforms ?? [], activities: todayDay?.activities ?? [], blockers: blocker.trim() })
            setBlockerSaved(true)
          }}
        >
          <input id="today-blocker" value={blocker} onChange={(ev) => { setBlocker(ev.target.value); setBlockerSaved(false) }} placeholder="Anything blocking you today? (optional)" aria-label="Blocker for today" />
          <button type="submit" className="ghost bordered">{blockerSaved ? 'Saved' : 'Save'}</button>
        </form>
      </section>

      <div className="stats four">
        <div className="stat">
          <span>Streak</span>
          <strong>
            <Icon name="flame" size={18} /> {streak} day{streak === 1 ? '' : 's'}
          </strong>
        </div>
        <div className="stat">
          <span>Hours, last 7 days</span>
          <strong>{weekHours}</strong>
          <small className="muted">{weekTotals.filter(Boolean).length} of 7 days logged</small>
        </div>
        <div className="stat">
          <span>Contacted, last 7 days</span>
          <strong>{weekOutreach}</strong>
        </div>
        <div className="stat">
          <span>All time</span>
          <strong>{Math.round(allHours * 10) / 10} h</strong>
          <small className="muted">{checkinDates(data).length} day(s) logged</small>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Last 7 days</h2>
          <span className="muted small">Hours worked</span>
        </div>
        <div className="week-strip" role="img" aria-label={`Hours worked over the last 7 days, ${weekHours} in total`}>
          {week.map((d, i) => {
            const tot = weekTotals[i]
            const h = tot?.hours ?? 0
            return (
              <div key={d} className={d === t ? 'wk-day active' : 'wk-day'}>
                <span className="wk-value num">{tot ? `${Math.round(h * 10) / 10}h` : ''}</span>
                <span className="wk-track">
                  <span className={tot && h > 0 ? 'wk-bar' : 'wk-bar none'} style={{ height: `${Math.max(tot && h > 0 ? 6 : 0, (h / maxHours) * 100)}%` }} />
                </span>
                <span className="wk-label">{d === t ? 'Today' : niceDate(d).split(' ')[0].replace(',', '')}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>History</h2>
          <span className="muted small">Past days are kept as a record and can't be changed.</span>
        </div>
        {history.length === 0 ? (
          <p className="muted small">Your past days will show here.</p>
        ) : (
          <ul className="rows history">
            {history.map((d) => (
              <li key={d.date}>
                <span className="hist-day">
                  <strong>{dayLabel(d.date)}</strong>
                  <span className="muted small block">{ago(d.date)}</span>
                </span>
                <span className="grow hist-body">
                  {d.entries.length > 0 ? (
                    <span className="tag-row">
                      {d.entries.map((e) => (
                        <span key={e.id} className="badge info">
                          {e.activity || 'Work'}
                          {e.platform ? ` · ${e.platform}` : ''} · {fmtH(e.hours)}
                        </span>
                      ))}
                    </span>
                  ) : (
                    (d.activities.length > 0 || d.platforms.length > 0) && (
                      <span className="tag-row">
                        {d.activities.map((a) => (
                          <span key={a} className="badge info">{a}</span>
                        ))}
                        {d.platforms.map((p) => (
                          <span key={p} className="badge">{p}</span>
                        ))}
                      </span>
                    )
                  )}
                  {d.blockers && <span className="badge warn">Blocked: {d.blockers}</span>}
                  {d.notes && <span className="muted small">{d.notes}</span>}
                </span>
                <span className="hist-total right">
                  <strong className="num">{fmtH(d.hours)}</strong>
                  <span className="muted small block">{d.outreach} contacted</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {draft && <EntryModal draft={draft} onClose={() => setDraft(null)} />}
      {startOpen && <StartTimerModal onClose={() => setStartOpen(false)} />}
    </div>
  )
}

function Stepper({ id, value, onChange, step, unit, label }: { id: string; value: number; onChange: (v: number) => void; step: number; unit: string; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="step-round" onClick={() => onChange(Math.max(0, +(value - step).toFixed(2)))} aria-label={`Less ${label.toLowerCase()}`}>
        −
      </button>
      <span className="stepper-value">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={String(value)}
          onChange={(e) => {
            const v = Number(e.target.value.replace(/[^0-9.]/g, ''))
            onChange(Number.isFinite(v) ? v : 0)
          }}
          aria-label={label}
        />
        <span className="muted small">{unit}</span>
      </span>
      <button type="button" className="step-round" onClick={() => onChange(+(value + step).toFixed(2))} aria-label={`More ${label.toLowerCase()}`}>
        +
      </button>
    </div>
  )
}

// Add or edit one entry for today.
export function EntryModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { saveEntry } = useStore()
  const e = draft.entry
  const [activity, setActivity] = useState<string[]>(e?.activity ? [e.activity] : draft.activity ? [draft.activity] : [])
  const [platform, setPlatform] = useState<string[]>(e?.platform ? [e.platform] : draft.platform ? [draft.platform] : [])
  const [hours, setHours] = useState(e?.hours ?? draft.hours ?? 1)
  const [outreach, setOutreach] = useState(e?.outreach ?? 0)
  const [note, setNote] = useState(e?.note ?? '')
  const [error, setError] = useState('')
  const fromTimer = !!(draft.startedAt ?? e?.startedAt)

  const save = () => {
    if (!(hours > 0)) return setError('Add how long you worked (more than 0 hours).')
    const id = saveEntry({ id: e?.id, activity: activity[0] ?? '', platform: platform[0] ?? '', hours, outreach, note: note.trim(), startedAt: draft.startedAt ?? e?.startedAt ?? null })
    if (id === null) return setError('Only today can be logged. Past days are kept as a record.')
    onClose()
  }

  return (
    <Modal title={e ? 'Edit entry' : fromTimer ? 'Save timer entry' : 'Add an entry'} onClose={onClose}>
      <div className="checkin">
        <p className="muted small checkin-date">
          <Icon name="checkin" size={14} /> {niceDate(today(), true)}
          {fromTimer && draft.startedAt ? ` · started ${clock(draft.startedAt)}` : ''}
        </p>
        <div className="checkin-section">
          <span className="checkin-label">What did you do?</span>
          <ChipPicker id="entry-new-activity" list="activities" noun="activity" single selected={activity} onChange={setActivity} />
        </div>
        <div className="checkin-section">
          <span className="checkin-label">Where?</span>
          <ChipPicker id="entry-new-platform" list="platforms" noun="platform" single selected={platform} onChange={setPlatform} />
        </div>
        <div className="checkin-grid">
          <div className="checkin-block">
            <span className="checkin-label">How long?</span>
            <Stepper id="entry-hours" label="Hours" value={hours} onChange={(v) => setHours(Math.min(24, v))} step={0.25} unit="hours" />
            <div className="chips">
              {HOUR_PICKS.map((h) => (
                <button key={h} type="button" className={hours === h ? 'chip active' : 'chip'} onClick={() => setHours(h)}>
                  {h < 1 ? '30m' : `${h}h`}
                </button>
              ))}
            </div>
          </div>
          <div className="checkin-block">
            <span className="checkin-label">People contacted</span>
            <Stepper id="entry-outreach" label="People contacted" value={outreach} onChange={(v) => setOutreach(Math.round(v))} step={1} unit="people" />
            <p className="muted small">Leave at 0 if you didn't reach out to anyone.</p>
          </div>
        </div>
        <label className="field checkin-section">
          <span>Note (optional)</span>
          <input id="entry-note" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="e.g. Finished logo drafts" />
        </label>
        {error && <p className="notice bad">{error}</p>}
        <div className="actions">
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={save}>
            <Icon name="check" size={18} /> {e ? 'Save changes' : 'Save entry'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Pick what you're about to work on (optional), then start the clock.
export function StartTimerModal({ onClose }: { onClose: () => void }) {
  const { startTimer } = useStore()
  const [activity, setActivity] = useState<string[]>([])
  const [platform, setPlatform] = useState<string[]>([])
  return (
    <Modal title="Start a work timer" onClose={onClose}>
      <div className="checkin">
        <p className="muted small">The timer keeps running even if you close the app on this device. When you stop it, you'll confirm the entry before it's saved.</p>
        <div className="checkin-section">
          <span className="checkin-label">What are you working on? (optional)</span>
          <ChipPicker id="timer-new-activity" list="activities" noun="activity" single selected={activity} onChange={setActivity} />
        </div>
        <div className="checkin-section">
          <span className="checkin-label">Where? (optional)</span>
          <ChipPicker id="timer-new-platform" list="platforms" noun="platform" single selected={platform} onChange={setPlatform} />
        </div>
        <div className="actions">
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              startTimer(activity[0] ?? '', platform[0] ?? '')
              onClose()
            }}
          >
            <Icon name="clock" size={18} /> Start timer
          </button>
        </div>
      </div>
    </Modal>
  )
}
