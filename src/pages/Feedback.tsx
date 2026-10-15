import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { useStore } from '../store'
import { Icon } from '../components/Icon'

// Send a bug report, idea or question. Replies arrive by email, not in the app.

const KINDS = [
  { id: 'bug', label: 'Something is broken' },
  { id: 'idea', label: 'Idea or request' },
  { id: 'question', label: 'Question' },
  { id: 'other', label: 'Other' },
] as const

type Kind = (typeof KINDS)[number]['id']

export function Feedback() {
  const { account, mode } = useStore()
  const [kind, setKind] = useState<Kind>('idea')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placeholder =
    kind === 'bug'
      ? 'What happened, and what did you expect? Which page were you on?'
      : kind === 'idea'
        ? 'What would make Freelance Tracker more useful for you?'
        : kind === 'question'
          ? 'What would you like to know?'
          : 'Tell us anything.'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.functions.invoke('app-actions', { body: { action: 'feedback_submit', kind, message: message.trim() } })
    setBusy(false)
    if (error || !data?.ok) {
      let msg = "Couldn't send your message. Please try again."
      try {
        const body = await (error as { context?: Response })?.context?.json?.()
        if (body?.error) msg = body.error
      } catch { /* keep default */ }
      setError(msg)
      return
    }
    setSent(true)
    setMessage('')
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Feedback</h1>
          <p className="muted small">Found a problem or have an idea? We read every message.</p>
        </div>
      </div>

      <section className="card feedback-card">
        {mode !== 'cloud' || !account ? (
          <p className="muted">Sign in to send feedback.</p>
        ) : sent ? (
          <div className="feedback-sent" role="status">
            <span className="feedback-check" aria-hidden="true"><Icon name="check" size={22} /></span>
            <h2>Thanks, we got your message</h2>
            <p className="muted">If you asked something or we need more details, we'll reply by email to <strong>{account.email}</strong>.</p>
            <button className="ghost bordered" onClick={() => setSent(false)}>Send another message</button>
          </div>
        ) : (
          <form className="form one" onSubmit={submit}>
            <fieldset className="kind-picker">
              <legend className="small">What's it about?</legend>
              <div className="chips">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" className={kind === k.id ? 'chip active' : 'chip'} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                    {k.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="field wide">
              <span>Your message</span>
              <textarea id="feedback-message" rows={7} maxLength={4000} value={message} onChange={(e) => { setMessage(e.target.value); setError(null) }} placeholder={placeholder} required />
            </label>
            <p className="muted small">We'll reply to <strong>{account.email}</strong> if needed. {message.length > 3500 && <span>{4000 - message.length} characters left.</span>}</p>
            {error && <p className="notice bad" role="alert">{error}</p>}
            <button className="primary" type="submit" disabled={busy || !message.trim()}>
              <Icon name="send" size={16} /> {busy ? 'Sending…' : 'Send feedback'}
            </button>
          </form>
        )}
      </section>

      <p className="muted small">
        You can also email us at <a href="mailto:support@freelancetracker.app">support@freelancetracker.app</a>.
      </p>
    </div>
  )
}
