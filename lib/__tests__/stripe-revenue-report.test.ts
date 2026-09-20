import { describe, expect, it } from 'vitest'
import { summarizeStripeRevenue30d, summarizeStripeRevenue6m } from '../stripe-revenue-report'

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

describe('summarizeStripeRevenue6m', () => {
  it('groups exact cash and fees into six calendar months', () => {
    const now = Date.parse('2026-09-20T12:00:00Z')
    const report = summarizeStripeRevenue6m([
      { amount: 5_000, net: 4_825, currency: 'usd', reporting_category: 'charge', created: Date.parse('2026-04-02T12:00:00Z') / 1000 },
      { id: 'txn_payment', source: 'ch_123', description: 'Captain monthly payment', amount: 8_000, fee: 265, net: 7_735, currency: 'usd', reporting_category: 'charge', created: Date.parse('2026-08-10T12:00:00Z') / 1000 },
      { id: 'txn_refund', source: 're_123', description: 'Requested refund', amount: -1_000, fee: 0, net: -1_000, currency: 'usd', reporting_category: 'refund', created: Date.parse('2026-08-12T12:00:00Z') / 1000 },
      { amount: 9_000, net: 8_700, currency: 'usd', reporting_category: 'charge', created: Date.parse('2026-03-31T23:59:59Z') / 1000 },
    ], now)

    expect(report.months.map((month) => month.month)).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
    ])
    expect(report.months[0].netAfterFeesCents).toBe(4_825)
    expect(report.months[4]).toMatchObject({
      grossCollectedCents: 8_000,
      refundsCents: 1_000,
      netCollectedCents: 7_000,
      stripeFeesCents: 265,
      netAfterFeesCents: 6_735,
      transactionCount: 2,
    })
    expect(report.months[4].activity).toEqual([
      {
        id: 'txn_refund',
        kind: 'refund',
        occurredAt: '2026-08-12T12:00:00.000Z',
        description: 'Requested refund',
        sourceId: 're_123',
        amountCents: -1_000,
        feeCents: 0,
        netCents: -1_000,
      },
      {
        id: 'txn_payment',
        kind: 'payment',
        occurredAt: '2026-08-10T12:00:00.000Z',
        description: 'Captain monthly payment',
        sourceId: 'ch_123',
        amountCents: 8_000,
        feeCents: 265,
        netCents: 7_735,
      },
    ])
    expect(report.months[5].netCollectedCents).toBe(0)
  })
})
