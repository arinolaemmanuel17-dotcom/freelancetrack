import { describe, expect, it } from 'vitest'
import * as P from './periods'

const ok = (v: P.Verdict) => v.ok
const order = (startDate: string | null, createdAt = '2026-10-01T09:00:00Z') => ({ startDate, createdAt })

describe('dates and months', () => {
  it('knows real dates, including leap years', () => {
    expect(P.isDate('2028-02-29')).toBe(true)
    expect(P.isDate('2027-02-29')).toBe(false)
    expect(P.isDate('2026-11-31')).toBe(false)
    expect(P.isDate('2026-13-01')).toBe(false)
    expect(P.isDate('15/11/2026')).toBe(false)
  })
  it('steps months across a year end', () => {
    expect(P.nextMonth('2026-12')).toBe('2027-01')
    expect(P.prevMonth('2027-01')).toBe('2026-12')
    expect(P.nextMonth('2028-02')).toBe('2028-03')
  })
  it('closes a month on the 5th of the next month', () => {
    expect(P.closesOn('2026-11')).toBe('2026-12-05')
    expect(P.closesOn('2026-12')).toBe('2027-01-05')
  })
})

describe('open and closed months', () => {
  it('has one open month after the 5th', () => {
    expect(P.openMonths('2026-11-06')).toEqual(['2026-11'])
    expect(P.openMonths('2026-11-30')).toEqual(['2026-11'])
  })
  it('has two open months from the 1st to the 5th', () => {
    expect(P.openMonths('2026-12-01')).toEqual(['2026-11', '2026-12'])
    expect(P.openMonths('2026-12-05')).toEqual(['2026-11', '2026-12'])
    expect(P.openMonths('2027-01-03')).toEqual(['2026-12', '2027-01'])
    expect(P.openMonths('2028-03-01')).toEqual(['2028-02', '2028-03'])
  })
  it('closes last month on the 6th', () => {
    expect(P.isMonthClosed('2026-11', '2026-12-05')).toBe(false)
    expect(P.isMonthClosed('2026-11', '2026-12-06')).toBe(true)
    expect(P.isMonthClosed('2026-10', '2026-11-15')).toBe(true)
  })
  it('treats a future month as neither open nor closed', () => {
    expect(P.isMonthOpen('2026-12', '2026-11-15')).toBe(false)
    expect(P.isMonthClosed('2026-12', '2026-11-15')).toBe(false)
  })
})

