export type StripeBalanceTransactionRow = {
  id?: string | null
  amount?: number | null
  fee?: number | null
  net?: number | null
  currency?: string | null
  reporting_category?: string | null
  created?: number | null
}

export type StripeRevenueReport = {
  grossCollectedCents: number
  refundsCents: number
  disputesCents: number
  netCollectedCents: number
  stripeFeesCents: number
  netAfterFeesCents: number
  transactionCount: number
  currency: 'usd'
  periodDays: 30
  since: string
  through: string
}

export type StripeRevenueTrendPoint = Omit<StripeRevenueReport, 'periodDays' | 'since' | 'through'> & {
  month: string
  label: string
}

export type StripeRevenueTrend = {
  months: StripeRevenueTrendPoint[]
  currency: 'usd'
  since: string
  through: string
}

const CHARGE_CATEGORIES = new Set(['charge', 'payment'])
const REFUND_CATEGORIES = new Set(['refund', 'payment_refund'])
const DISPUTE_CATEGORIES = new Set(['dispute'])
const DISPUTE_REVERSAL_CATEGORIES = new Set(['dispute_reversal'])

export function summarizeStripeRevenue30d(
  rows: StripeBalanceTransactionRow[],
  now = Date.now(),
): StripeRevenueReport {
  const sinceMs = now - 30 * 24 * 60 * 60 * 1000
  const relevantRows = rows.filter((row) => {
    const createdMs = Number(row.created) * 1000
    return row.currency === 'usd' && Number.isFinite(createdMs) && createdMs >= sinceMs && createdMs <= now && isRevenueCategory(row.reporting_category)
  })
  const summary = summarizeRevenueRows(relevantRows)

  return {
    ...summary,
    currency: 'usd',
    periodDays: 30,
    since: new Date(sinceMs).toISOString(),
    through: new Date(now).toISOString(),
  }
}

export function summarizeStripeRevenue6m(
  rows: StripeBalanceTransactionRow[],
  now = Date.now(),
): StripeRevenueTrend {
  const nowDate = new Date(now)
  const firstMonthMs = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - 5, 1)
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - 5 + index, 1))
    const month = monthDate.toISOString().slice(0, 7)
    return {
      month,
      label: monthDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      rows: [] as StripeBalanceTransactionRow[],
    }
  })
  const bucketByMonth = new Map(buckets.map((bucket) => [bucket.month, bucket]))

  for (const row of rows) {
    const createdMs = Number(row.created) * 1000
    if (
      row.currency !== 'usd' ||
      !Number.isFinite(createdMs) ||
      createdMs < firstMonthMs ||
      createdMs > now ||
      !isRevenueCategory(row.reporting_category)
    ) continue
    bucketByMonth.get(new Date(createdMs).toISOString().slice(0, 7))?.rows.push(row)
  }

  return {
    months: buckets.map(({ month, label, rows: monthRows }) => ({
      month,
      label,
      ...summarizeRevenueRows(monthRows),
      currency: 'usd' as const,
    })),
    currency: 'usd',
    since: new Date(firstMonthMs).toISOString(),
    through: new Date(now).toISOString(),
  }
}

function summarizeRevenueRows(rows: StripeBalanceTransactionRow[]) {
  let grossCollectedCents = 0
  let refundsCents = 0
  let disputesCents = 0
  let disputeReversalsCents = 0
  let netAfterFeesCents = 0

  for (const row of rows) {
    const amount = Number(row.amount) || 0
    const category = row.reporting_category ?? ''
    if (CHARGE_CATEGORIES.has(category) && amount > 0) grossCollectedCents += amount
    if (REFUND_CATEGORIES.has(category) && amount < 0) refundsCents += Math.abs(amount)
    if (DISPUTE_CATEGORIES.has(category) && amount < 0) disputesCents += Math.abs(amount)
    if (DISPUTE_REVERSAL_CATEGORIES.has(category) && amount > 0) disputeReversalsCents += amount
    netAfterFeesCents += Number(row.net) || 0
  }

  const netCollectedCents = grossCollectedCents - refundsCents - disputesCents + disputeReversalsCents

  return {
    grossCollectedCents,
    refundsCents,
    disputesCents,
    netCollectedCents,
    stripeFeesCents: Math.max(0, netCollectedCents - netAfterFeesCents),
    netAfterFeesCents,
    transactionCount: rows.length,
  }
}

function isRevenueCategory(value: string | null | undefined) {
  return CHARGE_CATEGORIES.has(value ?? '') ||
    REFUND_CATEGORIES.has(value ?? '') ||
    DISPUTE_CATEGORIES.has(value ?? '') ||
    DISPUTE_REVERSAL_CATEGORIES.has(value ?? '')
}
