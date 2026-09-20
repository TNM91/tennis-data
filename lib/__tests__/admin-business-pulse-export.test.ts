import { describe, expect, it } from 'vitest'
import { buildAdminMonthCsvExport } from '../admin-business-pulse-export'

describe('buildAdminMonthCsvExport', () => {
  it('exports monthly totals, cash activity, and account movement in one CSV', () => {
    const result = buildAdminMonthCsvExport({
      month: '2026-09',
      label: 'Sep',
      revenue: {
        month: '2026-09',
        label: 'Sep',
        grossCollectedCents: 10_000,
        refundsCents: 2_000,
        disputesCents: 0,
        netCollectedCents: 8_000,
        stripeFeesCents: 320,
        netAfterFeesCents: 7_680,
        transactionCount: 2,
        currency: 'usd',
        activity: [
          {
            id: 'txn_1',
            kind: 'payment',
            occurredAt: '2026-09-04T12:00:00.000Z',
            description: 'Captain plan, "September"',
            sourceId: 'ch_1',
            amountCents: 10_000,
            feeCents: 320,
            netCents: 9_680,
          },
          {
            id: 'txn_2',
            kind: 'refund',
            occurredAt: '2026-09-08T12:00:00.000Z',
            description: 'Plan refund',
            sourceId: 're_1',
            amountCents: -2_000,
            feeCents: 0,
            netCents: -2_000,
          },
        ],
      },
      subscriptions: {
        month: '2026-09',
        label: 'Sep',
        newPaidAccounts: 1,
        cancellations: 0,
        movements: [{
          kind: 'new_paid',
          occurredAt: '2026-09-04T12:00:00.000Z',
          accountLabel: '=Taylor Ace',
          profileId: 'profile-new',
          subscriptionId: 'sub_new',
          planLabel: 'Captain',
        }],
      },
    })

    expect(result.filename).toBe('tenaceiq-admin-2026-09-activity.csv')
    expect(result.rowCount).toBe(4)
    expect(result.csv).toContain('"Monthly totals"')
    expect(result.csv).toContain('"100.00","20.00","0.00","80.00","3.20","76.80"')
    expect(result.csv).toContain('"Captain plan, ""September"""')
    expect(result.csv).toContain('"-20.00","0.00","-20.00"')
    expect(result.csv).toContain('"\'=Taylor Ace"')
    expect(result.csv).toContain('"profile-new","sub_new"')
  })

  it('still exports an empty selected month with headers', () => {
    const result = buildAdminMonthCsvExport({ month: '2026-08', label: 'Aug' })

    expect(result.rowCount).toBe(0)
    expect(result.csv).toContain('"Record type"')
    expect(result.csv).not.toContain('Monthly totals')
  })
})
