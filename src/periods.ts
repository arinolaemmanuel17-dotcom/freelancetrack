// The money and month rules (see the "money-rules" project doc, approved 15 Nov 2026).
// Everything here is plain logic with no screen or database code, so it can be tested
// on its own. Dates are 'YYYY-MM-DD' strings and months are 'YYYY-MM' strings.

export const CLOSE_DAY = 5 // a month stays open through the 5th of the next month

export type Verdict = { ok: true } | { ok: false; reason: string }
const yes: Verdict = { ok: true }
const no = (reason: string): Verdict => ({ ok: false, reason })

export function isDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

// Today's date in a given time zone (e.g. 'Africa/Lagos'), whatever the device clock's zone is.
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// The last day a month can still be changed: the 5th of the month after it.
export function closesOn(month: string): string {
  return `${nextMonth(month)}-${String(CLOSE_DAY).padStart(2, '0')}`
}

// Months that can be changed today, oldest first. Two from the 1st to the 5th, otherwise one.
export function openMonths(today: string): string[] {
  const current = monthOf(today)
  return Number(today.slice(8, 10)) <= CLOSE_DAY ? [prevMonth(current), current] : [current]
}

export function isMonthOpen(month: string, today: string): boolean {
  return openMonths(today).includes(month)
}

// A month that has ended and passed its 5th. Future months are neither open nor closed.
export function isMonthClosed(month: string, today: string): boolean {
  return month < openMonths(today)[0]
}

// The earliest date a money record can carry today.
export function earliestOpenDate(today: string): string {
  return `${openMonths(today)[0]}-01`
}

// ---------- which month a record belongs to ----------

export function orderMonth(order: { startDate: string | null; createdAt: string }): string {
  return monthOf(order.startDate ?? order.createdAt.slice(0, 10))
}

export function deliveredMonth(order: { status: string; completedAt: string | null }): string | null {
  return order.status === 'Completed' && order.completedAt ? monthOf(order.completedAt) : null
}

// ---------- what can be added or changed ----------

// A payment, expense or refund: its date must be in an open month and not in the future.
export function canAddMoney(date: string, today: string): Verdict {
  if (!isDate(date)) return no('Pick a real date.')
  if (date > today) return no("Money can't be dated in the future.")
  if (date < earliestOpenDate(today)) return no(`${monthOf(date)} is closed. It closed after ${closesOn(monthOf(date))}.`)
  return yes
}

// Editing or deleting a money record: the record's current month must be open,
// and so must the month it is being moved to.
export function canChangeMoney(currentDate: string, newDate: string | null, today: string): Verdict {
  if (isMonthClosed(monthOf(currentDate), today)) return no(`${monthOf(currentDate)} is closed. Use "Correct a closed month".`)
  return newDate === null || newDate === currentDate ? yes : canAddMoney(newDate, today)
}

// A new order's start date must sit in an open month.
export function canStartOrder(startDate: string, today: string): Verdict {
  if (!isDate(startDate)) return no('Pick a real date.')
  const m = monthOf(startDate)
  if (isMonthClosed(m, today)) return no(`${m} is closed, so an order can't be added to it.`)
  if (m > monthOf(today)) return no('An order can start this month at the latest.')
  return yes
}

// Changing a start date must not move an order into or out of a closed month.
export function canMoveOrderStart(oldStart: string, newStart: string, today: string): Verdict {
  if (oldStart === newStart) return yes
  if (isMonthClosed(monthOf(oldStart), today)) {
    return monthOf(newStart) === monthOf(oldStart) ? yes : no(`This order belongs to ${monthOf(oldStart)}, which is closed.`)
  }
  return canStartOrder(newStart, today)
}

export function canSetDue(startDate: string | null, dueDate: string): Verdict {
  if (!isDate(dueDate)) return no('Pick a real date.')
  return startDate && dueDate < startDate ? no("The due date can't be before the start date.") : yes
}

// Completing an order: on or after its start, not in the future, and in an open month.
export function canComplete(startDate: string | null, completedAt: string, today: string): Verdict {
  if (!isDate(completedAt)) return no('Pick a real date.')
  if (completedAt > today) return no("An order can't be completed in the future.")
  if (startDate && completedAt < startDate) return no("An order can't be completed before it started.")
  if (isMonthClosed(monthOf(completedAt), today)) return no(`${monthOf(completedAt)} is closed.`)
  return yes
}

// The price can change until the order is completed.
export function canChangePrice(status: string): Verdict {
  return status === 'Completed' ? no('This order is completed. Use "Correct a closed month" to change its price.') : yes
}

// Shown on the payment form when the money lands in a different month from the order.
export function paymentMonthNote(order: { startDate: string | null; createdAt: string }, paymentDate: string): string | null {
  const om = orderMonth(order)
  const pm = monthOf(paymentDate)
  return om === pm ? null : `This order is from ${om}. This payment counts in ${pm}, the day the money arrived.`
}

// ---------- part payments, fees and refunds ----------

export interface MoneyLine {
  kind: 'payment' | 'refund'
  amount: number // always positive
  date: string
}

const cents = (n: number) => Math.round(n * 100)

// What actually arrived: payments minus refunds. Worked out in cents so it stays exact.
export function netReceived(lines: MoneyLine[]): number {
  return lines.reduce((s, l) => s + (l.kind === 'refund' ? -cents(l.amount) : cents(l.amount)), 0) / 100
}

// Money in for one month. A refund counts against the month it was refunded in.
export function receivedInMonth(lines: MoneyLine[], month: string): number {
  return netReceived(lines.filter((l) => monthOf(l.date) === month))
}

export function feeOn(price: number, feePercent: number): number {
  return Math.round(cents(price) * (feePercent / 100)) / 100
}

// Owed = price, minus the platform fee, minus what has arrived. Never below zero.
export function owed(price: number, feePercent: number, lines: MoneyLine[]): number {
  return Math.max(0, cents(price) - cents(feeOn(price, feePercent)) - cents(netReceived(lines))) / 100
}

// ---------- corrections to a closed month ----------

export interface Correction {
  field: string
  oldValue: string
  newValue: string
  reason: string
  at: string // ISO time
}

// A correction is only valid with a real reason and an actual change.
export function makeCorrection(field: string, oldValue: string, newValue: string, reason: string, at: string): Correction | null {
  const r = reason.trim()
  if (r.length < 3 || oldValue === newValue) return null
  return { field, oldValue, newValue, reason: r, at }
}
