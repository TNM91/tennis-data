'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  AdminEmptyState,
  AdminReviewFrame,
  AdminReviewHero,
  AdminReviewPanel,
  AdminStatusPanel,
  adminReviewHeaderRowStyle,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '@/lib/supabase'
import {
  PRODUCT_USAGE_EVENT_SURFACES,
  type ProductUsageEventName,
  type ProductUsageEventSurface,
} from '@/lib/product-usage-events'
import type { PricingPlanId } from '@/lib/pricing-plans'

type ProductUsageEventRow = {
  id: string
  user_id: string
  event_name: ProductUsageEventName
  surface: ProductUsageEventSurface
  plan_id: PricingPlanId | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type EventFilter = 'all' | ProductUsageEventSurface | 'profile_sync_repairs' | 'profile_sync_attention'
type ProfileSyncReviewStatus = 'open' | 'reviewed'
type ProfileSyncReviewRow = {
  event_id?: string | null
  status?: string | null
  review_note?: string | null
  reviewed_by_user_id?: string | null
  reviewed_at?: string | null
  updated_at?: string | null
}
type ProfileSyncReview = {
  eventId: string
  status: ProfileSyncReviewStatus
  reviewNote: string
  reviewedByUserId: string
  reviewedAt: string
  updatedAt: string
}

const PROFILE_SYNC_EVENT_FILTERS = ['profile_sync_repairs', 'profile_sync_attention'] as const

function normalizeEventFilter(value: string | null): EventFilter {
  if (!value || value === 'all') return 'all'
  if (PRODUCT_USAGE_EVENT_SURFACES.includes(value as ProductUsageEventSurface)) {
    return value as ProductUsageEventSurface
  }
  if (PROFILE_SYNC_EVENT_FILTERS.includes(value as (typeof PROFILE_SYNC_EVENT_FILTERS)[number])) {
    return value as EventFilter
  }
  return 'all'
}

function setQueryParam(params: URLSearchParams, key: string, value: string, defaultValue = '') {
  if (!value || value === defaultValue) {
    params.delete(key)
  } else {
    params.set(key, value)
  }
}

export default function AdminProductEventsPage() {
  const [events, setEvents] = useState<ProductUsageEventRow[]>([])
  const [profileSyncReviews, setProfileSyncReviews] = useState<Record<string, ProfileSyncReview>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<EventFilter>('all')
  const [search, setSearch] = useState('')
  const [urlFilterReady, setUrlFilterReady] = useState(false)
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({})
  const [savingReviewEventId, setSavingReviewEventId] = useState('')
  const deferredSearch = useDeferredValue(search)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')

    const { data, error } = await supabase
      .from('product_usage_events')
      .select('id, user_id, event_name, surface, plan_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      setError(error.message)
      setEvents([])
    } else {
      setEvents((data ?? []) as ProductUsageEventRow[])
    }

    try {
      setProfileSyncReviews(await loadProfileSyncReviews())
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not load profile sync review state.')
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      setFilter(normalizeEventFilter(params.get('filter')))
      setSearch((params.get('search') || '').slice(0, 120))
      setUrlFilterReady(true)
      void loadEvents()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadEvents])

  useEffect(() => {
    if (!urlFilterReady) return

    const params = new URLSearchParams(window.location.search)
    setQueryParam(params, 'filter', filter, 'all')
    setQueryParam(params, 'search', search.trim())

    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [filter, search, urlFilterReady])

  const filteredEvents = useMemo(() => {
    const filterSearch = (items: ProductUsageEventRow[]) =>
      items.filter((event) => eventMatchesSearch(event, deferredSearch))

    if (filter === 'all') return filterSearch(events)
    if (filter === 'profile_sync_repairs') {
      return filterSearch(events.filter((event) => event.event_name === 'profile_cloud_sync_repair'))
    }
    if (filter === 'profile_sync_attention') {
      return filterSearch(events.filter((event) => isOpenProfileSyncReviewEvent(event, profileSyncReviews)))
    }
    return filterSearch(events.filter((event) => event.surface === filter))
  }, [deferredSearch, events, filter, profileSyncReviews])

  const uniqueUsers = new Set(events.map((event) => event.user_id)).size
  const billingEvents = events.filter((event) => event.surface === 'billing').length
  const myLabEvents = events.filter((event) => event.surface === 'mylab').length
  const captainEvents = events.filter((event) => event.surface === 'captain').length
  const profileSyncRepairEvents = events.filter((event) => event.event_name === 'profile_cloud_sync_repair').length
  const openProfileSyncReviewEvents = events.filter((event) => isOpenProfileSyncReviewEvent(event, profileSyncReviews)).length
  const reviewedProfileSyncEvents = Object.values(profileSyncReviews).filter((review) => review.status === 'reviewed').length
  const latestEvent = events[0] ?? null

  async function saveProfileSyncReview(event: ProductUsageEventRow, status: ProfileSyncReviewStatus) {
    const note = (reviewDrafts[event.id] ?? profileSyncReviews[event.id]?.reviewNote ?? '').trim()
    if (status === 'reviewed' && note.length < 6) {
      setError('Add a short note before marking this sync repair reviewed.')
      return
    }

    setSavingReviewEventId(event.id)
    setError('')
    setMessage('')

    try {
      const review = await updateProfileSyncReview({
        eventId: event.id,
        status,
        reviewNote: note,
      })
      setProfileSyncReviews((current) => ({
        ...current,
        [review.eventId]: review,
      }))
      setReviewDrafts((current) => ({
        ...current,
        [event.id]: review.reviewNote,
      }))
      setMessage(status === 'reviewed' ? 'Profile sync repair marked reviewed.' : 'Profile sync repair reopened.')
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not update profile sync review.')
    } finally {
      setSavingReviewEventId('')
    }
  }

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <AdminReviewFrame>
          <AdminReviewHero kicker="Product Events" title="Paid usage signals">
            Track the first-party actions that show whether Player and Captain users are reaching the paid workflows after checkout.
          </AdminReviewHero>

          <AdminReviewPanel>
            {message ? <AdminStatusPanel tone="success" text={message} /> : null}
            <div className="metric-grid">
              <MetricCard label="Events" value={events.length} />
              <MetricCard label="Users" value={uniqueUsers} />
              <MetricCard label="Billing" value={billingEvents} />
              <MetricCard label="My Lab" value={myLabEvents} />
              <MetricCard label="Captain" value={captainEvents} />
              <MetricCard
                label="Profile Sync Repairs"
                value={profileSyncRepairEvents}
                active={filter === 'profile_sync_repairs'}
                onClick={() =>
                  setFilter((current) => current === 'profile_sync_repairs' ? 'all' : 'profile_sync_repairs')
                }
              />
              <MetricCard
                label="Sync Needs Review"
                value={openProfileSyncReviewEvents}
                active={filter === 'profile_sync_attention'}
                onClick={() =>
                  setFilter((current) => current === 'profile_sync_attention' ? 'all' : 'profile_sync_attention')
                }
              />
              <MetricCard label="Reviewed Sync Repairs" value={reviewedProfileSyncEvents} />
            </div>

            <div style={adminReviewHeaderRowStyle}>
              <div style={toolbarStyle}>
                <div>
                  <label className="label" htmlFor="product-event-filter">
                    Surface
                  </label>
                  <select
                    id="product-event-filter"
                    className="select"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as EventFilter)}
                  >
                    <option value="all">All surfaces</option>
                    <option value="billing">Billing</option>
                    <option value="profile">Profile</option>
                    <option value="profile_sync_repairs">Profile sync repairs</option>
                    <option value="profile_sync_attention">Sync needs review</option>
                    <option value="mylab">My Lab</option>
                    <option value="captain">Captain</option>
                    <option value="upgrade">Upgrade</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="product-event-search">
                    Search
                  </label>
                  <input
                    id="product-event-search"
                    className="input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value.slice(0, 120))}
                    placeholder="User id, event, plan, or metadata"
                    style={searchInputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="button-secondary" onClick={() => void loadEvents()}>
                  Refresh events
                </button>
                {latestEvent ? (
                  <span className="badge badge-blue">Latest {formatEventTime(latestEvent.created_at)}</span>
                ) : null}
              </div>
            </div>

            {error ? <AdminStatusPanel tone="error" text={error} /> : null}

            {loading ? (
              <p className="subtle-text" style={{ marginTop: 18 }}>Loading product events...</p>
            ) : filteredEvents.length === 0 ? (
              <AdminEmptyState text="No product usage events match these filters yet." />
            ) : (
              <div className="table-wrap" style={{ marginTop: 18 }}>
                <table className="data-table" style={{ width: '100%', tableLayout: 'auto' }}>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Surface</th>
                      <th>Plan</th>
                      <th>User</th>
                      <th>Metadata</th>
                      <th>Review</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        review={profileSyncReviews[event.id] || null}
                        reviewDraft={reviewDrafts[event.id] ?? profileSyncReviews[event.id]?.reviewNote ?? ''}
                        savingReview={savingReviewEventId === event.id}
                        onReviewDraftChange={(value) =>
                          setReviewDrafts((current) => ({
                            ...current,
                            [event.id]: value,
                          }))
                        }
                        onSaveReview={(status) => void saveProfileSyncReview(event, status)}
                      />
                    ))}
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

