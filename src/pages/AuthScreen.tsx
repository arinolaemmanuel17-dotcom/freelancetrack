import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { Field } from '../components/ui'
import logo from '../assets/logo-mark.png?inline'

type Mode = 'signin' | 'signup' | 'reset'

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() } },
        })
        if (error) throw error
        if (!data.session) {
          setMessage({ tone: 'good', text: 'Account created. Check your email and click the confirmation link, then sign in here.' })
          setMode('signin')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMessage({ tone: 'good', text: 'If that email has an account, a reset link is on its way.' })
      }
    } catch (err) {
      setMessage({ tone: 'bad', text: friendly((err as Error).message) })
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset your password'

  return (
    <div className="auth">
      <div className="auth-card">
        <Brand />
        <h1>{title}</h1>
        <p className="muted small">
          {mode === 'signup'
            ? 'Track clients, orders and payments in one place. Your records are private to your account.'
            : mode === 'reset'
              ? "Enter your account email and we'll send you a link to set a new password."
              : 'Welcome back.'}
        </p>
        <form className="form one" onSubmit={submit}>
          {mode === 'signup' && (
            <Field label="Your name" wide>
              <input id="auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" maxLength={60} required />
            </Field>
          )}
          <Field label="Email" wide>
            <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          {mode !== 'reset' && (
            <Field label={mode === 'signup' ? 'Password (at least 8 characters)' : 'Password'} wide>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={mode === 'signup' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
          )}
          {message && <p className={`notice ${message.tone}`} role="status">{message.text}</p>}
          <button className="primary wide-btn" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>
        </form>
        <div className="auth-links small">
          {mode !== 'signin' && (
            <button className="link" onClick={() => { setMode('signin'); setMessage(null) }}>
              I already have an account
            </button>
          )}
          {mode !== 'signup' && (
            <button className="link" onClick={() => { setMode('signup'); setMessage(null) }}>
              Create an account
            </button>
          )}
          {mode === 'signin' && (
            <button className="link" onClick={() => { setMode('reset'); setMessage(null) }}>
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(friendly(error.message))
    else onDone()
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <Brand />
        <h1>Set a new password</h1>
        <form className="form one" onSubmit={submit}>
          <Field label="New password (at least 8 characters)" wide>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p className="notice bad" role="alert">{error}</p>}
          <button className="primary wide-btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div className="auth-brand">
      <img src={logo} alt="" />
      <span className="wordmark">
        <span>Freelance</span>
        <span className="accent-word">Tracker</span>
      </span>
    </div>
  )
}

// Turns common auth errors into plain instructions.
function friendly(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'That email and password don’t match. Check them and try again.'
  if (m.includes('email not confirmed')) return 'Confirm your email first. Open the link we sent you, then sign in.'
  if (m.includes('already registered')) return 'An account with this email already exists. Sign in instead.'
  if (m.includes('rate limit')) return 'Too many emails sent in a short time. Wait a while and try again.'
  if (m.includes('not authorized')) return 'Sign-up emails can’t be sent to this address yet. The app’s email service is still being set up.'
  if (m.includes('password')) return msg
  return msg || 'Something went wrong. Try again.'
}
