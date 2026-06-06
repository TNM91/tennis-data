'use client'

export const dynamic = 'force-dynamic'


import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AdminActionRow,
  AdminEmptyState,
  AdminReviewFrame,
  AdminReviewHero,
  AdminReviewPanel,
  AdminStatusPanel,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import {
  buildProductAccessState,
  CAPTAIN_SUBSCRIPTION_PRICE_LABEL,
  TIQ_SEASON_FEE_PRICE_LABEL,
  type CaptainSubscriptionStatus,
  type ProductEntitlementSnapshot,
} from '@/lib/access-model'
import { normalizeUserRole, type UserRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import type { PricingPlanId } from '@/lib/pricing-plans'

type ProfileAccessRow = {
  id: string
  role: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  linked_player_id?: string | null
  linked_player_name?: string | null
  linked_team_name?: string | null
  linked_league_name?: string | null
  linked_flight?: string | null
  message_display_name?: string | null
  player_plus_subscription_active: boolean | null
  player_plus_subscription_status: CaptainSubscriptionStatus | null
  coach_subscription_active: boolean | null
  coach_subscription_status: CaptainSubscriptionStatus | null
  captain_subscription_active: boolean | null
  captain_subscription_status: CaptainSubscriptionStatus | null
  tiq_team_league_entry_enabled: boolean | null
  tiq_individual_league_creator_enabled: boolean | null
}

type EditableProfileAccess = {
  player_plus_subscription_active: boolean
  player_plus_subscription_status: CaptainSubscriptionStatus
  coach_subscription_active: boolean
  coach_subscription_status: CaptainSubscriptionStatus
  captain_subscription_active: boolean
  captain_subscription_status: CaptainSubscriptionStatus
  tiq_team_league_entry_enabled: boolean
  tiq_individual_league_creator_enabled: boolean
}

type AccessPreset = 'player_plus' | 'coach' | 'captain' | 'league' | 'full_court'
type RoleFilter = 'all' | 'admin' | 'captain' | 'member' | 'public'
type BillingFilter = 'all' | 'stripe' | 'past_due' | 'canceled' | 'webhook_error' | 'webhook_ignored' | 'manual'
type ProfileLinkFilter = 'all' | 'cloud' | 'display_only' | 'missing'

type ConvertedUpgradeRequestRow = {
  id: string
  plan_id: string | null
  requester_email: string | null
  requester_user_id: string | null
  created_at: string | null
  updated_at: string | null
}

type ConvertedUpgradeRequest = {
  id: string
  planId: PricingPlanId
  email: string
  changedAt: string
}

type StripeBillingEventRow = {
  id: string
  stripe_event_id: string | null
  event_type: string | null
  outcome: string | null
  message: string | null
  profile_id: string | null
  plan_id: string | null
  resulting_status: CaptainSubscriptionStatus | null
  created_at: string | null
}

type StripeBillingEvent = {
  id: string
  eventId: string
  eventType: string
  outcome: 'handled' | 'ignored' | 'error'
  message: string
  planId: PricingPlanId | null
  resultingStatus: CaptainSubscriptionStatus | null
  createdAt: string
}

type AccessAudit = {
  currentPlan: string
  activePlans: string
  sources: string[]
  warnings: string[]
  lastConvertedRequest: ConvertedUpgradeRequest | null
}

const STATUS_OPTIONS: CaptainSubscriptionStatus[] = [
  'inactive',
  'trial',
  'active',
  'past_due',
  'canceled',
]

function normalizeEditable(row: ProfileAccessRow): EditableProfileAccess {
  return {
    player_plus_subscription_active: Boolean(row.player_plus_subscription_active),
    player_plus_subscription_status: STATUS_OPTIONS.includes(
      row.player_plus_subscription_status ?? 'inactive',
    )
      ? (row.player_plus_subscription_status ?? 'inactive')
      : 'inactive',
    coach_subscription_active: Boolean(row.coach_subscription_active),
    coach_subscription_status: STATUS_OPTIONS.includes(
      row.coach_subscription_status ?? 'inactive',
    )
      ? (row.coach_subscription_status ?? 'inactive')
      : 'inactive',
    captain_subscription_active: Boolean(row.captain_subscription_active),
    captain_subscription_status: STATUS_OPTIONS.includes(
      row.captain_subscription_status ?? 'inactive',
    )
      ? (row.captain_subscription_status ?? 'inactive')
      : 'inactive',
    tiq_team_league_entry_enabled: Boolean(row.tiq_team_league_entry_enabled),
    tiq_individual_league_creator_enabled: Boolean(row.tiq_individual_league_creator_enabled),
  }
}

function compactUserId(value: string) {
  const trimmed = value.trim()
  if (trimmed.length <= 18) return trimmed
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`
}

function compactStripeId(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return ''
  if (trimmed.length <= 24) return trimmed
  return `${trimmed.slice(0, 12)}...${trimmed.slice(-8)}`
}

function roleLabel(value: string | null | undefined) {
  const normalized = (value || '').trim().toLowerCase()
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'captain') return 'Captain'
  if (normalized === 'member') return 'Member'
  return 'Public'
}

function formatAccessPreset(value: AccessPreset) {
  if (value === 'player_plus') return 'Player'
  if (value === 'coach') return 'Coach'
  if (value === 'captain') return 'Captain'
  if (value === 'full_court') return 'Full-Court'
  return 'League Office'
}

function normalizeRoleFilter(value: string | null): RoleFilter {
  if (value === 'admin' || value === 'captain' || value === 'member' || value === 'public') return value
  return 'all'
}

function normalizeBillingFilter(value: string | null): BillingFilter {
  if (
    value === 'stripe' ||
    value === 'past_due' ||
    value === 'canceled' ||
    value === 'webhook_error' ||
    value === 'webhook_ignored' ||
    value === 'manual'
  ) {
    return value
  }

  return 'all'
}

function normalizeProfileLinkFilter(value: string | null): ProfileLinkFilter {
  if (value === 'cloud' || value === 'display_only' || value === 'missing') return value
  return 'all'
}

function setQueryParam(params: URLSearchParams, key: string, value: string, defaultValue = '') {
  if (value === defaultValue) {
    params.delete(key)
  } else {
    params.set(key, value)
  }
}

export default function AdminAccessPage() {
  const [profiles, setProfiles] = useState<ProfileAccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [handoffSearch, setHandoffSearch] = useState('')
  const [urlFiltersReady, setUrlFiltersReady] = useState(false)
  const [playerEntitlementsAvailable, setPlayerEntitlementsAvailable] = useState(true)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [billingFilter, setBillingFilter] = useState<BillingFilter>('all')
  const [profileLinkFilter, setProfileLinkFilter] = useState<ProfileLinkFilter>('all')
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null)
  const [editedProfiles, setEditedProfiles] = useState<Record<string, EditableProfileAccess>>({})
  const [convertedRequestsByUser, setConvertedRequestsByUser] = useState<Record<string, ConvertedUpgradeRequest>>({})
  const [convertedRequestsAvailable, setConvertedRequestsAvailable] = useState(true)
  const [stripeEventsByUser, setStripeEventsByUser] = useState<Record<string, StripeBillingEvent>>({})
  const [stripeEventsAvailable, setStripeEventsAvailable] = useState(true)

  const deferredSearch = useDeferredValue(search)

  const loadConvertedRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('upgrade_requests')
      .select('id, plan_id, requester_email, requester_user_id, created_at, updated_at')
      .eq('status', 'converted')
      .not('requester_user_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(500)

    if (error) {
      setConvertedRequestsAvailable(false)
      return {}
    }

    setConvertedRequestsAvailable(true)
    return ((data ?? []) as ConvertedUpgradeRequestRow[]).reduce<Record<string, ConvertedUpgradeRequest>>(
      (acc, row) => {
        const userId = row.requester_user_id ?? ''
        const planId = normalizePricingPlanId(row.plan_id)
        if (!userId || !planId || acc[userId]) return acc

        acc[userId] = {
          id: row.id,
          planId,
          email: row.requester_email ?? '',
          changedAt: row.updated_at ?? row.created_at ?? '',
        }
        return acc
      },
      {},
    )
  }, [])

  const loadLatestStripeEvents = useCallback(async (userIds: string[]) => {
    const userIdSet = new Set(userIds)
    if (userIdSet.size === 0) return {}

    const { data, error } = await supabase
      .from('stripe_billing_events')
      .select('id, stripe_event_id, event_type, outcome, message, profile_id, plan_id, resulting_status, created_at')
      .not('profile_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      setStripeEventsAvailable(false)
      return {}
    }

    setStripeEventsAvailable(true)
    return ((data ?? []) as StripeBillingEventRow[]).reduce<Record<string, StripeBillingEvent>>(
      (acc, row) => {
        const userId = row.profile_id ?? ''
        if (!userId || !userIdSet.has(userId) || acc[userId]) return acc

        acc[userId] = {
          id: row.id,
          eventId: row.stripe_event_id ?? '',
          eventType: row.event_type ?? '',
          outcome: normalizeStripeBillingEventOutcome(row.outcome),
          message: row.message ?? '',
          planId: normalizePricingPlanId(row.plan_id),
          resultingStatus: normalizeSubscriptionStatus(row.resulting_status),
          createdAt: row.created_at ?? '',
        }
        return acc
      },
      {},
    )
  }, [])

  const loadProfiles = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const result = await supabase
        .from('profiles')
        .select(
          'id, role, stripe_customer_id, stripe_subscription_id, linked_player_id, linked_player_name, linked_team_name, linked_league_name, linked_flight, message_display_name, player_plus_subscription_active, player_plus_subscription_status, coach_subscription_active, coach_subscription_status, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
        )
        .limit(500)

      let data = (result.data ?? null) as ProfileAccessRow[] | null
      if (result.error) {
        const preBillingResult = await supabase
          .from('profiles')
          .select(
            'id, role, linked_player_id, linked_player_name, linked_team_name, linked_league_name, linked_flight, message_display_name, player_plus_subscription_active, player_plus_subscription_status, coach_subscription_active, coach_subscription_status, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
          )
          .limit(500)

        if (preBillingResult.error) {
          setPlayerEntitlementsAvailable(false)
          const legacyResult = await supabase
            .from('profiles')
            .select(
              'id, role, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
            )
            .limit(500)

          if (legacyResult.error) throw new Error(legacyResult.error.message)
          data = (legacyResult.data ?? []).map((row) => ({
            ...row,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            linked_player_id: null,
            linked_player_name: null,
            linked_team_name: null,
            linked_league_name: null,
            linked_flight: null,
            message_display_name: null,
            coach_subscription_active: false,
            coach_subscription_status: 'inactive' as CaptainSubscriptionStatus,
            player_plus_subscription_active: false,
            player_plus_subscription_status: 'inactive' as CaptainSubscriptionStatus,
          })) as ProfileAccessRow[]
          setMessage('Player entitlement columns are not migrated yet. Showing legacy access fields.')
        } else {
          data = (preBillingResult.data ?? []).map((row) => ({
            ...row,
            stripe_customer_id: null,
            stripe_subscription_id: null,
          })) as ProfileAccessRow[]
          setPlayerEntitlementsAvailable(true)
          setMessage('Stripe billing columns are not migrated yet. Showing access fields only.')
        }
      } else {
        setPlayerEntitlementsAvailable(true)
      }

      const rows = ((data || []) as ProfileAccessRow[]).sort((a, b) =>
        compactUserId(a.id).localeCompare(compactUserId(b.id)),
      )
      const convertedRequests = await loadConvertedRequests()
      const latestStripeEvents = await loadLatestStripeEvents(rows.map((row) => row.id))

      setProfiles(rows)
      setConvertedRequestsByUser(convertedRequests)
      setStripeEventsByUser(latestStripeEvents)
      setEditedProfiles(
        rows.reduce<Record<string, EditableProfileAccess>>((acc, row) => {
          acc[row.id] = normalizeEditable(row)
          return acc
        }, {}),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load profile entitlements.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadConvertedRequests, loadLatestStripeEvents])

  useEffect(() => {
    const initialParams = new URLSearchParams(window.location.search)
    const initialSearch = initialParams.get('search')
    if (initialSearch) {
      setSearch(initialSearch)
      setHandoffSearch(initialSearch)
    }
    setRoleFilter(normalizeRoleFilter(initialParams.get('role')))
    setBillingFilter(normalizeBillingFilter(initialParams.get('billing')))
    setProfileLinkFilter(normalizeProfileLinkFilter(initialParams.get('profileLink')))
    setUrlFiltersReady(true)
    void loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    if (!urlFiltersReady) return

    const params = new URLSearchParams(window.location.search)
    setQueryParam(params, 'search', search.trim())
    setQueryParam(params, 'role', roleFilter, 'all')
    setQueryParam(params, 'billing', billingFilter, 'all')
    setQueryParam(params, 'profileLink', profileLinkFilter, 'all')

    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [billingFilter, profileLinkFilter, roleFilter, search, urlFiltersReady])

  function updateProfileField<K extends keyof EditableProfileAccess>(
    profileId: string,
    field: K,
    value: EditableProfileAccess[K],
  ) {
    setEditedProfiles((current) => ({
      ...current,
      [profileId]: {
        ...(current[profileId] || {
          captain_subscription_active: false,
          captain_subscription_status: 'inactive',
          coach_subscription_active: false,
          coach_subscription_status: 'inactive',
          player_plus_subscription_active: false,
          player_plus_subscription_status: 'inactive',
          tiq_team_league_entry_enabled: false,
          tiq_individual_league_creator_enabled: false,
        }),
        [field]: value,
      },
    }))
  }

  function isDirty(profile: ProfileAccessRow) {
    const current = editedProfiles[profile.id]
    if (!current) return false

    return JSON.stringify(current) !== JSON.stringify(normalizeEditable(profile))
  }

  function applyAccessPreset(profileId: string, preset: AccessPreset) {
    const profile = profiles.find((item) => item.id === profileId)
    if (!profile) return

    setEditedProfiles((current) => {
      const base = current[profileId] ?? normalizeEditable(profile)
      const grantsPlayerAccess = preset === 'player_plus' || preset === 'captain' || preset === 'full_court'
      const grantsCoachAccess = preset === 'coach' || preset === 'full_court'
      const grantsCaptainAccess = preset === 'captain' || preset === 'full_court'
      const grantsLeagueAccess = preset === 'league' || preset === 'full_court'

      return {
        ...current,
        [profileId]: {
          ...base,
          player_plus_subscription_active: grantsPlayerAccess ? true : base.player_plus_subscription_active,
          player_plus_subscription_status: grantsPlayerAccess ? 'active' : base.player_plus_subscription_status,
          coach_subscription_active: grantsCoachAccess ? true : base.coach_subscription_active,
          coach_subscription_status: grantsCoachAccess ? 'active' : base.coach_subscription_status,
          captain_subscription_active: grantsCaptainAccess ? true : base.captain_subscription_active,
          captain_subscription_status: grantsCaptainAccess ? 'active' : base.captain_subscription_status,
          tiq_team_league_entry_enabled: grantsLeagueAccess ? true : base.tiq_team_league_entry_enabled,
          tiq_individual_league_creator_enabled:
            grantsLeagueAccess ? true : base.tiq_individual_league_creator_enabled,
        },
      }
    })
    setMessage(`Drafted ${formatAccessPreset(preset)} access. Save the row to apply it.`)
    setError('')
  }

  async function saveProfile(profile: ProfileAccessRow) {
    const draft = editedProfiles[profile.id]
    if (!draft) return

    setSavingId(profile.id)
    setMessage('')
    setError('')

    try {
      const payload: Record<string, boolean | CaptainSubscriptionStatus> = {
        coach_subscription_active: draft.coach_subscription_active,
        coach_subscription_status: draft.coach_subscription_status,
        captain_subscription_active: draft.captain_subscription_active,
        captain_subscription_status: draft.captain_subscription_status,
        tiq_team_league_entry_enabled: draft.tiq_team_league_entry_enabled,
        tiq_individual_league_creator_enabled: draft.tiq_individual_league_creator_enabled,
      }
      if (playerEntitlementsAvailable) {
        payload.player_plus_subscription_active = draft.player_plus_subscription_active
        payload.player_plus_subscription_status = draft.player_plus_subscription_status
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', profile.id)

      if (updateError) throw new Error(updateError.message)

      setProfiles((current) =>
        current.map((row) => (row.id === profile.id ? { ...row, ...payload } : row)),
      )
      setMessage(`Updated access for ${compactUserId(profile.id)}.`)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save profile entitlements.',
      )
    } finally {
      setSavingId(null)
    }
  }

  async function copySupportValue(label: string, value: string | null | undefined) {
    const trimmed = value?.trim() ?? ''
    if (!trimmed) {
      setError(`${label} is not available for this profile.`)
      return
    }

    try {
      await navigator.clipboard.writeText(trimmed)
      setMessage(`${label} copied.`)
      setError('')
    } catch {
      setError(`${label} could not be copied from this browser.`)
    }
  }

  const filteredProfiles = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()

    return profiles.filter((profile) => {
      const normalizedRole = (profile.role || 'public').trim().toLowerCase()
      if (roleFilter !== 'all' && normalizedRole !== roleFilter) return false
      if (!matchesBillingFilter(profile, stripeEventsByUser[profile.id] ?? null, billingFilter)) return false
      if (!matchesProfileLinkFilter(profile, profileLinkFilter)) return false

      if (!normalizedSearch) return true

      return [
        profile.id,
        normalizedRole,
        compactUserId(profile.id),
        profile.stripe_customer_id ?? '',
        profile.stripe_subscription_id ?? '',
        getProfileLinkStatus(profile).label,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [billingFilter, deferredSearch, profileLinkFilter, profiles, roleFilter, stripeEventsByUser])

  const activeCaptainCount = profiles.filter((profile) =>
    Boolean(profile.captain_subscription_active),
  ).length
  const activeCoachCount = profiles.filter((profile) =>
    Boolean(profile.coach_subscription_active),
  ).length
  const activePlayerCount = profiles.filter((profile) =>
    Boolean(
      profile.player_plus_subscription_active ||
      profile.coach_subscription_active ||
      profile.captain_subscription_active,
    ),
  ).length
  const teamEntryCount = profiles.filter((profile) =>
    Boolean(profile.tiq_team_league_entry_enabled),
  ).length
  const individualCreatorCount = profiles.filter((profile) =>
    Boolean(profile.tiq_individual_league_creator_enabled),
  ).length
  const stripeManagedCount = profiles.filter((profile) =>
    Boolean(profile.stripe_customer_id || profile.stripe_subscription_id),
  ).length
  const pastDueCount = profiles.filter((profile) =>
    hasSubscriptionStatus(profile, 'past_due') ||
    stripeEventsByUser[profile.id]?.resultingStatus === 'past_due',
  ).length
  const canceledCount = profiles.filter((profile) =>
    hasSubscriptionStatus(profile, 'canceled') ||
    stripeEventsByUser[profile.id]?.resultingStatus === 'canceled',
  ).length
  const webhookErrorCount = Object.values(stripeEventsByUser).filter((event) =>
    event.outcome === 'error',
  ).length
  const auditWarningCount = profiles.filter((profile) =>
    buildAccessAudit(
      normalizeUserRole(profile.role),
      normalizeEditable(profile),
      convertedRequestsByUser[profile.id] ?? null,
    ).warnings.length > 0,
  ).length
  const cloudLinkedProfileCount = profiles.filter(hasCloudLinkedPlayer).length
  const displayOnlyProfileCount = profiles.filter((profile) =>
    !hasCloudLinkedPlayer(profile) && Boolean(profile.message_display_name),
  ).length
  const missingProfileLinkCount = profiles.filter((profile) =>
    !hasCloudLinkedPlayer(profile) && !profile.message_display_name,
  ).length
  const handoffProfile = handoffSearch && filteredProfiles.length === 1 ? filteredProfiles[0] : null

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <AdminReviewFrame>
          <AdminReviewHero
            kicker="Admin Access"
            title="Player, Coach, Captain, and League Office entitlements"
            actions={
              <>
                <span className="badge badge-green">Coach subscription control</span>
                <span className="badge badge-green">Captain subscription control</span>
                <span className="badge badge-blue">Team League Office access</span>
                <span className="badge badge-slate">Individual League Office access</span>
              </>
            }
          >
            Control who has Player+, Coach, and {CAPTAIN_SUBSCRIPTION_PRICE_LABEL} captain
            workflows, plus who can run TIQ team or individual leagues at {TIQ_SEASON_FEE_PRICE_LABEL}.
          </AdminReviewHero>

          <AdminReviewPanel compact style={{ marginTop: 18 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                gap: 16,
              }}
            >
              <MetricCard label="Profiles Loaded" value={profiles.length} />
              <MetricCard label="Player Active" value={activePlayerCount} />
              <MetricCard label="Coach Active" value={activeCoachCount} />
              <MetricCard label="Captain Active" value={activeCaptainCount} />
              <MetricCard label="Team League Office" value={teamEntryCount} />
              <MetricCard label="Individual League Office" value={individualCreatorCount} />
              <MetricCard label="Stripe Managed" value={stripeManagedCount} />
              <MetricCard label="Past Due" value={pastDueCount} />
              <MetricCard label="Canceled" value={canceledCount} />
              <MetricCard label="Webhook Errors" value={webhookErrorCount} />
              <MetricCard label="Audit Flags" value={auditWarningCount} />
              <MetricCard
                label="Cloud Player Links"
                value={cloudLinkedProfileCount}
                active={profileLinkFilter === 'cloud'}
                onClick={() =>
                  setProfileLinkFilter((current) => current === 'cloud' ? 'all' : 'cloud')
                }
              />
              <MetricCard
                label="Display Only Profiles"
                value={displayOnlyProfileCount}
                active={profileLinkFilter === 'display_only'}
                onClick={() =>
                  setProfileLinkFilter((current) => current === 'display_only' ? 'all' : 'display_only')
                }
              />
              <MetricCard
                label="Missing Profile Links"
                value={missingProfileLinkCount}
                active={profileLinkFilter === 'missing'}
                onClick={() =>
                  setProfileLinkFilter((current) => current === 'missing' ? 'all' : 'missing')
                }
              />
            </div>
          </AdminReviewPanel>

          <AdminReviewPanel style={{ marginTop: 18 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
                gap: 16,
                marginTop: 18,
              }}
            >
              <Field label="Search profiles" htmlFor="admin-access-search">
                <input
                  id="admin-access-search"
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by user id, role, or profile link"
                  className="input"
                  disabled={loading || refreshing}
                />
              </Field>

              <Field label="Role filter" htmlFor="admin-access-role-filter">
                <select
                  id="admin-access-role-filter"
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(event.target.value as RoleFilter)
                  }
                  className="select"
                  disabled={loading || refreshing}
                >
                  <option value="all">All roles</option>
                  <option value="admin">Admin</option>
                  <option value="captain">Captain</option>
                  <option value="member">Member</option>
                  <option value="public">Public</option>
                </select>
              </Field>

              <Field label="Billing filter" htmlFor="admin-access-billing-filter">
                <select
                  id="admin-access-billing-filter"
                  value={billingFilter}
                  onChange={(event) => setBillingFilter(event.target.value as BillingFilter)}
                  className="select"
                  disabled={loading || refreshing}
                >
                  <option value="all">All billing</option>
                  <option value="stripe">Stripe managed</option>
                  <option value="past_due">Past due</option>
                  <option value="canceled">Canceled</option>
                  <option value="webhook_error">Webhook errors</option>
                  <option value="webhook_ignored">Ignored webhooks</option>
                  <option value="manual">Manual or role-based</option>
                </select>
              </Field>

              <Field label="Profile link filter" htmlFor="admin-access-profile-link-filter">
                <select
                  id="admin-access-profile-link-filter"
                  value={profileLinkFilter}
                  onChange={(event) => setProfileLinkFilter(event.target.value as ProfileLinkFilter)}
                  className="select"
                  disabled={loading || refreshing}
                >
                  <option value="all">All profile links</option>
                  <option value="cloud">Cloud linked</option>
                  <option value="display_only">Display only</option>
                  <option value="missing">Missing</option>
                </select>
              </Field>
            </div>

            <AdminActionRow>
              <button
                type="button"
                onClick={() => void loadProfiles(true)}
                className="button-ghost"
                style={{
                  background: 'var(--shell-chip-bg)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--shell-panel-border)',
                }}
                disabled={loading || refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh profiles'}
              </button>
            </AdminActionRow>

            <p className="subtle-text" style={{ marginTop: 14, maxWidth: 860 }}>
              This page is the monetization control point for TenAceIQ. League Office access can be
              granted by itself, without enabling Player or Captain tools. Use Billing filter for
              failed payments, canceled subscriptions, and webhook outcomes that need follow-up.
              Use Profile link filter to find accounts that are only display-name linked or missing a
              cloud player link.
              {convertedRequestsAvailable
                ? ' Converted checkout requests are shown beside each profile when available.'
                : ' Converted checkout requests are not available yet, so this view is showing profile fields only.'}
              {stripeEventsAvailable
                ? ' Stripe webhook history is shown when available.'
                : ' Stripe webhook history is not available yet.'}
            </p>

            {handoffSearch ? (
              <div style={handoffPanelStyle}>
                <div>
                  <div className="section-kicker">Upgrade request handoff</div>
                  <h2 style={handoffTitleStyle}>
                    {handoffProfile ? 'One account is in scope.' : 'Review the filtered account set.'}
                  </h2>
                  <p style={handoffTextStyle}>
                    Search was prefilled from the upgrade request queue. Use the presets when one
                    linked account is visible, then save the row.
                  </p>
                </div>
                {handoffProfile ? (
                  <div style={handoffActionStyle}>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => applyAccessPreset(handoffProfile.id, 'player_plus')}
                    >
                      Draft Player
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => applyAccessPreset(handoffProfile.id, 'coach')}
                    >
                      Draft Coach
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => applyAccessPreset(handoffProfile.id, 'captain')}
                    >
                      Draft Captain
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => applyAccessPreset(handoffProfile.id, 'league')}
                    >
                      Draft League Office
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => applyAccessPreset(handoffProfile.id, 'full_court')}
                    >
                      Draft Full-Court
                    </button>
                  </div>
                ) : (
                  <span className="badge badge-slate">{filteredProfiles.length} matches</span>
                )}
              </div>
            ) : null}

            {message ? (
              <AdminStatusPanel tone="success" text={message} />
            ) : null}

            {error ? (
              <AdminStatusPanel tone="error" text={error} />
            ) : null}

            {loading ? (
              <AdminEmptyState text="Loading profile entitlements..." />
            ) : filteredProfiles.length === 0 ? (
              <AdminEmptyState text="No profiles match the current filters. Clear the search or broaden the role, billing, or profile link filter to bring more entitlement rows back into scope." />
            ) : (
              <div className="table-wrap" style={{ marginTop: 20 }}>
                <table className="data-table" style={{ width: '100%', tableLayout: 'auto' }}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Stripe</th>
                      <th>Profile Link</th>
                      <th>Access Result</th>
                      <th>Why</th>
                      <th>Player Active</th>
                      <th>Player Status</th>
                      <th>Coach Active</th>
                      <th>Coach Status</th>
                      <th>Captain Active</th>
                      <th>Captain Status</th>
                      <th>Team League Office</th>
                      <th>Individual League Office</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((profile) => {
                      const draft = editedProfiles[profile.id] || normalizeEditable(profile)
                      const dirty = isDirty(profile)
                      const audit = buildAccessAudit(
                        normalizeUserRole(profile.role),
                        draft,
                        convertedRequestsByUser[profile.id] ?? null,
                      )

                      const latestStripeEvent = stripeEventsByUser[profile.id] ?? null
                      const expanded = expandedProfileId === profile.id

                      return (
                        <Fragment key={profile.id}>
                        <tr>
                          <td>
                            <div style={{ color: 'var(--foreground-strong)', fontWeight: 800 }}>
                              {compactUserId(profile.id)}
                            </div>
                            <div className="subtle-text" style={{ marginTop: 4 }}>
                              {profile.id}
                            </div>
                          </td>
                          <td>{roleLabel(profile.role)}</td>
                          <td>
                            <StripeBillingCell
                              profile={profile}
                              latestEvent={latestStripeEvent}
                            />
                          </td>
                          <td>
                            <ProfileLinkCell profile={profile} />
                          </td>
                          <td>
                            <div style={accessResultWrapStyle}>
                              <span className="badge badge-green">{audit.currentPlan}</span>
                              <span className="subtle-text">{audit.activePlans}</span>
                              {audit.lastConvertedRequest ? (
                                <span className="badge badge-blue">
                                  Checkout: {formatPlanLabel(audit.lastConvertedRequest.planId)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div style={auditReasonWrapStyle}>
                              {audit.sources.map((source) => (
                                <span key={source} style={auditReasonStyle}>
                                  {source}
                                </span>
                              ))}
                              {audit.warnings.map((warning) => (
                                <span key={warning} style={auditWarningStyle}>
                                  {warning}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <label style={toggleWrap}>
                              <input
                                type="checkbox"
                                checked={draft.player_plus_subscription_active}
                                onChange={(event) =>
                                  updateProfileField(
                                    profile.id,
                                    'player_plus_subscription_active',
                                    event.target.checked,
                                  )
                                }
                                disabled={savingId === profile.id || !playerEntitlementsAvailable}
                              />
                              <span>{draft.player_plus_subscription_active ? 'Active' : 'Inactive'}</span>
                            </label>
                          </td>
                          <td>
                            <select
                              value={draft.player_plus_subscription_status}
                              onChange={(event) =>
                                updateProfileField(
                                  profile.id,
                                  'player_plus_subscription_status',
                                  event.target.value as CaptainSubscriptionStatus,
                                )
                              }
                              className="select"
                              style={{ width: '100%', maxWidth: 140, minWidth: 0 }}
                              disabled={savingId === profile.id || !playerEntitlementsAvailable}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <label style={toggleWrap}>
                              <input
                                type="checkbox"
                                checked={draft.coach_subscription_active}
                                onChange={(event) =>
                                  updateProfileField(
                                    profile.id,
                                    'coach_subscription_active',
                                    event.target.checked,
                                  )
                                }
                                disabled={savingId === profile.id}
                              />
                              <span>{draft.coach_subscription_active ? 'Active' : 'Inactive'}</span>
                            </label>
                          </td>
                          <td>
                            <select
                              value={draft.coach_subscription_status}
                              onChange={(event) =>
                                updateProfileField(
                                  profile.id,
                                  'coach_subscription_status',
                                  event.target.value as CaptainSubscriptionStatus,
                                )
                              }
                              className="select"
                              style={{ width: '100%', maxWidth: 140, minWidth: 0 }}
                              disabled={savingId === profile.id}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <label style={toggleWrap}>
                              <input
                                type="checkbox"
                                checked={draft.captain_subscription_active}
                                onChange={(event) =>
                                  updateProfileField(
                                    profile.id,
                                    'captain_subscription_active',
                                    event.target.checked,
                                  )
                                }
                                disabled={savingId === profile.id}
                              />
                              <span>{draft.captain_subscription_active ? 'Active' : 'Inactive'}</span>
                            </label>
                          </td>
                          <td>
                            <select
                              value={draft.captain_subscription_status}
                              onChange={(event) =>
                                updateProfileField(
                                  profile.id,
                                  'captain_subscription_status',
                                  event.target.value as CaptainSubscriptionStatus,
                                )
                              }
                              className="select"
                              style={{ width: '100%', maxWidth: 140, minWidth: 0 }}
                              disabled={savingId === profile.id}
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <label style={toggleWrap}>
                              <input
                                type="checkbox"
                                checked={draft.tiq_team_league_entry_enabled}
                                onChange={(event) =>
                                  updateProfileField(
                                    profile.id,
                                    'tiq_team_league_entry_enabled',
                                    event.target.checked,
                                  )
                                }
                                disabled={savingId === profile.id}
                              />
                              <span>
                                {draft.tiq_team_league_entry_enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </label>
                          </td>
                          <td>
                            <label style={toggleWrap}>
                              <input
                                type="checkbox"
                                checked={draft.tiq_individual_league_creator_enabled}
                                onChange={(event) =>
                                  updateProfileField(
                                    profile.id,
                                    'tiq_individual_league_creator_enabled',
                                    event.target.checked,
                                  )
                                }
                                disabled={savingId === profile.id}
                              />
                              <span>
                                {draft.tiq_individual_league_creator_enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </label>
                          </td>
                          <td>
                            <div style={supportActionStackStyle}>
                              <button
                                type="button"
                                onClick={() => void saveProfile(profile)}
                                className="button-secondary"
                                style={{
                                  minHeight: 40,
                                  padding: '0 14px',
                                  opacity: savingId === profile.id || !dirty ? 0.7 : 1,
                                  cursor:
                                    savingId === profile.id || !dirty ? 'not-allowed' : 'pointer',
                                }}
                                disabled={savingId === profile.id || !dirty}
                              >
                                {savingId === profile.id ? 'Saving...' : 'Save access'}
                              </button>
                              <button
                                type="button"
                                className="button-ghost"
                                style={supportActionButtonStyle}
                                onClick={() => setExpandedProfileId(expanded ? null : profile.id)}
                              >
                                {expanded ? 'Hide billing' : 'Billing details'}
                              </button>
                              <button
                                type="button"
                                className="button-ghost"
                                style={supportActionButtonStyle}
                                onClick={() => void copySupportValue('User ID', profile.id)}
                              >
                                Copy user
                              </button>
                              <button
                                type="button"
                                className="button-ghost"
                                style={supportActionButtonStyle}
                                onClick={() => void copySupportValue('Stripe customer ID', profile.stripe_customer_id)}
                              >
                                Copy customer
                              </button>
                              <button
                                type="button"
                                className="button-ghost"
                                style={supportActionButtonStyle}
                                onClick={() => void copySupportValue('Stripe subscription ID', profile.stripe_subscription_id)}
                              >
                                Copy sub
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr>
                            <td colSpan={12} style={supportDetailCellStyle}>
                              <SupportBillingDetails
                                profile={profile}
                                latestEvent={latestStripeEvent}
                                convertedRequest={convertedRequestsByUser[profile.id] ?? null}
                                audit={audit}
                              />
                            </td>
                          </tr>
                        ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AdminReviewPanel>
        </AdminReviewFrame>
      </AdminGate>
    </SiteShell>
  )
}

function normalizePricingPlanId(value: string | null | undefined): PricingPlanId | null {
  if (
    value === 'free' ||
    value === 'player_plus' ||
    value === 'coach' ||
    value === 'captain' ||
    value === 'league' ||
    value === 'full_court'
  ) {
    return value
  }

  return null
}

function normalizeSubscriptionStatus(value: string | null | undefined): CaptainSubscriptionStatus | null {
  return STATUS_OPTIONS.includes(value as CaptainSubscriptionStatus)
    ? (value as CaptainSubscriptionStatus)
    : null
}

function normalizeStripeBillingEventOutcome(value: string | null | undefined) {
  if (value === 'handled' || value === 'ignored' || value === 'error') return value
  return 'ignored'
}

function hasSubscriptionStatus(profile: ProfileAccessRow, status: CaptainSubscriptionStatus) {
  return (
    profile.player_plus_subscription_status === status ||
    profile.coach_subscription_status === status ||
    profile.captain_subscription_status === status
  )
}

function matchesBillingFilter(
  profile: ProfileAccessRow,
  latestEvent: StripeBillingEvent | null,
  billingFilter: BillingFilter,
) {
  if (billingFilter === 'all') return true
  if (billingFilter === 'stripe') return Boolean(profile.stripe_customer_id || profile.stripe_subscription_id)
  if (billingFilter === 'manual') return !profile.stripe_customer_id && !profile.stripe_subscription_id
  if (billingFilter === 'past_due') {
    return hasSubscriptionStatus(profile, 'past_due') || latestEvent?.resultingStatus === 'past_due'
  }
  if (billingFilter === 'canceled') {
    return hasSubscriptionStatus(profile, 'canceled') || latestEvent?.resultingStatus === 'canceled'
  }
  if (billingFilter === 'webhook_error') return latestEvent?.outcome === 'error'
  if (billingFilter === 'webhook_ignored') return latestEvent?.outcome === 'ignored'

  return true
}

function hasCloudLinkedPlayer(profile: ProfileAccessRow) {
  return Boolean(profile.linked_player_id || profile.linked_player_name)
}

function matchesProfileLinkFilter(profile: ProfileAccessRow, profileLinkFilter: ProfileLinkFilter) {
  if (profileLinkFilter === 'all') return true

  const hasCloudLink = hasCloudLinkedPlayer(profile)
  const hasDisplayName = Boolean(profile.message_display_name)

  if (profileLinkFilter === 'cloud') return hasCloudLink
  if (profileLinkFilter === 'display_only') return !hasCloudLink && hasDisplayName
  if (profileLinkFilter === 'missing') return !hasCloudLink && !hasDisplayName

  return true
}

function getProfileLinkStatus(profile: ProfileAccessRow) {
  if (hasCloudLinkedPlayer(profile)) {
    return {
      label: 'Cloud linked',
      detail:
        profile.linked_team_name || profile.linked_league_name || profile.linked_flight
          ? 'Team context saved'
          : 'Player saved',
      badgeClass: 'badge-green',
    }
  }

  if (profile.message_display_name) {
    return {
      label: 'Display only',
      detail: 'No linked player field',
      badgeClass: 'badge-blue',
    }
  }

  return {
    label: 'Missing',
    detail: 'Set Profile',
    badgeClass: 'badge-slate',
  }
}

function formatEventTime(value: string) {
  if (!value) return ''

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function toEntitlementSnapshot(draft: EditableProfileAccess): ProductEntitlementSnapshot {
  return {
    playerPlusSubscriptionActive: draft.player_plus_subscription_active,
    playerPlusSubscriptionStatus: draft.player_plus_subscription_status,
    coachSubscriptionActive: draft.coach_subscription_active,
    coachSubscriptionStatus: draft.coach_subscription_status,
    captainSubscriptionActive: draft.captain_subscription_active,
    captainSubscriptionStatus: draft.captain_subscription_status,
    tiqTeamLeagueEntryEnabled: draft.tiq_team_league_entry_enabled,
    tiqIndividualLeagueCreatorEnabled: draft.tiq_individual_league_creator_enabled,
  }
}

function buildAccessAudit(
  role: UserRole,
  draft: EditableProfileAccess,
  lastConvertedRequest: ConvertedUpgradeRequest | null,
): AccessAudit {
  const access = buildProductAccessState(role, toEntitlementSnapshot(draft))
  const activePaidPlans = access.activePlanIds.filter((planId) => planId !== 'free')
  const sources: string[] = []
  const warnings: string[] = []

  if (role === 'admin') {
    sources.push('Admin role grants every workspace.')
  } else if (role === 'captain') {
    sources.push('Captain role grants Player and Captain.')
  }

  if (draft.player_plus_subscription_active) {
    sources.push(`Player flag is ${draft.player_plus_subscription_status}.`)
  }

  if (draft.coach_subscription_active) {
    sources.push(`Coach flag is ${draft.coach_subscription_status}.`)
  }

  if (draft.captain_subscription_active) {
    sources.push(`Captain flag is ${draft.captain_subscription_status}.`)
  }

  if (draft.tiq_team_league_entry_enabled && draft.tiq_individual_league_creator_enabled) {
    sources.push('League Office flags are enabled.')
  } else if (draft.tiq_team_league_entry_enabled) {
    sources.push('Team League Office flag is enabled.')
  } else if (draft.tiq_individual_league_creator_enabled) {
    sources.push('Individual League Office flag is enabled.')
  }

  if (lastConvertedRequest) {
    sources.push(`Last converted checkout was ${formatPlanLabel(lastConvertedRequest.planId)}.`)
  }

  if (lastConvertedRequest?.planId === 'player_plus' && access.canUseCaptainWorkflow) {
    warnings.push('Review: Player checkout currently has Captain access.')
  }

  if (lastConvertedRequest?.planId === 'player_plus' && access.canUseCoachWorkflow) {
    warnings.push('Review: Player checkout currently has Coach access.')
  }

  if (lastConvertedRequest?.planId === 'player_plus' && access.canUseLeagueTools) {
    warnings.push('Review: Player checkout currently has League Office access.')
  }

  if (lastConvertedRequest?.planId === 'coach' && access.canUseCaptainWorkflow) {
    warnings.push('Review: Coach checkout currently has Captain access.')
  }

  if (lastConvertedRequest?.planId === 'coach' && access.canUseLeagueTools) {
    warnings.push('Review: Coach checkout currently has League Office access.')
  }

  if (lastConvertedRequest?.planId === 'captain' && access.canUseLeagueTools) {
    warnings.push('Review: Captain checkout currently has League Office access.')
  }

  if (lastConvertedRequest?.planId === 'league' && access.canUseAdvancedPlayerInsights && role !== 'admin') {
    warnings.push('Review: League Office checkout currently has Player access.')
  }

  return {
    currentPlan: formatPlanLabel(access.currentPlanId),
    activePlans: activePaidPlans.length
      ? activePaidPlans.map(formatPlanLabel).join(', ')
      : 'Free only',
    sources: sources.length ? sources : ['No paid entitlement flags are active.'],
    warnings,
    lastConvertedRequest,
  }
}

function formatPlanLabel(planId: PricingPlanId) {
  if (planId === 'player_plus') return 'Player'
  if (planId === 'coach') return 'Coach'
  if (planId === 'captain') return 'Captain'
  if (planId === 'league') return 'League Office'
  if (planId === 'full_court') return 'Full-Court'
  return 'Free'
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
    </div>
  )
}

function MetricCard({
  label,
  value,
  active = false,
  onClick,
}: {
  label: string
  value: number
  active?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={`metric-card metric-card-button${active ? ' metric-card-active' : ''}`}
        onClick={onClick}
        aria-pressed={active}
      >
        {content}
      </button>
    )
  }

  return (
    <div className="metric-card">
      {content}
    </div>
  )
}

function SupportBillingDetails({
  profile,
  latestEvent,
  convertedRequest,
  audit,
}: {
  profile: ProfileAccessRow
  latestEvent: StripeBillingEvent | null
  convertedRequest: ConvertedUpgradeRequest | null
  audit: AccessAudit
}) {
  const billingStatus =
    latestEvent?.resultingStatus ||
    profile.coach_subscription_status ||
    profile.captain_subscription_status ||
    profile.player_plus_subscription_status ||
    'inactive'

  return (
    <div style={supportDetailPanelStyle}>
      <div>
        <div className="section-kicker">Billing support detail</div>
        <h3 style={supportDetailTitleStyle}>{compactUserId(profile.id)}</h3>
        <p style={supportDetailTextStyle}>
          Current result: {audit.currentPlan}. Billing status: {billingStatus}.
        </p>
      </div>
      <div style={supportDetailGridStyle}>
        <SupportDetailItem label="User ID" value={profile.id} />
        <SupportDetailItem label="Stripe customer" value={profile.stripe_customer_id || 'Not linked'} />
        <SupportDetailItem label="Stripe subscription" value={profile.stripe_subscription_id || 'Not linked'} />
        <SupportDetailItem label="Player status" value={`${profile.player_plus_subscription_active ? 'active' : 'inactive'} / ${profile.player_plus_subscription_status || 'inactive'}`} />
        <SupportDetailItem label="Coach status" value={`${profile.coach_subscription_active ? 'active' : 'inactive'} / ${profile.coach_subscription_status || 'inactive'}`} />
        <SupportDetailItem label="Captain status" value={`${profile.captain_subscription_active ? 'active' : 'inactive'} / ${profile.captain_subscription_status || 'inactive'}`} />
        <SupportDetailItem label="Profile link" value={getProfileLinkStatus(profile).label} />
        <SupportDetailItem label="Player fields" value={`${profile.linked_player_id ? 'id' : 'no id'} / ${profile.linked_player_name ? 'name' : 'no name'}`} />
        <SupportDetailItem label="Team context" value={profile.linked_team_name || profile.linked_league_name || profile.linked_flight ? 'Present' : 'Missing'} />
        <SupportDetailItem label="Display name" value={profile.message_display_name ? 'Present' : 'Missing'} />
        <SupportDetailItem label="Converted checkout" value={convertedRequest ? `${formatPlanLabel(convertedRequest.planId)} / ${formatEventTime(convertedRequest.changedAt)}` : 'None found'} />
      </div>
      <div style={supportEventPanelStyle}>
        <div style={supportDetailLabelStyle}>Latest Stripe event</div>
        {latestEvent ? (
          <div style={supportEventGridStyle}>
            <SupportDetailItem label="Outcome" value={latestEvent.outcome} />
            <SupportDetailItem label="Type" value={latestEvent.eventType || 'Unknown'} />
            <SupportDetailItem label="Event ID" value={latestEvent.eventId || 'Missing'} />
            <SupportDetailItem label="Plan" value={latestEvent.planId ? formatPlanLabel(latestEvent.planId) : 'None'} />
            <SupportDetailItem label="Result" value={latestEvent.resultingStatus || 'None'} />
            <SupportDetailItem label="Time" value={formatEventTime(latestEvent.createdAt) || 'Unknown'} />
            <div style={supportEventMessageStyle}>
              {latestEvent.message || 'No event message recorded.'}
            </div>
          </div>
        ) : (
          <p style={supportDetailTextStyle}>No Stripe webhook audit event has been recorded for this profile yet.</p>
        )}
      </div>
    </div>
  )
}

function SupportDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={supportDetailItemStyle}>
      <span style={supportDetailLabelStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ProfileLinkCell({ profile }: { profile: ProfileAccessRow }) {
  const status = getProfileLinkStatus(profile)

  return (
    <div style={profileLinkCellStyle}>
      <span className={`badge ${status.badgeClass}`}>{status.label}</span>
      <span className="subtle-text">{status.detail}</span>
    </div>
  )
}

function StripeBillingCell({
  profile,
  latestEvent,
}: {
  profile: ProfileAccessRow
  latestEvent: StripeBillingEvent | null
}) {
  const customerId = compactStripeId(profile.stripe_customer_id)
  const subscriptionId = compactStripeId(profile.stripe_subscription_id)

  if (!customerId && !subscriptionId) {
    return (
      <div style={stripeBillingCellStyle}>
        <span className="subtle-text">Manual or role-based</span>
        <StripeBillingEventCue latestEvent={latestEvent} />
      </div>
    )
  }

  return (
    <div style={stripeBillingCellStyle}>
      {customerId ? (
        <span style={stripeBillingIdStyle} title={profile.stripe_customer_id ?? undefined}>
          Customer {customerId}
        </span>
      ) : null}
      {subscriptionId ? (
        <span style={stripeBillingIdStyle} title={profile.stripe_subscription_id ?? undefined}>
          Subscription {subscriptionId}
        </span>
      ) : null}
      <StripeBillingEventCue latestEvent={latestEvent} />
    </div>
  )
}

function StripeBillingEventCue({ latestEvent }: { latestEvent: StripeBillingEvent | null }) {
  if (!latestEvent) return null

  const pieces = [
    latestEvent.eventType,
    latestEvent.resultingStatus,
    latestEvent.planId ? formatPlanLabel(latestEvent.planId) : '',
    formatEventTime(latestEvent.createdAt),
  ].filter(Boolean)

  return (
    <span
      style={
        latestEvent.outcome === 'error'
          ? stripeBillingErrorEventStyle
          : latestEvent.outcome === 'handled'
            ? stripeBillingHandledEventStyle
            : stripeBillingIgnoredEventStyle
      }
      title={[latestEvent.eventId, latestEvent.message].filter(Boolean).join(' - ') || undefined}
    >
      Last Stripe event: {pieces.join(' / ')}
    </span>
  )
}

const handoffPanelStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap',
  marginTop: 18,
  padding: 16,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
} as const

const handoffTitleStyle = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.12,
  fontWeight: 950,
} as const

const handoffTextStyle = {
  margin: '7px 0 0',
  maxWidth: 680,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 750,
} as const

const handoffActionStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
} as const

const supportActionStackStyle = {
  display: 'grid',
  gap: 8,
  width: '100%',
  maxWidth: 150,
  minWidth: 0,
} as const

const supportActionButtonStyle = {
  minHeight: 34,
  padding: '0 10px',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  border: '1px solid var(--shell-panel-border)',
} as const

const supportDetailCellStyle = {
  padding: '12px 16px 18px',
  background: 'color-mix(in srgb, var(--surface) 82%, var(--shell-panel-bg) 18%)',
} as const

const supportDetailPanelStyle = {
  display: 'grid',
  gap: 14,
  padding: 16,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-blue) 24%, var(--shell-panel-border) 76%)',
  background: 'var(--shell-panel-bg)',
} as const

const supportDetailTitleStyle = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.12,
  fontWeight: 950,
} as const

const supportDetailTextStyle = {
  margin: '6px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 750,
} as const

const supportDetailGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
} as const

const supportDetailItemStyle = {
  display: 'grid',
  gap: 5,
  padding: 10,
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const supportDetailLabelStyle = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
} as const

const supportEventPanelStyle = {
  display: 'grid',
  gap: 9,
  padding: 12,
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-green) 6%, var(--shell-chip-bg) 94%)',
} as const

const supportEventGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
} as const

const supportEventMessageStyle = {
  ...supportDetailItemStyle,
  gridColumn: '1 / -1',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.5,
} as const

const accessResultWrapStyle = {
  display: 'grid',
  gap: 8,
  width: '100%',
  maxWidth: 180,
  minWidth: 0,
} as const

const auditReasonWrapStyle = {
  display: 'grid',
  gap: 6,
  width: '100%',
  maxWidth: 260,
  minWidth: 0,
} as const

const auditReasonStyle = {
  color: 'var(--foreground)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 750,
} as const

const auditWarningStyle = {
  ...auditReasonStyle,
  color: '#fde68a',
} as const

const stripeBillingCellStyle = {
  display: 'grid',
  gap: 6,
  width: '100%',
  maxWidth: 220,
  minWidth: 0,
} as const

const profileLinkCellStyle = {
  display: 'grid',
  gap: 6,
  width: '100%',
  maxWidth: 180,
  minWidth: 0,
} as const

const stripeBillingIdStyle = {
  color: 'var(--foreground)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 800,
  fontFamily: 'var(--font-geist-mono)',
} as const

const stripeBillingEventStyle = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 750,
} as const

const stripeBillingHandledEventStyle = {
  ...stripeBillingEventStyle,
  color: '#bbf7d0',
} as const

const stripeBillingIgnoredEventStyle = {
  ...stripeBillingEventStyle,
  color: 'var(--shell-copy-muted)',
} as const

const stripeBillingErrorEventStyle = {
  ...stripeBillingEventStyle,
  color: '#fca5a5',
} as const

const toggleWrap = {
  display: 'inline-flex',
  gap: 8,
  alignItems: 'center',
  color: 'var(--foreground)',
  fontWeight: 700,
} as const
