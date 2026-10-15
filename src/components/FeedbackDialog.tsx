import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { useStore } from '../store'
import { Modal } from './ui'
import { Icon } from './Icon'

// Pop-up for sending a bug report, idea or question. Replies arrive by email.

const KINDS = [
  { id: 'bug', label: 'Something is broken' },
  { id: 'idea', label: 'Idea or request' },
  { id: 'question', label: 'Question' },
  { id: 'other', label: 'Other' },
] as const

type Kind = (typeof KINDS)[number]['id']

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { account } = useStore()
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
  }

  return (
    <Modal title={sent ? 'Message sent' : 'Send feedback'} onClose={onClose}>
      {!account ? (
        <p className="muted">Sign in to send feedback.</p>
      ) : sent ? (
        <div className="feedback-sent" role="status">
          <span className="feedback-check" aria-hidden="true"><Icon name="check" size={22} /></span>
          <p><strong>Thanks, we got your message.</strong></p>
          <p className="muted">If you asked something or we need more details, we'll reply by email to <strong>{account.email}</strong>.</p>
          <div className="actions">
            <span className="grow" />
            <button className="primary" onClick={onClose}>Done</button>
          </div>
        </div>
      ) : (
        <form className="form one feedback-form" onSubmit={submit}>
          <p className="muted small">Found a problem or have an idea? We read every message.</p>
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
            <textarea id="feedback-message" rows={6} maxLength={4000} value={message} onChange={(e) => { setMessage(e.target.value); setError(null) }} placeholder={placeholder} autoFocus required />
          </label>
          <p className="muted small">We'll reply to <strong>{account.email}</strong> if needed.{message.length > 3500 && <> {4000 - message.length} characters left.</>}</p>
          {error && <p className="notice bad" role="alert">{error}</p>}
          <div className="actions">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <span className="grow" />
            <button className="primary" type="submit" disabled={busy || !message.trim()}>
              <Icon name="send" size={16} /> {busy ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
