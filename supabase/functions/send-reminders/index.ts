// Hourly job (called by pg_cron). Asks the database who needs an email right
// now, sends them through Resend, and records what went out so nothing repeats.
//
// Body: { token: string, dry_run?: boolean }
// - token must match the vault secret "reminders_cron_token".
// - dry_run returns the emails it would send without sending or logging them.

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

interface OrderDue { title: string; client: string; due: string; days_late: number }
interface Item {
  user_id: string
  email: string
  name: string
  today: string
  unsub_token: string
  welcome: boolean
  checkin: { streak: number } | null
  goal: { month: string; month_name: string; last_call: boolean } | null
  orders: OrderDue[] | null
}
interface Mail { to: string; subject: string; html: string; text: string; kinds: string[]; user_id: string; day: string; unsub: string }

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SECRET_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`)
  const t = await res.text()
  return (t ? JSON.parse(t) : null) as T
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? ''
const shortDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function layout(title: string, bodyHtml: string, button: { label: string; url: string }, unsubUrl: string, footerNote: string): string {
  return `<div style="margin:0;padding:24px 12px;background:#f4f5f2;font-family:Arial,Helvetica,sans-serif;color:#17201b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e3e6e1">
    <tr><td style="padding:28px 28px 8px"><div style="font-size:18px;font-weight:bold;color:#12715b">Freelance Tracker</div></td></tr>
    <tr><td style="padding:8px 28px 0">
      <h1 style="font-size:22px;margin:12px 0 12px;color:#17201b">${esc(title)}</h1>
      ${bodyHtml}
      <p style="margin:8px 0 24px"><a href="${button.url}" style="display:inline-block;background:#12715b;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:8px">${esc(button.label)}</a></p>
    </td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #e3e6e1">
      <p style="font-size:12px;line-height:1.6;margin:0;color:#8a958e">${footerNote}<br>
      <a href="${APP_URL}" style="color:#8a958e">Choose which emails you get in Settings</a> · <a href="${unsubUrl}" style="color:#8a958e">Unsubscribe from reminders</a></p>
    </td></tr>
  </table>
</div>`
}

const p = (html: string) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px;color:#3d4a43">${html}</p>`
const h2 = (t: string) => `<h2 style="font-size:16px;margin:18px 0 8px;color:#17201b">${esc(t)}</h2>`

function welcomeMail(it: Item): Mail {
  const hi = firstName(it.name) ? `Hi ${esc(firstName(it.name))},` : 'Hi there,'
  const unsub = `${APP_URL}/?unsubscribe=${it.unsub_token}`
  const steps = [
    ['Add your first client and order', 'so you can see what is due and what you are owed.'],
    ['Do your first daily check-in', 'a quick note of what you worked on today. Do it daily to build a streak.'],
    ['Set your monthly goal', 'pick an income target and watch your progress all month.'],
  ]
  const body =
    p(`${hi} welcome to Freelance Tracker. Your account is ready.`) +
    p('Three quick steps to get started:') +
    `<ol style="font-size:15px;line-height:1.6;margin:0 0 14px;padding-left:20px;color:#3d4a43">${steps.map(([a, b]) => `<li style="margin-bottom:6px"><strong>${a}</strong>, ${b}</li>`).join('')}</ol>` +
    p('Your records are private to your account. Only you can see them.')
  const text = `${hi.replace(',', '')}, welcome to Freelance Tracker.\n\n1. Add your first client and order\n2. Do your first daily check-in\n3. Set your monthly goal\n\nOpen the app: ${APP_URL}\n\nUnsubscribe from reminders: ${unsub}`
  return {
    to: it.email,
    subject: firstName(it.name) ? `Welcome to Freelance Tracker, ${firstName(it.name)}` : 'Welcome to Freelance Tracker',
    html: layout('Welcome aboard', body, { label: 'Open Freelance Tracker', url: APP_URL }, unsub, 'You got this email because you created a Freelance Tracker account.'),
    text,
    kinds: ['welcome'],
    user_id: it.user_id,
    day: it.today,
    unsub,
  }
}

