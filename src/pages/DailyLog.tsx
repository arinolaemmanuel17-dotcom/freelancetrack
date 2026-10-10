import { useMemo, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Empty, Field } from '../components/ui'
import type { DayEntry } from '../types'
import { addDays, today } from '../utils'

const blank = (date: string): DayEntry => ({ date, hours: 0, outreach: 0, blockers: '', notes: '' })

export function DailyLog() {
  const { data } = useStore()
  const [date, setDate] = useState(today())
  const recent = useMemo(
    () => [...data.days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
    [data.days],
  )

  return (
    <div className="page">
      <h1>Daily check-in</h1>
      <div className="card">
        <div className="field">
          <span>Date</span>
          <div className="row">
            <button type="button" className="ghost" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
              ‹
            </button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button type="button" className="ghost" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
              ›
            </button>
          </div>
        </div>
        <CheckInForm key={date} date={date} />
      </div>

      <h2>Recent days</h2>
      {recent.length === 0 ? (
        <Empty>No check-ins yet.</Empty>
      ) : (
        <ul className="list">
          {recent.map((d) => (
            <li key={d.date} className="row">
              <button className="link grow left" onClick={() => setDate(d.date)}>
                {d.date}
              </button>
              <span className="small">{d.hours} h</span>
              <span className="small">{d.outreach} contacted</span>
              <span className="muted small grow">{d.blockers}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CheckInForm({ date }: { date: string }) {
  const { data, saveDay } = useStore()
  const existing = data.days.find((d) => d.date === date)
  const [form, setForm] = useState<DayEntry>(existing ?? blank(date))
  const [saved, setSaved] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    saveDay(form)
    setSaved(true)
  }

  return (
    <>
      <form onSubmit={submit} className="form">
        <Field label="Date" wide>
          <input type="date" value={date} readOnly />
        </Field>
          <Field label="Hours worked">
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })}
            />
          </Field>
          <Field label="Clients contacted">
            <input
              type="number"
              min="0"
              step="1"
              value={form.outreach}
              onChange={(e) => setForm({ ...form, outreach: Number(e.target.value) })}
            />
          </Field>
          <Field label="Blockers" wide>
            <input value={form.blockers} onChange={(e) => setForm({ ...form, blockers: e.target.value })} />
          </Field>
          <Field label="Notes" wide>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="actions">
            <span className="grow muted small">{saved ? 'Saved' : existing ? 'Editing an existing day' : ''}</span>
            <button type="submit" className="primary">
              Save check-in
            </button>
          </div>
      </form>
    </>
  )
}
