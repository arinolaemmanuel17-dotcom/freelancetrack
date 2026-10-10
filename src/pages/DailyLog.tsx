import { useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import type { DayEntry } from '../types'
import { addDays, checkinStreak, today } from '../utils'

const blank = (date: string): DayEntry => ({ date, hours: 0, outreach: 0, blockers: '', notes: '' })
const HOUR_PICKS = [1, 2, 4, 6, 8]

function niceDate(d: string, withYear = false): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

function ago(d: string): string {
  const t = today()
  if (d === t || d === addDays(t, -1)) return niceDate(d, true)
  const [y1, m1, d1] = d.split('-').map(Number)
  const [y2, m2, d2] = t.split('-').map(Number)
  const n = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000)
  return n < 7 ? `${n} days ago` : n < 14 ? 'Last week' : niceDate(d, true)
}

function dayLabel(d: string): string {
  const t = today()
  if (d === t) return 'Today'
  if (d === addDays(t, -1)) return 'Yesterday'
  return niceDate(d)
}

export function DailyLog() {
  const { data } = useStore()
  const [date, setDate] = useState(today())
  const t = today()

  const streak = checkinStreak(data, t)
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6))
  const byDate = new Map(data.days.map((d) => [d.date, d]))
  const weekHours = week.reduce((s, d) => s + (byDate.get(d)?.hours ?? 0), 0)
  const weekOutreach = week.reduce((s, d) => s + (byDate.get(d)?.outreach ?? 0), 0)
  const maxHours = Math.max(8, ...week.map((d) => byDate.get(d)?.hours ?? 0))
  const history = [...data.days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Daily check-in</h1>
          <p className="muted small">Takes 30 seconds. Small daily notes show you how your week really went.</p>
        </div>
      </div>

      <div className="two-col wide-left">
        <CheckInCard key={date} date={date} setDate={setDate} />

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>This week</h2>
              <span className="muted small">
                <Icon name="flame" size={14} /> {streak}-day streak
              </span>
            </div>
            <div className="week-strip" role="img" aria-label={`Hours worked over the last 7 days, ${weekHours} in total`}>
              {week.map((d) => {
                const e = byDate.get(d)
                const h = e?.hours ?? 0
                return (
                  <button key={d} type="button" className={d === date ? 'wk-day active' : 'wk-day'} onClick={() => setDate(d)} aria-label={`${niceDate(d)}: ${h} hours`}>
                    <span className="wk-value num">{h ? `${h}h` : ''}</span>
                    <span className="wk-track">
                      <span className={e ? 'wk-bar' : 'wk-bar none'} style={{ height: `${Math.max(e ? 6 : 0, (h / maxHours) * 100)}%` }} />
                    </span>
                    <span className="wk-label">{niceDate(d).split(' ')[0].replace(',', '')}</span>
                  </button>
                )
              })}
            </div>
            <div className="mini-stats">
              <div>
                <strong className="num">{weekHours}</strong>
                <span className="muted small">hours</span>
              </div>
              <div>
                <strong className="num">{weekOutreach}</strong>
                <span className="muted small">people contacted</span>
              </div>
              <div>
                <strong className="num">{week.filter((d) => byDate.has(d)).length}/7</strong>
                <span className="muted small">days logged</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>History</h2>
          <span className="muted small">{data.days.length} day(s) logged</span>
        </div>
        {history.length === 0 ? (
          <p className="muted small">Your check-ins will show up here.</p>
        ) : (
          <div className="table-card flat">
            <div className="trow thead history-grid">
              <span>Day</span>
              <span className="right">Hours</span>
              <span className="right">Contacted</span>
              <span>Notes</span>
              <span />
            </div>
            {history.map((d) => (
              <div
                key={d.date}
                className={d.date === date ? 'trow history-grid clickable selected' : 'trow history-grid clickable'}
                onClick={() => {
                  setDate(d.date)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                <span className="cell-main">
                  <span>
                    <strong>{dayLabel(d.date)}</strong>
                    <span className="muted small block">{ago(d.date)}</span>
                  </span>
                </span>
                <span className="right num" data-label="Hours">{d.hours ? `${d.hours} h` : '–'}</span>
                <span className="right num" data-label="Contacted">
                  {d.outreach || '–'}
                  {d.outreach ? <span className="unit-sm"> {d.outreach === 1 ? 'person' : 'people'}</span> : null}
                </span>
                <span className="history-notes">
                  {d.blockers && <span className="badge warn">Blocked: {d.blockers}</span>}
                  {d.notes && <span className="muted small">{d.notes}</span>}
                  {!d.blockers && !d.notes && <span className="muted small">–</span>}
                </span>
                <span className="right history-edit">
                  <button className="ghost small-btn" tabIndex={0}>
                    Edit
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
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

function CheckInCard({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const { data, saveDay } = useStore()
  const existing = data.days.find((d) => d.date === date)
  const [form, setForm] = useState<DayEntry>(existing ?? blank(date))
  const [showNotes, setShowNotes] = useState(!!(existing?.notes || existing?.blockers))
  const [saved, setSaved] = useState(false)
  const t = today()
  const set = (patch: Partial<DayEntry>) => {
    setForm((f) => ({ ...f, ...patch }))
    setSaved(false)
  }

  return (
    <section className="card checkin">
      <div className="card-head">
        <h2>{date === t ? 'How did today go?' : `Check-in for ${dayLabel(date)}`}</h2>
        {existing && <span className="badge good">Logged</span>}
      </div>

      <div className="day-picker" role="group" aria-label="Day">
        <button type="button" className={date === t ? 'chip active' : 'chip'} onClick={() => setDate(t)}>
          Today
        </button>
        <button type="button" className={date === addDays(t, -1) ? 'chip active' : 'chip'} onClick={() => setDate(addDays(t, -1))}>
          Yesterday
        </button>
        <label className="chip date-chip">
          <Icon name="checkin" size={14} />
          <input id="checkin-date" type="date" value={date} max={t} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Pick a day" />
        </label>
      </div>

      <div className="checkin-grid">
        <div className="checkin-block">
          <span className="checkin-label">Hours worked</span>
          <Stepper id="checkin-hours" label="Hours worked" value={form.hours} onChange={(v) => set({ hours: Math.min(24, v) })} step={0.5} unit="hours" />
          <div className="chips">
            {HOUR_PICKS.map((h) => (
              <button key={h} type="button" className={form.hours === h ? 'chip active' : 'chip'} onClick={() => set({ hours: h })}>
                {h}h
              </button>
            ))}
          </div>
        </div>
        <div className="checkin-block">
          <span className="checkin-label">People you reached out to</span>
          <Stepper id="checkin-outreach" label="People contacted" value={form.outreach} onChange={(v) => set({ outreach: Math.round(v) })} step={1} unit="people" />
          <p className="muted small">Clients, leads, editors, anyone you messaged about work.</p>
        </div>
      </div>

      {showNotes ? (
        <div className="checkin-notes">
          <label className="field">
            <span>Anything blocking you? (optional)</span>
            <input id="checkin-blockers" value={form.blockers} onChange={(e) => set({ blockers: e.target.value })} placeholder="e.g. Waiting for client files" />
          </label>
          <label className="field">
            <span>Notes (optional)</span>
            <textarea id="checkin-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="What did you finish? What's next?" />
          </label>
        </div>
      ) : (
        <button type="button" className="link add-note" onClick={() => setShowNotes(true)}>
          + Add a note or blocker
        </button>
      )}

      <div className="actions">
        <span className="grow muted small" role="status">
          {saved ? 'Saved.' : existing ? 'You already logged this day. Changes replace it.' : ''}
        </span>
        <button
          type="button"
          className="primary"
          onClick={() => {
            saveDay({ ...form, date })
            setSaved(true)
          }}
        >
          <Icon name="check" size={18} /> {existing ? 'Update check-in' : 'Save check-in'}
        </button>
      </div>
    </section>
  )
}
