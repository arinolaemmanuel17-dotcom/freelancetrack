import { useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { Modal } from '../components/ui'
import type { DayEntry } from '../types'
import { addDays, checkinStreak, daysBetween, today } from '../utils'

const HOUR_PICKS = [1, 2, 4, 6, 8]

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

// Results of your check-ins. New entries are for today only; past days are kept as a record.
export function DailyLog({ openNew }: { openNew?: boolean }) {
  const { data } = useStore()
  const t = today()
  const todays = data.days.find((d) => d.date === t)
  const [open, setOpen] = useState(!!openNew)

  const streak = checkinStreak(data, t)
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6))
  const byDate = new Map(data.days.map((d) => [d.date, d]))
  const weekHours = week.reduce((s, d) => s + (byDate.get(d)?.hours ?? 0), 0)
  const weekOutreach = week.reduce((s, d) => s + (byDate.get(d)?.outreach ?? 0), 0)
  const maxHours = Math.max(8, ...week.map((d) => byDate.get(d)?.hours ?? 0))
  const history = [...data.days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Check-ins</h1>
          <p className="muted small">A quick daily record of your hours and outreach.</p>
        </div>
        <button className="primary checkin-btn" onClick={() => setOpen(true)}>
          <Icon name="checkin" size={18} /> {todays ? "Edit today's check-in" : 'Check in'}
        </button>
      </div>

      <div className="stats four">
        <div className="stat">
          <span>Streak</span>
          <strong>
            <Icon name="flame" size={18} /> {streak} day{streak === 1 ? '' : 's'}
          </strong>
          <small className="muted">{todays ? 'Checked in today' : 'Check in today to keep it'}</small>
        </div>
        <div className="stat">
          <span>Hours, last 7 days</span>
          <strong>{weekHours}</strong>
          <small className="muted">{week.filter((d) => byDate.has(d)).length} of 7 days logged</small>
        </div>
        <div className="stat">
          <span>People contacted, last 7 days</span>
          <strong>{weekOutreach}</strong>
        </div>
        <div className="stat">
          <span>All check-ins</span>
          <strong>{data.days.length}</strong>
          <small className="muted">{data.days.reduce((s, d) => s + d.hours, 0)} hours in total</small>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Last 7 days</h2>
          <span className="muted small">Hours worked</span>
        </div>
        <div className="week-strip" role="img" aria-label={`Hours worked over the last 7 days, ${weekHours} in total`}>
          {week.map((d) => {
            const e = byDate.get(d)
            const h = e?.hours ?? 0
            return (
              <div key={d} className={d === t ? 'wk-day active' : 'wk-day'}>
                <span className="wk-value num">{e ? `${h}h` : ''}</span>
                <span className="wk-track">
                  <span className={e ? 'wk-bar' : 'wk-bar none'} style={{ height: `${Math.max(e ? 6 : 0, (h / maxHours) * 100)}%` }} />
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
          <span className="muted small">{data.days.length} day(s)</span>
        </div>
        {history.length === 0 ? (
          <div className="chart-empty">
            <p>No check-ins yet. Tap “Check in” to log today.</p>
          </div>
        ) : (
          <div className="table-card flat">
            <div className="trow thead history-grid">
              <span>Day</span>
              <span className="right">Hours</span>
              <span className="right">Contacted</span>
              <span>Notes</span>
            </div>
            {history.map((d) => (
              <div key={d.date} className={d.date === t ? 'trow history-grid selected' : 'trow history-grid'}>
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
              </div>
            ))}
          </div>
        )}
        <p className="muted small">Past check-ins are kept as a record and can't be changed.</p>
      </section>

      {open && <CheckInModal onClose={() => setOpen(false)} />}
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

// Today's check-in. Only today can be added or changed.
export function CheckInModal({ onClose }: { onClose: () => void }) {
  const { data, saveDay } = useStore()
  const t = today()
  const existing = data.days.find((d) => d.date === t)
  const [form, setForm] = useState<DayEntry>(existing ?? { date: t, hours: 0, outreach: 0, blockers: '', notes: '' })
  const [showNotes, setShowNotes] = useState(!!(existing?.notes || existing?.blockers))
  const set = (patch: Partial<DayEntry>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <Modal title={existing ? "Edit today's check-in" : 'How did today go?'} onClose={onClose}>
      <div className="checkin">
        <p className="muted small checkin-date">
          <Icon name="checkin" size={14} /> {niceDate(t, true)}
        </p>
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
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              saveDay({ ...form, date: t })
              onClose()
            }}
          >
            <Icon name="check" size={18} /> {existing ? 'Update' : 'Save check-in'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
