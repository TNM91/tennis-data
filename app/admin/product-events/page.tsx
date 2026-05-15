'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { ProductUsageEventName, ProductUsageEventSurface } from '@/lib/product-usage-events'
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

type EventFilter = 'all' | ProductUsageEventSurface

export default function AdminProductEventsPage() {
  const [events, setEvents] = useState<ProductUsageEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<EventFilter>('all')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')

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

    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadEvents()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadEvents])

  const filteredEvents = useMemo(() => (
    filter === 'all' ? events : events.filter((event) => event.surface === filter)
  ), [events, filter])

  const uniqueUsers = new Set(events.map((event) => event.user_id)).size
  const billingEvents = events.filter((event) => event.surface === 'billing').length
  const myLabEvents = events.filter((event) => event.surface === 'mylab').length
  const captainEvents = events.filter((event) => event.surface === 'captain').length
  const latestEvent = events[0] ?? null

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <AdminReviewFrame>
          <AdminReviewHero kicker="Product Events" title="Paid usage signals">
            Track the first-party actions that show whether Player and Captain users are reaching the paid workflows after checkout.
          </AdminReviewHero>

          <AdminReviewPanel>
            <div className="metric-grid">
              <MetricCard label="Events" value={events.length} />
              <MetricCard label="Users" value={uniqueUsers} />
              <MetricCard label="Billing" value={billingEvents} />
              <MetricCard label="My Lab" value={myLabEvents} />
              <MetricCard label="Captain" value={captainEvents} />
            </div>

            <div style={adminReviewHeaderRowStyle}>
              <div style={toolbarStyle}>
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
                  <option value="mylab">My Lab</option>
                  <option value="captain">Captain</option>
                  <option value="upgrade">Upgrade</option>
                </select>
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
              <AdminEmptyState text="No product usage events match this filter yet." />
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
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <strong style={eventNameStyle}>{formatEventName(event.event_name)}</strong>
                        </td>
                        <td>{event.surface}</td>
                        <td>{event.plan_id ? formatPlanLabel(event.plan_id) : 'None'}</td>
                        <td>
                          <span style={monoStyle}>{compactId(event.user_id)}</span>
                        </td>
                        <td>
                          <div style={metadataStyle}>{formatMetadata(event.metadata)}</div>
                        </td>
                        <td>{formatEventTime(event.created_at)}</td>
                      </tr>
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
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
  if (planId === 'league') return 'Coordinator'
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

const toolbarStyle = {
  display: 'flex',
  alignItems: 'end',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 18,
} as const

const eventNameStyle = {
  color: 'var(--foreground-strong)',
} as const

const monoStyle = {
  fontFamily: 'var(--font-geist-mono)',
  color: 'var(--foreground)',
} as const

const metadataStyle = {
  maxWidth: 420,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
} as const