describe('time zones', () => {
  it('uses the user\'s own date, not the server\'s', () => {
    const instant = new Date('2026-12-05T23:30:00Z')
    expect(P.todayIn('Africa/Lagos', instant)).toBe('2026-12-06')
    expect(P.todayIn('America/Los_Angeles', instant)).toBe('2026-12-05')
    // At that same moment November is closed in Lagos and still open in Los Angeles.
    expect(P.isMonthClosed('2026-11', P.todayIn('Africa/Lagos', instant))).toBe(true)
    expect(P.isMonthClosed('2026-11', P.todayIn('America/Los_Angeles', instant))).toBe(false)
  })
  it('handles the new year', () => {
    expect(P.todayIn('Africa/Lagos', new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
    expect(P.todayIn('UTC', new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31')
  })
})

describe('which month a record belongs to', () => {
  it('puts an order in the month it started', () => {
    expect(P.orderMonth(order('2026-11-28'))).toBe('2026-11')
    expect(P.orderMonth(order(null, '2026-10-31T22:00:00Z'))).toBe('2026-10')
  })
  it('counts delivery in the month it was completed', () => {
    expect(P.deliveredMonth({ status: 'Completed', completedAt: '2026-12-03' })).toBe('2026-12')
    expect(P.deliveredMonth({ status: 'Active', completedAt: null })).toBeNull()
  })
})

describe('adding money', () => {
  const today = '2026-11-15'
  it('accepts dates in the open month up to today', () => {
    expect(ok(P.canAddMoney('2026-11-15', today))).toBe(true)
    expect(ok(P.canAddMoney('2026-11-01', today))).toBe(true)
  })
  it('refuses a closed month, the future and dates that do not exist', () => {
    expect(ok(P.canAddMoney('2026-10-31', today))).toBe(false)
    expect(ok(P.canAddMoney('2026-11-16', today))).toBe(false)
    expect(ok(P.canAddMoney('2026-11-31', today))).toBe(false)
  })
  it('accepts last month until the 5th, then refuses it', () => {
    expect(ok(P.canAddMoney('2026-11-28', '2026-12-03'))).toBe(true)
    expect(ok(P.canAddMoney('2026-11-30', '2026-12-05'))).toBe(true)
    expect(ok(P.canAddMoney('2026-11-30', '2026-12-06'))).toBe(false)
  })
  it('lets a late payment land in its own month and says so', () => {
    const o = order('2026-11-20')
    expect(ok(P.canAddMoney('2026-12-12', '2026-12-12'))).toBe(true)
    expect(P.paymentMonthNote(o, '2026-12-12')).toContain('2026-11')
    expect(P.paymentMonthNote(o, '2026-12-12')).toContain('2026-12')
    expect(P.paymentMonthNote(o, '2026-11-25')).toBeNull()
  })
})

describe('changing or deleting money', () => {
  const today = '2026-11-15'
  it('blocks edits and deletes in a closed month', () => {
    expect(ok(P.canChangeMoney('2026-10-20', null, today))).toBe(false)
    expect(ok(P.canChangeMoney('2026-10-20', '2026-11-02', today))).toBe(false)
  })
  it('allows changes inside the open month only', () => {
    expect(ok(P.canChangeMoney('2026-11-02', null, today))).toBe(true)
    expect(ok(P.canChangeMoney('2026-11-02', '2026-11-10', today))).toBe(true)
    expect(ok(P.canChangeMoney('2026-11-02', '2026-10-30', today))).toBe(false)
    expect(ok(P.canChangeMoney('2026-11-02', '2026-11-20', today))).toBe(false)
  })
})

describe('orders', () => {
  const today = '2026-11-15'
  it('starts only in an open month', () => {
    expect(ok(P.canStartOrder('2026-11-01', today))).toBe(true)
    expect(ok(P.canStartOrder('2026-11-30', today))).toBe(true)
    expect(ok(P.canStartOrder('2026-10-31', today))).toBe(false)
    expect(ok(P.canStartOrder('2026-12-01', today))).toBe(false)
    expect(ok(P.canStartOrder('2026-11-28', '2026-12-02'))).toBe(true)
  })
  it('never moves into or out of a closed month', () => {
    expect(ok(P.canMoveOrderStart('2026-10-10', '2026-11-02', today))).toBe(false)
    expect(ok(P.canMoveOrderStart('2026-11-03', '2026-10-30', today))).toBe(false)
    expect(ok(P.canMoveOrderStart('2026-10-10', '2026-10-12', today))).toBe(true)
    expect(ok(P.canMoveOrderStart('2026-11-03', '2026-11-09', today))).toBe(true)
  })
  it('keeps the due date on or after the start', () => {
    expect(ok(P.canSetDue('2026-11-10', '2026-11-09'))).toBe(false)
    expect(ok(P.canSetDue('2026-11-10', '2027-01-15'))).toBe(true)
    expect(ok(P.canSetDue(null, '2026-11-09'))).toBe(true)
  })
  it('lets an order from a closed month be completed today', () => {
    expect(ok(P.canComplete('2026-10-20', '2026-11-15', today))).toBe(true)
  })
  it('refuses completion in the future, before the start, or in a closed month', () => {
    expect(ok(P.canComplete('2026-11-01', '2026-11-16', today))).toBe(false)
    expect(ok(P.canComplete('2026-11-10', '2026-11-09', today))).toBe(false)
    expect(ok(P.canComplete('2026-10-20', '2026-10-30', today))).toBe(false)
  })
  it('lets the price change until the order is completed', () => {
    expect(ok(P.canChangePrice('Active'))).toBe(true)
    expect(ok(P.canChangePrice('Completed'))).toBe(false)
  })
})

describe('part payments, fees and refunds', () => {
  const pay = (amount: number, date: string): P.MoneyLine => ({ kind: 'payment', amount, date })
  const refund = (amount: number, date: string): P.MoneyLine => ({ kind: 'refund', amount, date })
  it('adds part payments exactly', () => {
    expect(P.netReceived([pay(0.1, '2026-11-01'), pay(0.2, '2026-11-02')])).toBe(0.3)
    expect(P.netReceived([pay(100, '2026-11-01'), pay(50, '2026-11-20')])).toBe(150)
  })
  it('takes a refund off without touching the first payment', () => {
    expect(P.netReceived([pay(100, '2026-11-01'), pay(50, '2026-11-20'), refund(30, '2027-01-02')])).toBe(120)
  })
  it('counts each part in its own month and a refund in the month it happened', () => {
    const lines = [pay(100, '2026-11-28'), pay(50, '2026-12-12'), refund(30, '2027-01-02')]
    expect(P.receivedInMonth(lines, '2026-11')).toBe(100)
    expect(P.receivedInMonth(lines, '2026-12')).toBe(50)
    expect(P.receivedInMonth(lines, '2027-01')).toBe(-30)
  })
  it('works out the platform fee to the cent', () => {
    expect(P.feeOn(100, 20)).toBe(20)
    expect(P.feeOn(33.33, 20)).toBe(6.67)
    expect(P.feeOn(150, 0)).toBe(0)
  })
  it('works out what is still owed', () => {
    expect(P.owed(100, 20, [])).toBe(80)
    expect(P.owed(100, 20, [pay(50, '2026-11-01')])).toBe(30)
    expect(P.owed(100, 20, [pay(80, '2026-11-01')])).toBe(0)
    expect(P.owed(100, 20, [pay(95, '2026-11-01')])).toBe(0)
    expect(P.owed(100, 20, [pay(80, '2026-11-01'), refund(80, '2026-11-09')])).toBe(80)
    expect(P.owed(200, 0, [pay(75.5, '2026-11-01'), pay(24.5, '2026-11-02')])).toBe(100)
  })
})

describe('corrections to a closed month', () => {
  const at = '2026-11-15T12:00:00Z'
  it('needs a reason', () => {
    expect(P.makeCorrection('amount', '100', '120', '', at)).toBeNull()
    expect(P.makeCorrection('amount', '100', '120', '  ', at)).toBeNull()
  })
  it('needs an actual change', () => {
    expect(P.makeCorrection('amount', '100', '100', 'typo', at)).toBeNull()
  })
  it('keeps the old value, the new value and the reason', () => {
    expect(P.makeCorrection('amount', '100', '120', '  client paid extra ', at)).toEqual({ field: 'amount', oldValue: '100', newValue: '120', reason: 'client paid extra', at })
  })
})
