import { useState } from 'react'
import { supabase } from '../supabase'

// Permanently deletes the signed-in account: records, files and login.
export function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.functions.invoke('app-actions', { body: { action: 'delete_account', confirm: 'DELETE' } })
    if (error || !data?.ok) {
      setBusy(false)
      setError("Couldn't delete your account. Please try again, or email support@freelancetracker.app.")
      return
    }
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    window.location.replace('/?account_deleted=1')
  }

  if (!open) {
    return (
      <>
        <p className="muted small">Permanently delete your account, all your records and uploaded files. Download your data first if you want a copy.</p>
        <div className="actions">
          <button className="danger" onClick={() => setOpen(true)}>Delete my account…</button>
        </div>
      </>
    )
  }

  return (
    <div className="delete-confirm">
      <p>
        This deletes <strong>everything</strong>: your clients, orders, payments, expenses, check-ins, goals and files. It cannot be undone.
      </p>
      <label className="field">
        <span>Type DELETE to confirm</span>
        <input id="delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" />
      </label>
      {error && <p className="notice bad" role="alert">{error}</p>}
      <div className="actions">
        <button className="ghost" onClick={() => { setOpen(false); setTyped(''); setError(null) }} disabled={busy}>Cancel</button>
        <span className="grow" />
        <button className="danger solid" onClick={run} disabled={busy || typed.trim() !== 'DELETE'}>
          {busy ? 'Deleting…' : 'Delete everything'}
        </button>
      </div>
    </div>
  )
}
