import { describe, expect, it } from 'vitest'
import type { AppData, Expense, Order, Payment } from './types'
import { DEFAULT_SETTINGS } from './storage'
import * as U from './utils'

// Small builders so each test only states what matters to it.
let n = 0
const id = () => `t${++n}`
const order = (o: Partial<Order>): Order => ({
  id: id(), clientId: 'c1', title: 'Job', service: '', status: 'Active', platform: 'Direct', price: 100, currency: 'USD',
  startDate: '2026-11-01', dueDate: null, notes: '', checklist: [], completedAt: null, createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T08:00:00Z', ...o,
})
const pay = (p: Partial<Payment>): Payment => ({ id: id(), orderId: null, clientId: 'c1', date: '2026-11-10', amount: 100, currency: 'USD', rateToBase: 1, method: '', status: 'Received', notes: '', ...p })
const spend = (e: Partial<Expense>): Expense => ({ id: id(), orderId: null, clientId: null, date: '2026-11-10', amount: 10, currency: 'USD', rateToBase: 1, category: 'Fees', method: '', notes: '', ...e })
const data = (d: Partial<AppData>): AppData => ({
  clients: [{ id: 'c1', name: 'Client', contact: '', platform: 'Fiverr', notes: '', lastContact: null, createdAt: '2026-10-01T00:00:00Z' }],
  orders: [], payments: [], expenses: [], days: [], entries: [], goals: [], settings: DEFAULT_SETTINGS, ...d,
})

