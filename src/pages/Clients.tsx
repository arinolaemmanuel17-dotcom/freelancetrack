import { useMemo, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Empty, Field, Modal, Badge } from '../components/ui'
import { OPEN_STATUSES, type Client } from '../types'
import { daysBetween, today } from '../utils'

export function Clients({ initialId }: { initialId?: string | null }) {
  const { data, saveClient, deleteClient, markContact } = useStore()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Client | 'new' | null>(() => {
    if (initialId === 'new') return 'new'
    return initialId ? (data.clients.find((c) => c.id === initialId) ?? null) : null
  })

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.clients
      .filter((c) => !q || [c.name, c.contact, c.platform, c.notes].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data.clients, query])

  return (
    <div className="page">
      <div className="page-head">
        <h1>Clients</h1>
        <button className="primary" onClick={() => setEditing('new')}>
          Add client
        </button>
      </div>
      <input className="search-input" placeholder="Filter clients" value={query} onChange={(e) => setQuery(e.target.value)} />

      {rows.length === 0 ? (
        <Empty>No clients yet. Add your first client.</Empty>
      ) : (
        <ul className="list">
          {rows.map((c) => {
            const openCount = data.orders.filter((o) => o.clientId === c.id && OPEN_STATUSES.includes(o.status)).length
            const gap = c.lastContact ? daysBetween(c.lastContact, today()) : null
            return (
              <li key={c.id} className="row">
                <button className="link grow left" onClick={() => setEditing(c)}>
                  <strong>{c.name}</strong>
                  <span className="muted"> {c.platform || ''}</span>
                </button>
                <Badge tone={openCount > 0 ? 'good' : 'muted'}>{openCount} open</Badge>
                <span className="muted small">{gap === null ? 'No contact' : gap === 0 ? 'Contacted today' : `Contacted ${gap}d ago`}</span>
                <button className="ghost" onClick={() => markContact(c.id)}>
                  Log contact
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <ClientForm
          client={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(vals) => {
            saveClient({ ...vals, id: editing === 'new' ? undefined : editing.id })
            setEditing(null)
          }}
          onDelete={
            editing === 'new'
              ? undefined
              : () => {
                  if (window.confirm(`Delete ${editing.name} and all their orders and payments?`)) {
                    deleteClient(editing.id)
                    setEditing(null)
                  }
                }
          }
        />
      )}
    </div>
  )
}

function ClientForm({
  client,
  onClose,
  onSave,
  onDelete,
}: {
  client: Client | null
  onClose: () => void
  onSave: (v: Pick<Client, 'name' | 'contact' | 'platform' | 'notes'>) => void
  onDelete?: () => void
}) {
  const { data } = useStore()
  const [name, setName] = useState(client?.name ?? '')
  const [contact, setContact] = useState(client?.contact ?? '')
  const [platform, setPlatform] = useState(client?.platform ?? '')
  const [notes, setNotes] = useState(client?.notes ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), contact: contact.trim(), platform, notes: notes.trim() })
  }

  return (
    <Modal title={client ? 'Edit client' : 'New client'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Name *" wide>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Contact (email, phone, or handle)" wide>
          <input value={contact} onChange={(e) => setContact(e.target.value)} />
        </Field>
        <Field label="Where they came from">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">-</option>
            {data.settings.platforms.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes" wide>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="actions">
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
