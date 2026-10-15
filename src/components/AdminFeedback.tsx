import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { Badge } from './ui'
import { Icon } from './Icon'

// Owner-only inbox of feedback. Replies are emailed to the person from
// Freelance Tracker; if they answer, it lands in support@ (your Gmail).

export interface FeedbackItem {
  id: string
  email: string
  name: string
  kind: 'bug' | 'idea' | 'question' | 'other'
  message: string
  status: 'new' | 'replied' | 'closed'
  reply: string | null
  replied_at: string | null
  created_at: string
}

const KIND: Record<FeedbackItem['kind'], { label: string; tone: 'bad' | 'info' | 'warn' | 'muted' }> = {
  bug: { label: 'Bug', tone: 'bad' },
  idea: { label: 'Idea', tone: 'info' },
  question: { label: 'Question', tone: 'warn' },
  other: { label: 'Other', tone: 'muted' },
}

async function call<T>(body: Record<string, unknown>): Promise<{ data?: T; error?: string }> {
  const { data, error } = await supabase.functions.invoke('app-actions', { body })
  if (!error) return { data: data as T }
  try {
    const b = await (error as { context?: Response }).context?.json?.()
    return { error: b?.error ?? error.message }
  } catch {
    return { error: error.message }
  }
}

function when(ts: string): string {
  const d = new Date(ts)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 60) return mins < 2 ? 'Just now' : `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

export function useFeedbackInbox() {
  const [items, setItems] = useState<FeedbackItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const r = await call<{ items: FeedbackItem[] }>({ action: 'feedback_list' })
    if (r.error) setError(r.error)
    else {
      setItems(r.data?.items ?? [])
      setError(null)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  return { items, error, load, setItems }
}

export function AdminFeedback({ inbox }: { inbox: ReturnType<typeof useFeedbackInbox> }) {
  const { items, error, load, setItems } = inbox
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  const rows = useMemo(() => (items ?? []).filter((f) => (filter === 'open' ? f.status === 'new' : true)), [items, filter])

  if (error) {
    return (
      <div className="notice bad" role="alert">
        Couldn't load feedback: {error} <button className="link" onClick={load}>Try again</button>
      </div>
    )
  }
  if (!items) return <p className="muted">Loading feedback…</p>

  const patch = (id: string, p: Partial<FeedbackItem>) => setItems((xs) => (xs ?? []).map((x) => (x.id === id ? { ...x, ...p } : x)))

  const sendReply = async (f: FeedbackItem) => {
    if (!draft.trim()) return
    setBusy(true)
    setMsg(null)
    const r = await call<{ ok: boolean }>({ action: 'feedback_reply', id: f.id, reply: draft.trim() })
    setBusy(false)
    if (r.error) {
      setMsg({ tone: 'bad', text: r.error })
      return
    }
    patch(f.id, { status: 'replied', reply: draft.trim(), replied_at: new Date().toISOString() })
    setDraft('')
    setOpenId(null)
    setMsg({ tone: 'good', text: `Reply emailed to ${f.email}.` })
  }

  const setStatus = async (f: FeedbackItem, status: FeedbackItem['status']) => {
    const r = await call<{ ok: boolean }>({ action: 'feedback_status', id: f.id, status })
    if (r.error) setMsg({ tone: 'bad', text: r.error })
    else patch(f.id, { status })
  }

  const newCount = items.filter((f) => f.status === 'new').length

  return (
    <section className="card">
      <div className="card-head">
        <h2>Feedback</h2>
        <div className="segmented" role="group" aria-label="Show feedback">
          <button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Needs reply ({newCount})</button>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All ({items.length})</button>
        </div>
      </div>
      {msg && <p className={`notice ${msg.tone}`} role="status">{msg.text}</p>}
      {rows.length === 0 ? (
        <p className="muted small">{filter === 'open' ? 'All caught up. No feedback waiting for a reply.' : 'No feedback yet.'}</p>
      ) : (
        <ul className="feedback-list">
          {rows.map((f) => (
            <li key={f.id} className={`fb-item ${f.status}`}>
              <div className="fb-top">
                <Badge tone={KIND[f.kind].tone}>{KIND[f.kind].label}</Badge>
                <strong className="ellipsis">{f.name || f.email.split('@')[0]}</strong>
                <span className="muted small ellipsis selectable">{f.email}</span>
                <span className="grow" />
                <span className="muted small">{when(f.created_at)}</span>
              </div>
              <p className="fb-message selectable">{f.message}</p>
              {f.reply && (
                <div className="fb-reply">
                  <span className="muted small">You replied {f.replied_at ? when(f.replied_at) : ''}</span>
                  <p className="selectable">{f.reply}</p>
                </div>
              )}
              {openId === f.id ? (
                <div className="fb-compose">
                  <textarea
                    id={`reply-${f.id}`}
                    rows={5}
                    maxLength={8000}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Write to ${f.name || f.email}. It's emailed from Freelance Tracker, and their answer comes to support@.`}
                  />
                  <div className="actions">
                    <button className="ghost" onClick={() => { setOpenId(null); setDraft('') }} disabled={busy}>Cancel</button>
                    <span className="grow" />
                    <button className="primary" onClick={() => sendReply(f)} disabled={busy || !draft.trim()}>
                      <Icon name="send" size={16} /> {busy ? 'Sending…' : 'Send reply by email'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="actions">
                  <button className="ghost bordered" onClick={() => { setOpenId(f.id); setDraft(''); setMsg(null) }}>
                    {f.reply ? 'Reply again' : 'Reply'}
                  </button>
                  {f.status !== 'closed' ? (
                    <button className="ghost" onClick={() => setStatus(f, 'closed')}>Mark done</button>
                  ) : (
                    <button className="ghost" onClick={() => setStatus(f, 'new')}>Reopen</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
