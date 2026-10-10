import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { useStore } from '../store'
import { ConfirmButton } from './ui'
import { Icon } from './Icon'
import * as db from '../db'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp'
const MAX = 10 * 1024 * 1024

function size(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

// Private documents attached to a client or an order (CV, contract, certificate…).
export function FilesCard({ kind, ownerId, hint }: { kind: 'clients' | 'orders'; ownerId: string; hint: string }) {
  const { account, mode } = useStore()
  const prefix = account ? `${account.userId}/${kind}/${ownerId}` : ''
  const [files, setFiles] = useState<db.StoredFile[]>([])
  const [loading, setLoading] = useState(mode === 'cloud')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!prefix) return
    try {
      setFiles(await db.listFiles(prefix))
    } catch (e) {
      setError(`Couldn't load files: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [prefix])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!picked.length) return
    setError('')
    const tooBig = picked.filter((f) => f.size > MAX)
    if (tooBig.length) setError(`${tooBig.map((f) => f.name).join(', ')} is over 10 MB and was skipped.`)
    setBusy(true)
    try {
      for (const f of picked.filter((x) => x.size <= MAX)) await db.uploadFile(prefix, f)
    } catch (err) {
      setError(`Upload failed: ${(err as Error).message}. Allowed: PDF, Word, Excel, text and images up to 10 MB.`)
    }
    setBusy(false)
    void refresh()
  }

  const open = async (path: string) => {
    const w = window.open('', '_blank')
    try {
      const url = await db.fileLink(path)
      if (w) w.location.href = url
      else window.location.href = url
    } catch (e) {
      w?.close()
      setError(`Couldn't open the file: ${(e as Error).message}`)
    }
  }

  const remove = async (path: string) => {
    try {
      await db.deleteFile(path)
      setFiles((fs) => fs.filter((f) => f.path !== path))
    } catch (e) {
      setError(`Couldn't delete the file: ${(e as Error).message}`)
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Files</h2>
        {mode === 'cloud' && (
          <label className={busy ? 'file-btn small-btn disabled' : 'file-btn small-btn'}>
            <Icon name="upload" size={16} /> {busy ? 'Uploading…' : 'Upload'}
            <input id={`upload-${kind}-${ownerId}`} type="file" accept={ACCEPT} multiple onChange={onPick} disabled={busy} />
          </label>
        )}
      </div>
      {mode !== 'cloud' ? (
        <p className="muted small">File uploads work when you're signed in to the full app.</p>
      ) : loading ? (
        <p className="muted small">Loading files…</p>
      ) : files.length === 0 ? (
        <p className="muted small">{hint}</p>
      ) : (
        <ul className="rows">
          {files.map((f) => (
            <li key={f.path}>
              <span className="file-icon" aria-hidden="true">{f.name.split('.').pop()?.toUpperCase().slice(0, 4)}</span>
              <span className="grow">
                <button className="link file-name" onClick={() => void open(f.path)}>
                  {f.name}
                </button>
                <span className="muted small block">
                  {size(f.size)}
                  {f.createdAt ? ` · ${f.createdAt.slice(0, 10)}` : ''}
                </span>
              </span>
              <ConfirmButton label="Delete" question="Delete this file?" onConfirm={() => void remove(f.path)} />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="notice bad" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
