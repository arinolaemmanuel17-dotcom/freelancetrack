// Signed-in actions that need server powers. Called from the app with the
// user's session token. Body: { action: string, ...fields }
//
//   feedback_submit  { kind, message }        any signed-in user
//   feedback_list    {}                       app owner only
//   feedback_reply   { id, reply }            app owner only (emails the user)
//   feedback_status  { id, status }           app owner only
//   delete_account   { confirm: 'DELETE' }    any signed-in user, deletes themselves

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SECRET_KEY = (() => {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    if (keys.default) return keys.default as string
  } catch { /* fall through */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
})()
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const APP_URL = 'https://freelancetracker.app'
const FROM = 'Freelance Tracker <hello@freelancetracker.app>'
const SUPPORT = 'support@freelancetracker.app'
const ORIGINS = ['https://freelancetracker.app', 'https://www.freelancetracker.app', 'https://freelancetrack.pages.dev', 'http://localhost:5173', 'http://localhost:4175']
const KINDS = ['bug', 'idea', 'question', 'other']
const KIND_LABEL: Record<string, string> = { bug: 'Bug', idea: 'Idea', question: 'Question', other: 'Other' }

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.freelancetrack\.pages\.dev$/.test(origin)
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const svc = { apikey: SECRET_KEY }

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...svc, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await rest(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) })
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

interface User { id: string; email?: string; user_metadata?: { full_name?: string } }

async function currentUser(req: Request): Promise<User | null> {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) return null
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SECRET_KEY, Authorization: auth } })
  if (!res.ok) return null
  return (await res.json()) as User
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const paras = (s: string) => esc(s).split(/\n{2,}/).map((x) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px;color:#3d4a43">${x.replace(/\n/g, '<br>')}</p>`).join('')

function shell(title: string, inner: string): string {
  return `<div style="margin:0;padding:24px 12px;background:#f4f5f2;font-family:Arial,Helvetica,sans-serif;color:#17201b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e3e6e1">
    <tr><td style="padding:28px 28px 8px"><div style="font-size:18px;font-weight:bold;color:#12715b">Freelance Tracker</div></td></tr>
    <tr><td style="padding:8px 28px 24px"><h1 style="font-size:22px;margin:12px 0 14px;color:#17201b">${esc(title)}</h1>${inner}</td></tr>
  </table>
</div>`
}

async function sendEmail(payload: Record<string, unknown>): Promise<string | null> {
  if (!RESEND_API_KEY) return 'Email is not set up yet (RESEND_API_KEY missing).'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, ...payload }),
  })
  return res.ok ? null : `Email failed: ${res.status} ${await res.text()}`
}

