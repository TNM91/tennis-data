import 'server-only'
import {
  summarizeStripeRevenue30d,
  summarizeStripeRevenue6m,
  type StripeBalanceTransactionRow,
  type StripeRevenueReport,
  type StripeRevenueTrend,
} from './stripe-revenue-report'

const STRIPE_API_VERSION = '2026-04-22.dahlia'
const MAX_PAGES = 100

type StripeBalanceTransactionList = {
  data?: StripeBalanceTransactionRow[]
  has_more?: boolean
}

export async function loadStripeRevenueReporting(now = Date.now()): Promise<{
  report: StripeRevenueReport | null
  trend: StripeRevenueTrend | null
  message: string | null
}> {
  const stripeKey = process.env.STRIPE_REPORTING_KEY?.trim() ||
    process.env.STRIPE_SECRET_KEY?.trim() ||
    process.env.STRIPE_RESTRICTED_KEY?.trim()
  if (!stripeKey) {
    return { report: null, trend: null, message: 'Stripe cash reporting is not configured.' }
  }

  const nowDate = new Date(now)
  const sinceSeconds = Math.floor(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - 5, 1) / 1000)
  const rows: StripeBalanceTransactionRow[] = []
  let startingAfter = ''

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL('https://api.stripe.com/v1/balance_transactions')
    url.searchParams.set('limit', '100')
    url.searchParams.set('currency', 'usd')
    url.searchParams.set('created[gte]', String(sinceSeconds))
    if (startingAfter) url.searchParams.set('starting_after', startingAfter)

    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Stripe-Version': STRIPE_API_VERSION,
        },
        cache: 'no-store',
      })
    } catch {
      return { report: null, trend: null, message: 'Stripe cash totals are temporarily unavailable.' }
    }
    const body = await response.json().catch(() => null) as StripeBalanceTransactionList | null
    if (!response.ok || !body) {
      const permissionMessage = response.status === 401 || response.status === 403
        ? 'Stripe cash reporting needs Balance read access.'
        : 'Stripe cash totals are temporarily unavailable.'
      return { report: null, trend: null, message: permissionMessage }
    }

    const pageRows = Array.isArray(body.data) ? body.data : []
    rows.push(...pageRows)
    if (!body.has_more) {
      return {
        report: summarizeStripeRevenue30d(rows, now),
        trend: summarizeStripeRevenue6m(rows, now),
        message: null,
      }
    }

    const lastId = pageRows.at(-1)?.id?.trim()
    if (!lastId) return { report: null, trend: null, message: 'Stripe returned an incomplete cash report.' }
    startingAfter = lastId
  }

  return { report: null, trend: null, message: 'Stripe cash activity is too large to summarize safely.' }
}
