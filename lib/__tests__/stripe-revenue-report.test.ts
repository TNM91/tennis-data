import { describe, expect, it } from 'vitest'
import { summarizeStripeRevenue30d } from '../stripe-revenue-report'

describe('summarizeStripeRevenue30d', () => {
  it('reports charged cash, returns, fees, and net balance impact without double counting', () => {
    const now = Date.parse('2026-09-20T12:00:00Z')
    const created = Math.floor(Date.parse('2026-09-10T12:00:00Z') / 1000)
    const report = summarizeStripeRevenue30d([
      { id: 'txn_charge', amount: 10_000, fee: 320, net: 9_680, currency: 'usd', reporting_category: 'charge', created },
      { id: 'txn_refund', amount: -2_000, fee: 0, net: -2_000, currency: 'usd', reporting_category: 'refund', created },
      { id: 'txn_dispute', amount: -1_000, fee: 0, net: -1_000, currency: 'usd', reporting_category: 'dispute', created },
      { id: 'txn_reversal', amount: 500, fee: 0, net: 500, currency: 'usd', reporting_category: 'dispute_reversal', created },
      { id: 'txn_payout', amount: -7_180, fee: 0, net: -7_180, currency: 'usd', reporting_category: 'payout', created },
    ], now)

    expect(report.grossCollectedCents).toBe(10_000)
    expect(report.refundsCents).toBe(2_000)
    expect(report.disputesCents).toBe(1_000)
    expect(report.netCollectedCents).toBe(7_500)
    expect(report.stripeFeesCents).toBe(320)
    expect(report.netAfterFeesCents).toBe(7_180)
    expect(report.transactionCount).toBe(4)
  })

  it('excludes non-USD and out-of-window transactions', () => {
    const now = Date.parse('2026-09-20T12:00:00Z')
    const report = summarizeStripeRevenue30d([
      { amount: 1_000, net: 970, currency: 'eur', reporting_category: 'charge', created: Math.floor(now / 1000) },
      { amount: 2_000, net: 1_940, currency: 'usd', reporting_category: 'charge', created: Math.floor(Date.parse('2026-08-01T12:00:00Z') / 1000) },
    ], now)

    expect(report.grossCollectedCents).toBe(0)
    expect(report.netCollectedCents).toBe(0)
    expect(report.transactionCount).toBe(0)
  })
})