Deno.serve(async (req: Request) => {
  const headers = cors(req)
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const user = await currentUser(req)
  if (!user) return json({ error: 'Please sign in again.' }, 401)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty */ }
  const action = String(body.action ?? '')

  try {
    // ---------- Feedback from any user ----------
    if (action === 'feedback_submit') {
      const kind = String(body.kind ?? '')
      const message = String(body.message ?? '').trim()
      if (!KINDS.includes(kind)) return json({ error: 'Pick a type of feedback.' }, 400)
      if (!message || message.length > 4000) return json({ error: 'Write a message (up to 4,000 characters).' }, 400)

      // At most 5 messages an hour per person.
      const since = new Date(Date.now() - 3600_000).toISOString()
      const recent = await rest(`/rest/v1/feedback?select=id&user_id=eq.${user.id}&created_at=gte.${since}`, { headers: { Prefer: 'count=exact' } })
      const count = Number(recent.headers.get('content-range')?.split('/')[1] ?? '0')
      if (count >= 5) return json({ error: "You've sent a lot of feedback in the last hour. Please try again later." }, 429)

      const name = (user.user_metadata?.full_name ?? '').trim()
      const ins = await rest('/rest/v1/feedback', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: user.id, email: user.email, name, kind, message }),
      })
      if (!ins.ok) throw new Error(`save feedback: ${ins.status} ${await ins.text()}`)

      // Let the owner know. Replying to this email goes straight to the user.
      const admins = await rpc<string[]>('service_admin_emails', {})
      if (admins.length) {
        await sendEmail({
          to: admins,
          reply_to: user.email,
          subject: `New ${KIND_LABEL[kind].toLowerCase()} from ${name || user.email}`,
          html: shell(`New ${KIND_LABEL[kind].toLowerCase()}`, `<p style="font-size:14px;color:#6b776f;margin:0 0 12px">From ${esc(name || '')} &lt;${esc(user.email ?? '')}&gt;</p>${paras(message)}<p style="margin:18px 0 0"><a href="${APP_URL}" style="display:inline-block;background:#12715b;color:#fff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px">Reply from the Admin page</a></p>`),
          text: `From ${name} <${user.email}>\n\n${message}\n\nReply from the Admin page: ${APP_URL}`,
        })
      }
      return json({ ok: true })
    }

    // ---------- Delete my account ----------
    if (action === 'delete_account') {
      if (body.confirm !== 'DELETE') return json({ error: 'Type DELETE to confirm.' }, 400)
      const files = await rpc<string[]>('service_user_files', { p_user: user.id })
      for (let i = 0; i < files.length; i += 100) {
        const r = await rest('/storage/v1/object/client-files', { method: 'DELETE', body: JSON.stringify({ prefixes: files.slice(i, i + 100) }) })
        if (!r.ok) throw new Error(`delete files: ${r.status} ${await r.text()}`)
      }
      const del = await rest(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE' })
      if (!del.ok) throw new Error(`delete user: ${del.status} ${await del.text()}`)
      return json({ ok: true, files: files.length })
    }

    // ---------- Owner only ----------
    if (!['feedback_list', 'feedback_reply', 'feedback_status'].includes(action)) return json({ error: 'Unknown action' }, 400)
    const isAdmin = await rpc<boolean>('service_is_admin', { p_user: user.id })
    if (!isAdmin) return json({ error: 'Not allowed' }, 403)

    if (action === 'feedback_list') {
      const r = await rest('/rest/v1/feedback?select=id,email,name,kind,message,status,reply,replied_at,created_at,user_id&order=created_at.desc&limit=200')
      if (!r.ok) throw new Error(`list: ${r.status} ${await r.text()}`)
      return json({ items: await r.json() })
    }

    const id = String(body.id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Bad id' }, 400)
    const one = await rest(`/rest/v1/feedback?select=*&id=eq.${id}`)
    const [fb] = (await one.json()) as { email: string; name: string; message: string; kind: string }[]
    if (!fb) return json({ error: 'Feedback not found' }, 404)

    if (action === 'feedback_status') {
      const status = String(body.status ?? '')
      if (!['new', 'replied', 'closed'].includes(status)) return json({ error: 'Bad status' }, 400)
      const u = await rest(`/rest/v1/feedback?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      if (!u.ok) throw new Error(`status: ${u.status}`)
      return json({ ok: true })
    }

    // feedback_reply: email the user from Freelance Tracker; their reply comes to support@.
    const reply = String(body.reply ?? '').trim()
    if (!reply || reply.length > 8000) return json({ error: 'Write a reply (up to 8,000 characters).' }, 400)
    const first = (fb.name ?? '').trim().split(/\s+/)[0]
    const quoted = `<div style="border-left:3px solid #e3e6e1;padding:4px 0 4px 12px;margin:18px 0 0;color:#6b776f;font-size:14px"><div style="margin-bottom:6px">You wrote:</div>${esc(fb.message).replace(/\n/g, '<br>')}</div>`
    const err = await sendEmail({
      to: [fb.email],
      reply_to: SUPPORT,
      subject: 'Re: your feedback on Freelance Tracker',
      html: shell('Reply to your feedback', `${paras(`Hi ${first || 'there'},`)}${paras(reply)}${quoted}<p style="font-size:13px;color:#8a958e;margin:18px 0 0">Just reply to this email if you want to say more.</p>`),
      text: `Hi ${first || 'there'},\n\n${reply}\n\n---\nYou wrote:\n${fb.message}\n\nJust reply to this email if you want to say more.`,
    })
    if (err) return json({ error: err }, 502)
    const u = await rest(`/rest/v1/feedback?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'replied', reply, replied_at: new Date().toISOString() }) })
    if (!u.ok) throw new Error(`save reply: ${u.status}`)
    return json({ ok: true })
  } catch (e) {
    console.error(action, (e as Error).message)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
