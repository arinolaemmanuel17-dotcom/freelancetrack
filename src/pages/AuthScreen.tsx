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
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(() => {
    if (new URLSearchParams(window.location.search).get('account_deleted') !== '1') return null
    window.history.replaceState(null, '', '/')
    return { tone: 'good', text: 'Your account and all your data have been deleted. Thanks for trying Freelance Tracker.' }
  })

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
        // Supabase hides existing emails: it "succeeds" but returns no identities and sends nothing.
        if (data.user && data.user.identities?.length === 0) {
          setMessage({ tone: 'bad', text: 'An account with this email already exists. Sign in below, or use "Forgot password?" if you can\'t remember it.' })
          setMode('signin')
        } else if (!data.session) {
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
    <div className="landing">
      <header className="landing-head">
        <Brand />
      </header>
      <main className="landing-grid">
        <section className="landing-copy">
          <h1>Know what you've earned, what you're owed, and what's due.</h1>
          <p className="lede">
            Freelance Tracker keeps your clients, orders, payments and expenses in one place, so month-end takes minutes instead of an afternoon with a spreadsheet.
          </p>
          <ul className="points">
            <li>
              <strong>Every order shows its balance</strong>
              <span>Price, paid, spent and what's still owed, on one screen.</span>
            </li>
            <li>
              <strong>Months close properly</strong>
              <span>Each month locks on the 5th of the next. Later changes are logged with a reason, so your numbers stay trustworthy.</span>
            </li>
            <li>
              <strong>Made for your phone</strong>
              <span>Record a payment in a few taps, in naira, dollars or another currency.</span>
            </li>
          </ul>
          <figure className="peek" aria-label="Example of the Home screen">
            <div className="hero-card">
              <span className="hero-label">Earned in November</span>
              <strong className="hero-value">$1,240</strong>
              <span className="hero-delta">Up 18% on Oct</span>
              <dl className="hero-split">
                <div><dt>Spent</dt><dd>$96</dd></div>
                <div><dt>Profit</dt><dd>$1,144</dd></div>
              </dl>
            </div>
            <div className="peek-row">
              <div className="tile"><span className="tile-label">Owed to you</span><strong className="tile-value">$380</strong><span className="tile-sub">On unfinished work</span></div>
              <div className="tile"><span className="tile-label">Next deadline</span><strong className="tile-value tile-text">Logo pack</strong><span className="tile-sub warn-text">Due tomorrow</span></div>
            </div>
            <figcaption>Example with made-up numbers.</figcaption>
          </figure>
        </section>
            <div className="auth-card">
            <h2 className="auth-title">{title}</h2>
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
              {mode === 'signup' && (
                <p className="muted small legal-note">
                  By creating an account you agree to our <a href="/terms" target="_blank" rel="noopener">Terms of Use</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
                </p>
              )}
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
      </main>
      <footer className="landing-foot">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </footer>
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