describe('date helpers already in the app', () => {
  it('adds days across a leap day and a normal February', () => {
    expect(U.addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(U.addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(U.addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(U.addDays('2026-11-10', 14)).toBe('2026-11-24')
  })
  it('counts days between dates', () => {
    expect(U.daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(U.daysBetween('2026-12-30', '2027-01-02')).toBe(3)
  })
  it('lists months across a year end', () => {
    expect(U.lastMonths(3, '2027-01-15')).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(U.previousMonth('2027-01')).toBe('2026-12')
    expect(U.previousMonth('2028-03')).toBe('2028-02')
  })
})

describe('monthly goal window (25th to 5th)', () => {
  const open = (d: string) => { const g = U.goalWindow(d); return g.open ? g.month : null }
  it('opens on the 25th for next month', () => {
    expect(open('2026-11-24')).toBeNull()
    expect(open('2026-11-25')).toBe('2026-12')
    expect(open('2026-11-30')).toBe('2026-12')
  })
  it('stays open through the 5th, then closes', () => {
    expect(open('2026-12-01')).toBe('2026-12')
    expect(open('2026-12-05')).toBe('2026-12')
    expect(open('2026-12-06')).toBeNull()
  })
  it('works across the new year and a leap February', () => {
    expect(open('2026-12-25')).toBe('2027-01')
    expect(open('2027-01-05')).toBe('2027-01')
    expect(open('2027-01-31')).toBe('2027-02')
    expect(open('2028-02-29')).toBe('2028-03')
    expect(open('2028-03-06')).toBeNull()
  })
  it('says when it opens next', () => {
    expect(U.goalWindow('2026-11-15')).toMatchObject({ open: false, nextOpens: '2026-11-25', nextMonth: '2026-12' })
  })
})

describe('money in and out by month', () => {
  it('counts money by the day it arrived, not by the order', () => {
    const o = order({ startDate: '2026-10-20' })
    const d = data({ orders: [o], payments: [pay({ orderId: o.id, date: '2026-11-03', amount: 80 })] })
    expect(U.receivedIn(d, '2026-10')).toBe(0)
    expect(U.receivedIn(d, '2026-11')).toBe(80)
  })
  it('leaves out money that is only expected', () => {
    const d = data({ payments: [pay({ amount: 50 }), pay({ amount: 70, status: 'Expected' })] })
    expect(U.receivedIn(d, '2026-11')).toBe(50)
  })
  it('converts another currency with the rate saved on the payment', () => {
    const d = data({ payments: [pay({ amount: 75000, currency: 'NGN', rateToBase: 1 / 1500 })] })
    expect(U.receivedIn(d, '2026-11')).toBeCloseTo(50, 6)
  })
  it('counts expenses by the day they were spent', () => {
    const d = data({ expenses: [spend({ date: '2026-10-31', amount: 12 }), spend({ date: '2026-11-01', amount: 8 })] })
    expect(U.spentIn(d, '2026-10')).toBe(12)
    expect(U.spentIn(d, '2026-11')).toBe(8)
  })
})

describe('what a client still owes', () => {
  it('takes part payments off the price', () => {
    const o = order({ price: 400 })
    const d = data({ orders: [o], payments: [pay({ orderId: o.id, amount: 150 }), pay({ orderId: o.id, amount: 50, date: '2026-11-12' })] })
    expect(U.orderBalance(d, o)).toBe(200)
  })
  it('is never negative, is zero when cancelled and unknown with no price', () => {
    const over = order({ price: 100 })
    const cancelled = order({ price: 100, status: 'Cancelled' })
    const unpriced = order({ price: null })
    const d = data({ orders: [over, cancelled, unpriced], payments: [pay({ orderId: over.id, amount: 130 })] })
    expect(U.orderBalance(d, over)).toBe(0)
    expect(U.orderBalance(d, cancelled)).toBe(0)
    expect(U.orderBalance(d, unpriced)).toBeNull()
  })
})

describe('where your money is (platform fees and holds)', () => {
  it('uses no fee and no wait for a platform with no rule', () => {
    expect(U.ruleFor(data({}), 'Direct')).toEqual({ fee: 0, hold: 0 })
    expect(U.ruleFor(data({}), 'Fiverr')).toEqual({ fee: 20, hold: 14 })
  })
  it('holds Fiverr money for 14 days after delivery, less the 20% fee', () => {
    const o = order({ platform: 'Fiverr', status: 'Completed', completedAt: '2026-11-10' })
    const [item] = U.moneyPipeline(data({ orders: [o] }), '2026-11-15')
    expect(item).toMatchObject({ stage: 'clearing', amount: 80, fee: 20, date: '2026-11-24', ready: false })
  })
  it('makes it ready to withdraw on the clearing day', () => {
    const o = order({ platform: 'Fiverr', status: 'Completed', completedAt: '2026-11-10' })
    expect(U.moneyPipeline(data({ orders: [o] }), '2026-11-23')[0].stage).toBe('clearing')
    expect(U.moneyPipeline(data({ orders: [o] }), '2026-11-24')[0]).toMatchObject({ stage: 'owed', ready: true, daysLate: 0 })
  })
  it('shows an unpaid direct client as owed and late', () => {
    const o = order({ platform: 'Direct', price: 150, status: 'Completed', completedAt: '2026-11-10' })
    expect(U.moneyPipeline(data({ orders: [o] }), '2026-11-15')[0]).toMatchObject({ stage: 'owed', amount: 150, ready: false, daysLate: 5 })
  })
  it('keeps unfinished work in progress and drops leads and fully paid orders', () => {
    const active = order({ title: 'Active', price: 300 })
    const lead = order({ title: 'Lead', status: 'Lead' })
    const paid = order({ title: 'Paid', platform: 'Fiverr', status: 'Completed', completedAt: '2026-11-01' })
    const d = data({ orders: [active, lead, paid], payments: [pay({ orderId: paid.id, amount: 80 }), pay({ orderId: active.id, amount: 100 })] })
    const items = U.moneyPipeline(d, '2026-11-15')
    expect(items.map((i) => i.title)).toEqual(['Active'])
    expect(items[0]).toMatchObject({ stage: 'progress', amount: 200 })
    expect(U.stageTotal(items, 'progress')).toBe(200)
  })
  it('totals what was delivered in a month and what the platforms took', () => {
    const d = data({ orders: [
      order({ platform: 'Fiverr', price: 100, status: 'Completed', completedAt: '2026-11-10' }),
      order({ platform: 'Direct', price: 150, status: 'Completed', completedAt: '2026-11-28' }),
      order({ platform: 'Fiverr', price: 500, status: 'Completed', completedAt: '2026-12-01' }),
    ] })
    expect(U.deliveredIn(d, '2026-11')).toEqual({ gross: 250, fee: 20, kept: 230 })
  })
})