function EventRow({
  event,
  review,
  reviewDraft,
  savingReview,
  onReviewDraftChange,
  onSaveReview,
}: {
  event: ProductUsageEventRow
  review: ProfileSyncReview | null
  reviewDraft: string
  savingReview: boolean
  onReviewDraftChange: (value: string) => void
  onSaveReview: (status: ProfileSyncReviewStatus) => void
}) {
  const isProfileSyncRepair = event.event_name === 'profile_cloud_sync_repair'
  const isReviewed = review?.status === 'reviewed'
  const needsReview = isOpenProfileSyncReviewEvent(event, review ? { [review.eventId]: review } : {})

  return (
    <tr>
      <td>
        <strong style={eventNameStyle}>{formatEventName(event.event_name)}</strong>
      </td>
      <td>{event.surface}</td>
      <td>{event.plan_id ? formatPlanLabel(event.plan_id) : 'None'}</td>
      <td>
        <Link href={buildAdminAccessUserHref(event.user_id)} style={userLinkStyle}>
          {compactId(event.user_id)}
        </Link>
      </td>
      <td>
        <div style={metadataStyle}>{formatMetadata(event.metadata)}</div>
      </td>
      <td>
        {isProfileSyncRepair ? (
          <div style={reviewCellStyle}>
            <span className={isReviewed ? 'badge badge-green' : needsReview ? 'badge badge-slate' : 'badge badge-blue'}>
              {isReviewed ? 'Reviewed' : needsReview ? 'Needs review' : 'Repair logged'}
            </span>
            {isReviewed && review?.reviewedAt ? (
              <small style={reviewMetaStyle}>Reviewed {formatEventTime(review.reviewedAt)}</small>
            ) : null}
            <textarea
              value={reviewDraft}
              onChange={(changeEvent) => onReviewDraftChange(changeEvent.target.value)}
              rows={2}
              style={reviewTextAreaStyle}
              placeholder="Review note"
            />
            <div style={reviewActionStyle}>
              <Link href={buildAdminAccessUserHref(event.user_id)} className="button-secondary" style={reviewButtonLinkStyle}>
                Open access
              </Link>
              <button
                type="button"
                className="button-secondary"
                style={reviewButtonStyle}
                onClick={() => onSaveReview('reviewed')}
                disabled={savingReview}
              >
                {savingReview ? 'Saving...' : 'Mark reviewed'}
              </button>
              {isReviewed ? (
                <button
                  type="button"
                  className="button-secondary"
                  style={reviewButtonStyle}
                  onClick={() => onSaveReview('open')}
                  disabled={savingReview}
                >
                  Reopen
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <span className="subtle-text">-</span>
        )}
      </td>
      <td>{formatEventTime(event.created_at)}</td>
    </tr>
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

async function loadProfileSyncReviews() {
  const token = await getAccessToken()
  if (!token) throw new Error('Sign in as an admin to load profile sync reviews.')

  const response = await fetch('/api/profile-sync-reviews', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
  const result = (await response.json().catch(() => null)) as {
    ok?: boolean
    reviews?: ProfileSyncReviewRow[]
    message?: string
  } | null

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || 'Could not load profile sync reviews.')
  }

  return Object.fromEntries(
    (result.reviews || [])
      .map(toProfileSyncReview)
      .filter((review): review is ProfileSyncReview => Boolean(review))
      .map((review) => [review.eventId, review]),
  )
}

async function updateProfileSyncReview(input: {
  eventId: string
  status: ProfileSyncReviewStatus
  reviewNote: string
}) {
  const token = await getAccessToken()
  if (!token) throw new Error('Sign in as an admin to update profile sync reviews.')

  const response = await fetch('/api/profile-sync-reviews', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  const result = (await response.json().catch(() => null)) as {
    ok?: boolean
    review?: ProfileSyncReviewRow
    message?: string
  } | null

  if (!response.ok || !result?.ok || !result.review) {
    throw new Error(result?.message || 'Could not update profile sync review.')
  }

  const review = toProfileSyncReview(result.review)
  if (!review) throw new Error('Could not read updated profile sync review.')
  return review
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token?.trim() || ''
}

function toProfileSyncReview(row: ProfileSyncReviewRow): ProfileSyncReview | null {
  const eventId = cleanText(row.event_id)
  if (!eventId) return null

  return {
    eventId,
    status: row.status === 'reviewed' ? 'reviewed' : 'open',
    reviewNote: cleanText(row.review_note),
    reviewedByUserId: cleanText(row.reviewed_by_user_id),
    reviewedAt: cleanText(row.reviewed_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function isOpenProfileSyncReviewEvent(
  event: ProductUsageEventRow,
  reviewsByEventId: Record<string, ProfileSyncReview>,
) {
  if (event.event_name !== 'profile_cloud_sync_repair') return false
  if (reviewsByEventId[event.id]?.status === 'reviewed') return false
  return event.metadata?.result === 'failed' || event.metadata?.result === 'local_only' || event.metadata?.hasError === true
}

function eventMatchesSearch(event: ProductUsageEventRow, rawSearch: string) {
  const search = rawSearch.trim().toLowerCase()
  if (!search) return true

  return [
    event.id,
    event.user_id,
    event.event_name,
    event.surface,
    event.plan_id || '',
    formatMetadata(event.metadata),
  ].some((value) => value.toLowerCase().includes(search))
}

function compactId(value: string) {
  return value.length <= 18 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`
}

function formatEventName(value: string) {
  return value.split('_').map((piece) => piece[0]?.toUpperCase() + piece.slice(1)).join(' ')
}

function formatPlanLabel(planId: PricingPlanId) {
  if (planId === 'player_plus') return 'Player'
  if (planId === 'captain') return 'Captain'
  if (planId === 'league') return 'League Office'
  return 'Free'
}

function formatMetadata(metadata: Record<string, unknown> | null) {
  const entries = Object.entries(metadata ?? {}).slice(0, 6)
  if (!entries.length) return 'None'
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' / ')
}

function formatEventTime(value: string) {
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

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function buildAdminAccessUserHref(userId: string) {
  return `/admin/access?search=${encodeURIComponent(userId)}`
}

const toolbarStyle = {
  display: 'flex',
  alignItems: 'end',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 18,
} as const

const searchInputStyle = {
  width: 'min(100%, 320px)',
} as const

const eventNameStyle = {
  color: 'var(--foreground-strong)',
} as const

const monoStyle = {
  fontFamily: 'var(--font-geist-mono)',
  color: 'var(--foreground)',
} as const

const userLinkStyle = {
  ...monoStyle,
  textDecoration: 'none',
  fontWeight: 800,
} as const

const metadataStyle = {
  maxWidth: 420,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
} as const

const reviewCellStyle = {
  minWidth: 230,
  display: 'grid',
  gap: 8,
} as const

const reviewMetaStyle = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
} as const

const reviewTextAreaStyle = {
  width: '100%',
  minHeight: 58,
  borderRadius: 10,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: 9,
  lineHeight: 1.4,
  resize: 'vertical' as const,
  colorScheme: 'dark' as const,
} as const

const reviewActionStyle = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
} as const

const reviewButtonStyle = {
  minHeight: 30,
  padding: '6px 9px',
  fontSize: 12,
} as const

const reviewButtonLinkStyle = {
  ...reviewButtonStyle,
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
} as const
