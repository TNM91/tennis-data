import type { SubscriptionTrendPoint } from './admin-business-pulse'
import type { StripeRevenueTrendPoint } from './stripe-revenue-report'

type AdminMonthCsvExportInput = {
  month: string
  label: string
  revenue?: StripeRevenueTrendPoint
  subscriptions?: SubscriptionTrendPoint
}

const HEADERS = [
  'Month',
  'Record type',
  'Activity',
  'Account or description',
  'Plan or source',
  'Date',
  'Gross USD',
  'Refunds USD',
  'Disputes USD',
  'Amount USD',
  'Fee USD',
  'Net USD',
  'Profile ID',
  'Reference ID',
]

export function buildAdminMonthCsvExport({
  month,
  label,
  revenue,
  subscriptions,
}: AdminMonthCsvExportInput) {
  const rows: Array<Array<string | number>> = []

  if (revenue) {
    rows.push([
      month,
      'Summary',
      'Monthly totals',
      `${label} Stripe revenue`,
      'USD',
      '',
      centsToUsd(revenue.grossCollectedCents),
      centsToUsd(revenue.refundsCents),
      centsToUsd(revenue.disputesCents),
      centsToUsd(revenue.netCollectedCents),
      centsToUsd(revenue.stripeFeesCents),
      centsToUsd(revenue.netAfterFeesCents),
      '',
      '',
    ])

    for (const activity of revenue.activity) {
      rows.push([
        month,
        'Cash activity',
        cashActivityLabel(activity.kind),
        activity.description,
        activity.sourceId,
        activity.occurredAt,
        '',
        '',
        '',
        centsToUsd(activity.amountCents),
        centsToUsd(activity.feeCents),
        centsToUsd(activity.netCents),
        '',
        activity.id,
      ])
    }
  }

  for (const movement of subscriptions?.movements ?? []) {
    rows.push([
      month,
      'Account movement',
      movement.kind === 'canceled' ? 'Canceled' : 'New paid',
      movement.accountLabel,
      movement.planLabel,
      movement.occurredAt,
      '',
      '',
      '',
      '',
      '',
      '',
      movement.profileId,
      movement.subscriptionId,
    ])
  }

  const csv = [HEADERS, ...rows]
    .map((row) => row.map((value, index) => csvCell(value, index >= 6 && index <= 11)).join(','))
    .join('\r\n')

  return {
    csv: `\uFEFF${csv}`,
    filename: `tenaceiq-admin-${month || 'month'}-activity.csv`,
    rowCount: rows.length,
  }
}

function cashActivityLabel(kind: StripeRevenueTrendPoint['activity'][number]['kind']) {
  if (kind === 'refund') return 'Refund'
  if (kind === 'dispute') return 'Dispute'
  if (kind === 'recovered') return 'Dispute recovered'
  return 'Payment'
}

function centsToUsd(value: number) {
  return (value / 100).toFixed(2)
}

function csvCell(value: string | number, numeric = false) {
  let text = String(value)
  if (!numeric && /^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