function eveningMail(it: Item): Mail | null {
  const parts: string[] = []
  const textParts: string[] = []
  const kinds: string[] = []
  const subjects: string[] = []
  const unsub = `${APP_URL}/?unsubscribe=${it.unsub_token}`
  const hi = firstName(it.name) ? `Hi ${esc(firstName(it.name))},` : 'Hi there,'

  if (it.orders?.length) {
    kinds.push('orders')
    const lines = it.orders.map((o) => {
      const who = o.client ? ` for ${esc(o.client)}` : ''
      const when = o.days_late > 0
        ? `<span style="color:#b42318">${o.days_late} ${o.days_late === 1 ? 'day' : 'days'} late</span> (was due ${shortDate(o.due)})`
        : `due tomorrow, ${shortDate(o.due)}`
      return `<li style="margin-bottom:6px"><strong>${esc(o.title)}</strong>${who}: ${when}</li>`
    })
    parts.push(h2(it.orders.length === 1 ? 'An order needs attention' : `${it.orders.length} orders need attention`) +
      `<ul style="font-size:15px;line-height:1.6;margin:0 0 14px;padding-left:20px;color:#3d4a43">${lines.join('')}</ul>`)
    textParts.push('Orders:\n' + it.orders.map((o) => `- ${o.title}${o.client ? ` for ${o.client}` : ''}: ${o.days_late > 0 ? `${o.days_late} days late` : 'due tomorrow'}`).join('\n'))
    const late = it.orders.some((o) => o.days_late > 0)
    subjects.push(late ? (it.orders.length === 1 ? `"${it.orders[0].title}" is late` : `${it.orders.length} orders need attention`)
      : (it.orders.length === 1 ? `"${it.orders[0].title}" is due tomorrow` : `${it.orders.length} orders due tomorrow`))
  }

  if (it.checkin) {
    kinds.push('checkin')
    const s = Number(it.checkin.streak) || 0
    const line = s > 0
      ? `You haven't checked in today. Check in before midnight to keep your <strong>${s}-day streak</strong> going.`
      : "You haven't checked in today. A quick note of what you worked on keeps you consistent."
    parts.push(h2('Daily check-in') + p(line))
    textParts.push(s > 0 ? `You haven't checked in today. Keep your ${s}-day streak going.` : "You haven't checked in today.")
    subjects.push(s > 0 ? `Keep your ${s}-day streak going` : "Don't forget to check in today")
  }

  if (it.goal) {
    kinds.push('goal')
    const line = it.goal.last_call
      ? `You haven't set a goal for <strong>${esc(it.goal.month_name)}</strong> yet. Goal setting closes on ${esc(it.goal.month_name)} 5.`
      : `Goal setting for <strong>${esc(it.goal.month_name)}</strong> is open now until ${esc(it.goal.month_name)} 5. Pick an income target to aim for.`
    parts.push(h2(`Set your ${it.goal.month_name} goal`) + p(line))
    textParts.push(`Set your ${it.goal.month_name} income goal (open until ${it.goal.month_name} 5).`)
    subjects.push(`Set your ${it.goal.month_name} goal`)
  }

  if (!kinds.length) return null
  const subject = subjects.length > 1 ? `${subjects[0]}, and more` : subjects[0]
  const title = kinds.length === 1 && kinds[0] === 'checkin' ? 'Time to check in' : 'Your reminders for today'
  const button = kinds.includes('checkin') ? 'Check in now' : kinds.includes('orders') ? 'Open my orders' : 'Set my goal'
  const body = p(hi) + parts.join('')
  return {
    to: it.email,
    subject,
    html: layout(title, body, { label: button, url: APP_URL }, unsub, 'You get these reminders because they are on in your Freelance Tracker settings.'),
    text: `${hi}\n\n${textParts.join('\n\n')}\n\nOpen the app: ${APP_URL}\n\nUnsubscribe from reminders: ${unsub}`,
    kinds,
    user_id: it.user_id,
    day: it.today,
    unsub,
  }
}

async function send(m: Mail): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      headers: { 'List-Unsubscribe': `<${m.unsub}>` },
    }),
  })
  if (res.ok) return { ok: true }
  return { ok: false, error: `${res.status} ${await res.text()}` }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  let body: { token?: string; dry_run?: boolean } = {}
  try { body = await req.json() } catch { /* empty */ }

  const ok = await rpc<boolean>('reminder_token_ok', { p_token: body.token ?? '' }).catch(() => false)
  if (!ok) return new Response('Not allowed', { status: 401 })

  const items = await rpc<Item[]>('reminder_queue', {})
  const mails: Mail[] = []
  for (const it of items ?? []) {
    if (it.welcome) mails.push(welcomeMail(it))
    const e = eveningMail(it)
    if (e) mails.push(e)
  }

  if (body.dry_run) {
    return Response.json({ dry_run: true, count: mails.length, mails: mails.map(({ to, subject, kinds, html }) => ({ to, subject, kinds, html })) })
  }
  if (!RESEND_API_KEY) return Response.json({ error: 'RESEND_API_KEY is not set' }, { status: 500 })

  const results: { to: string; kinds: string[]; ok: boolean; error?: string }[] = []
  for (const m of mails) {
    const r = await send(m)
    if (r.ok) await rpc('reminder_mark_sent', { p_user_id: m.user_id, p_kinds: m.kinds, p_day: m.day })
    results.push({ to: m.to.replace(/^(.).*(@.*)$/, '$1***$2'), kinds: m.kinds, ...r })
    await sleep(600) // stay under Resend's rate limit
  }
  console.log(JSON.stringify({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) }))
  return Response.json({ count: results.length, results })
})
