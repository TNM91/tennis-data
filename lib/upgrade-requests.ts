import {
  getPricingPlan,
  type PricingCheckoutMode,
  type PricingBillingInterval,
  type PricingPlanId,
  type PricingQuantityMode,
} from './pricing-plans'

export const UPGRADE_REQUESTS_KEY = 'tenaceiq-upgrade-requests-v1'

export type UpgradeRequestRecord = {
  id: string
  planId: PricingPlanId
  planName: string
  priceLabel?: string
  billingAmountCents?: number
  billingCurrency?: string
  billingInterval?: PricingBillingInterval
  checkoutMode?: PricingCheckoutMode
  quantityMode?: PricingQuantityMode
  entitlementGrant?: Record<string, boolean>
  discountRules?: Array<Record<string, unknown>>
  name: string
  email: string
  userId?: string
  organization: string
  goal: string
  nextHref: string
  createdAt: string
  status?: UpgradeRequestStatus
  source?: 'local' | 'supabase'
}

export type UpgradeRequestStatus = 'pending' | 'contacted' | 'converted' | 'closed'

export type UpgradeRequestRow = {
  id: string
  plan_id: PricingPlanId
  plan_name: string
  price_label?: string | null
  billing_amount_cents?: number | null
  billing_currency?: string | null
  billing_interval?: PricingBillingInterval | null
  checkout_mode?: PricingCheckoutMode | null
  quantity_mode?: PricingQuantityMode | null
  entitlement_grant?: Record<string, boolean> | null
  discount_rules?: Array<Record<string, unknown>> | null
  requester_name: string
  requester_email: string
  requester_user_id: string | null
  organization: string
  goal: string
  next_href: string
  status: UpgradeRequestStatus
  source: string
  created_at: string
  updated_at: string
}

export function mapUpgradeRequestRow(row: UpgradeRequestRow): UpgradeRequestRecord {
  const pricingSnapshot = buildUpgradePricingSnapshot(row.plan_id)

  return {
    id: row.id,
    planId: row.plan_id,
    planName: row.plan_name,
    priceLabel: row.price_label ?? pricingSnapshot.priceLabel,
    billingAmountCents: row.billing_amount_cents ?? pricingSnapshot.billingAmountCents,
    billingCurrency: row.billing_currency ?? pricingSnapshot.billingCurrency,
    billingInterval: row.billing_interval ?? pricingSnapshot.billingInterval,
    checkoutMode: row.checkout_mode ?? pricingSnapshot.checkoutMode,
    quantityMode: row.quantity_mode ?? pricingSnapshot.quantityMode,
    entitlementGrant: row.entitlement_grant ?? pricingSnapshot.entitlementGrant,
    discountRules: row.discount_rules ?? pricingSnapshot.discountRules,
    name: row.requester_name,
    email: row.requester_email,
    userId: row.requester_user_id ?? undefined,
    organization: row.organization,
    goal: row.goal,
    nextHref: row.next_href,
    createdAt: row.created_at,
    status: row.status,
    source: 'supabase',
  }
}

export function mapUpgradeRequestRecordToInsert(record: UpgradeRequestRecord) {
  const pricingSnapshot = buildUpgradePricingSnapshot(record.planId)

  return {
    plan_id: record.planId,
    plan_name: pricingSnapshot.planName,
    price_label: pricingSnapshot.priceLabel,
    billing_amount_cents: pricingSnapshot.billingAmountCents,
    billing_currency: pricingSnapshot.billingCurrency,
    billing_interval: pricingSnapshot.billingInterval,
    checkout_mode: pricingSnapshot.checkoutMode,
    quantity_mode: pricingSnapshot.quantityMode,
    entitlement_grant: pricingSnapshot.entitlementGrant,
    discount_rules: pricingSnapshot.discountRules,
    requester_name: record.name,
    requester_email: record.email,
    requester_user_id: record.userId ?? null,
    organization: record.organization,
    goal: record.goal,
    next_href: record.nextHref,
    source: 'upgrade_page',
  }
}

export function buildUpgradePricingSnapshot(planId: PricingPlanId) {
  const plan = getPricingPlan(planId)

  return {
    planName: plan.name,
    priceLabel: plan.priceLabel,
    billingAmountCents: plan.billing.amountCents,
    billingCurrency: plan.billing.currency,
    billingInterval: plan.billing.interval,
    checkoutMode: plan.billing.checkoutMode,
    quantityMode: plan.billing.quantityMode,
    entitlementGrant: plan.entitlementGrant,
    discountRules: plan.discountRules ?? [],
  }
}
