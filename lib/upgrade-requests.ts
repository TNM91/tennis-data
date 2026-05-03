import type { PricingPlanId } from '@/lib/pricing-plans'

export const UPGRADE_REQUESTS_KEY = 'tenaceiq-upgrade-requests-v1'

export type UpgradeRequestRecord = {
  id: string
  planId: PricingPlanId
  planName: string
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
  return {
    id: row.id,
    planId: row.plan_id,
    planName: row.plan_name,
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
  return {
    plan_id: record.planId,
    plan_name: record.planName,
    requester_name: record.name,
    requester_email: record.email,
    requester_user_id: record.userId ?? null,
    organization: record.organization,
    goal: record.goal,
    next_href: record.nextHref,
    source: 'upgrade_page',
  }
}
