'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import {
  AdminReviewFrame,
  AdminReviewHero,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { supabase } from '@/lib/supabase'
import { MEMBERSHIP_TIER_ORDER, MEMBERSHIP_TIERS } from '@/lib/product-story'
import type { AccountHealthKey, AccountTierSummary } from '@/lib/admin-account-tiers'
import type { BusinessPulse } from '@/lib/admin-business-pulse'
import { buildAdminMonthCsvExport } from '@/lib/admin-business-pulse-export'

type Accent = 'blue' | 'green' | 'slate'

type AdminTool = {
  title: string
  href: string
  description: string
  badge: string
  accent: Accent
  icon: TiqFeatureIconName
  highlights: string[]
  statLabel: string
  statValue: string
}

const adminTools: AdminTool[] = [
  {
    title: 'Admin Import Center',
    href: '/admin/import',
    description: 'Fix a schedule, roster, or scorecard import after review.',
    badge: 'Fallback',
    accent: 'green',
    icon: 'reports',
    highlights: ['Reviewed files', 'Manual paste', 'Preview warnings', 'Commit control'],
    statLabel: 'Best for',
    statValue: 'Corrections',
  },
  {
    title: 'Upload Review Queue',
    href: '/admin/import-queue',
    description: 'Approve or reject uploads that need a person.',
    badge: 'Review',
    accent: 'blue',
    icon: 'accountSecurity',
    highlights: ['Pending uploads', 'Review handoff', 'Reject + process states', 'Fallback workflow'],
    statLabel: 'Best for',
    statValue: 'Needs review',
  },
  {
    title: 'Data Assist Review',
    href: '/admin/data-assist',
    description: 'Review community uploads before they change trusted data.',
    badge: 'Data Assist',
    accent: 'green',
    icon: 'reports',
    highlights: ['Upload batches', 'Layout confidence', 'Review boundary', 'Import lock'],
    statLabel: 'Best for',
    statValue: 'Community uploads',
  },
  {
    title: 'TennisRecord Backfill',
    href: '/admin/tennisrecord',
    description: 'Monitor the live historical import, source safety cooldowns, and data coverage.',
    badge: 'Live import',
    accent: 'green',
    icon: 'reports',
    highlights: ['Live progress', 'Safety cooldowns', 'Local data wins', 'Run metrics'],
    statLabel: 'Best for',
    statValue: 'Import health',
  },
  {
    title: 'Match Accuracy Reports',
    href: '/admin/match-reports',
    description: 'Resolve reported match errors and uploader trust issues.',
    badge: 'Data Quality',
    accent: 'blue',
    icon: 'matchupAnalysis',
    highlights: ['Player reports', 'Admin action queue', 'Uploader trust switch', 'Correction notes'],
    statLabel: 'Best for',
    statValue: 'Accuracy',
  },
  {
    title: 'Missing Scorecards',
    href: '/admin/missing-scorecards',
    description: 'Find scheduled matches that still need a scorecard.',
    badge: 'Operations',
    accent: 'green',
    icon: 'schedule',
    highlights: ['Past due queue', 'League + team filters', 'Import handoff'],
    statLabel: 'Best for',
    statValue: 'Weekly ops',
  },
  {
    title: 'Lineup Availability',
    href: '/admin/lineup-availability',
    description: 'Check saved availability when captains need support.',
    badge: 'Support',
    accent: 'slate',
    icon: 'reliabilityIndex',
    highlights: ['Availability audit', 'Roster support', 'Lineup readiness'],
    statLabel: 'Best for',
    statValue: 'Weekly support',
  },
  {
    title: 'Add Match',
    href: '/admin/add-match',
    description: 'Create or correct one match.',
    badge: 'Manual',
    accent: 'blue',
    icon: 'reports',
    highlights: ['Single entry', 'Controlled workflow', 'Precise edits'],
    statLabel: 'Best for',
    statValue: 'One-off records',
  },
  {
    title: 'Manage Matches',
    href: '/admin/manage-matches',
    description: 'Find, edit, or remove match records.',
    badge: 'Control',
    accent: 'green',
    icon: 'matchupAnalysis',
    highlights: ['Match cleanup', 'Record review', 'Operational oversight'],
    statLabel: 'Best for',
    statValue: 'Match hygiene',
  },
  {
    title: 'Venue Addresses',
    href: '/admin/venue-locations',
    description: 'Verify playing addresses suggested by players and captains.',
    badge: 'Data Quality',
    accent: 'green',
    icon: 'clubTennis',
    highlights: ['Official sources', 'City and state', 'Safe calendar locations'],
    statLabel: 'Best for',
    statValue: 'Address reviews',
  },
  {
    title: 'Club Accounts',
    href: '/admin/clubs',
    description: 'Find, review, or permanently remove club workspaces.',
    badge: 'Clubs',
    accent: 'green',
    icon: 'clubTennis',
    highlights: ['Club search', 'Membership count', 'Safe deletion'],
    statLabel: 'Best for',
    statValue: 'Club upkeep',
  },
  {
    title: 'Stripe Promotions',
    href: '/admin/promotions',
    description: 'Create private checkout offers, set their duration, and see live Stripe redemption totals.',
    badge: 'Billing',
    accent: 'green',
    icon: 'accountSecurity',
    highlights: ['Plan-specific codes', 'Timed discounts', 'Redemption totals', 'Safe end control'],
    statLabel: 'Best for',
    statValue: 'Offers',
  },
  {
    title: 'Access Control',
    href: '/admin/access',
    description:
      'Manage Player, Coach, Captain, and League Office entitlement flags, including temporary promotional access with end dates, so monetization and league access stay explicit.',
    badge: 'Access',
    accent: 'blue',
    icon: 'accountSecurity',
    highlights: ['Timed promos', 'Coach subscription', 'Captain subscription', 'League access'],
    statLabel: 'Best for',
    statValue: 'Access control',
  },
  {
    title: 'Upgrade Requests',
    href: '/admin/upgrade-requests',
    description: 'Follow up on plan interest. Requests are not paid subscriptions or signup approvals.',
    badge: 'Leads',
    accent: 'green',
    icon: 'myLab',
    highlights: ['Plan intent', 'Support follow-up', 'Account activation', 'Request status'],
    statLabel: 'Best for',
    statValue: 'Upgrade ops',
  },
  {
    title: 'Product Events',
    href: '/admin/product-events',
    description: 'Find activation, sync, and usage events needing follow-up.',
    badge: 'Analytics',
    accent: 'blue',
    icon: 'playerRatings',
    highlights: ['Billing opens', 'Player activation', 'Sync repairs', 'Captain closeout'],
    statLabel: 'Best for',
    statValue: 'Activation health',
  },
  {
    title: 'Growth Funnel',
    href: '/admin/growth',
    description: 'See signup requests, checkout starts, and paid activations in one clear conversion path.',
    badge: 'Growth',
    accent: 'blue',
    icon: 'reliabilityIndex',
    highlights: ['Signup signals', 'Checkout starts', 'Paid activation', 'Next decision'],
    statLabel: 'Best for',
    statValue: 'Conversion',
  },
  {
    title: 'Backups',
    href: '/admin/backups',
    description: 'Run and verify a private encrypted production backup.',
    badge: 'Safety',
    accent: 'slate',
    icon: 'accountSecurity',
    highlights: ['Copy-ready prompt', 'Drive handoff', 'Checksum verification', 'Weekly routine'],
    statLabel: 'Best for',
    statValue: 'Recovery readiness',
  },
  {
    title: 'Manage Players',
    href: '/admin/manage-players',
    description: 'Update player records, ratings, and metadata.',
    badge: 'Roster',
    accent: 'slate',
    icon: 'playerRatings',
    highlights: ['Player editing', 'Ratings upkeep', 'Metadata control'],
    statLabel: 'Best for',
    statValue: 'Player upkeep',
  },
  {
    title: 'TIQ Team Matches',
    href: '/admin/tiq-team-matches',
    description: 'Create team events and enter line-by-line results.',
    badge: 'TIQ',
    accent: 'green',
    icon: 'teamRankings',
    highlights: ['Team events', 'Line entry', 'Auto rating sync', 'Singles + doubles'],
    statLabel: 'Best for',
    statValue: 'Team leagues',
  },
  {
    title: 'Duplicate Players',
    href: '/admin/deduplicate',
    description: 'Merge duplicate players without losing match history.',
    badge: 'Data quality',
    accent: 'slate',
    icon: 'playerRatings',
    highlights: ['Edit-distance detection', 'Match reassignment', 'Safe merge flow'],
    statLabel: 'Best for',
    statValue: 'Player hygiene',
  },
  {
    title: 'Anomaly Scanner',
    href: '/admin/anomalies',
    description: 'Find suspicious scores, gaps, and duplicate matches.',
    badge: 'Data quality',
    accent: 'slate',
    icon: 'opponentScouting',
    highlights: ['Extreme mismatches', 'Missing scores', 'Duplicate detection'],
    statLabel: 'Best for',
    statValue: 'Data integrity',
  },
]

const toolGroups = [
  {
    kicker: 'Accounts',
    title: 'People & plans',
    subtitle: 'Find an account, check access, and understand growth.',
    hrefs: ['/admin/access', '/admin/growth', '/admin/clubs', '/admin/promotions'],
  },
  {
    kicker: 'Tennis data',
    title: 'Review & repair',
    subtitle: 'Handle uploads and match records that need attention.',
    hrefs: ['/admin/data-assist', '/admin/import-queue', '/admin/match-reports', '/admin/missing-scorecards'],
  },
] as const

const primaryToolHrefs = new Set<string>(toolGroups.flatMap((group) => [...group.hrefs]))
const moreAdminTools = adminTools.filter((tool) => !primaryToolHrefs.has(tool.href))

function accentStyles(accent: Accent) {
  if (accent === 'green') {
    return {
      border: 'rgba(155,225,29,0.18)',
      softBorder: 'rgba(155,225,29,0.12)',
      badgeClass: 'badge badge-green',
      chipBg: 'rgba(155,225,29,0.10)',
      chipBorder: 'rgba(155,225,29,0.15)',
      chipText: '#C8F56B',
      shadow: '0 28px 60px rgba(31, 58, 18, 0.20)',
    }
  }

  if (accent === 'slate') {
    return {
      border: 'rgba(148,163,184,0.18)',
      softBorder: 'rgba(148,163,184,0.12)',
      badgeClass: 'badge badge-slate',
      chipBg: 'rgba(148,163,184,0.10)',
      chipBorder: 'rgba(148,163,184,0.16)',
      chipText: '#D7E2F2',
      shadow: '0 28px 60px rgba(15, 23, 42, 0.24)',
    }
  }

  return {
    border: 'rgba(116,190,255,0.18)',
    softBorder: 'rgba(116,190,255,0.12)',
    badgeClass: 'badge badge-blue',
    chipBg: 'rgba(74,163,255,0.10)',
    chipBorder: 'rgba(74,163,255,0.16)',
    chipText: '#BFE1FF',
    shadow: '0 28px 60px rgba(17, 53, 88, 0.22)',
  }
}

export default function AdminDashboardPage() {
  return (
    <SiteShell active="/admin">
      <AdminGate>
        <AdminReviewFrame>
        <AdminReviewHero
          kicker="Admin"
          title="Run TenAceIQ"
          actions={
            <>
              <Link href="/admin/access" className="button-primary">Find an account</Link>
              <Link href="/admin/data-assist" className="button-secondary">Review uploads</Link>
            </>
          }
        >
          See account access at a glance, then open the work that needs you.
        </AdminReviewHero>
        <AccountTiersPanel />
        <BusinessPulsePanel />

        {toolGroups.map((group) => (
          <section key={group.title} style={{ marginTop: 24 }}>
            <SectionHeader kicker={group.kicker} title={group.title} subtitle={group.subtitle} />
            <div className="admin-tool-grid" style={adminToolGridStyle}>
              {group.hrefs.map((href) => {
                const tool = adminTools.find((item) => item.href === href)
                return tool ? <AdminToolCard key={href} tool={tool} /> : null
              })}
            </div>
          </section>
        ))}

        <details style={moreToolsStyle}>
          <summary style={moreToolsSummaryStyle}>Operating health</summary>
          <DataQualityPanel />
        </details>

        <details style={moreToolsStyle}>
          <summary style={moreToolsSummaryStyle}>Specialist tools <span>{moreAdminTools.length}</span></summary>
          <div className="admin-tool-grid" style={adminToolGridStyle}>
            {moreAdminTools.map((tool) => <AdminToolCard key={tool.href} tool={tool} />)}
          </div>
        </details>

        </AdminReviewFrame>
      </AdminGate>
    </SiteShell>
  )
}

function BusinessPulsePanel() {
  const [pulse, setPulse] = useState<BusinessPulse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session?.access_token) throw new Error('Sign in to see subscription activity.')
        const response = await fetch('/api/admin/business-pulse', {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: 'no-store',
        })
        const body = await response.json() as { ok: boolean; message?: string; pulse?: BusinessPulse }
        if (!response.ok || !body.pulse) throw new Error(body.message || 'Subscription activity is unavailable.')
        if (active) setPulse(body.pulse)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Subscription activity is unavailable.')
      }
    })()
    return () => { active = false }
  }, [])

  const metrics = pulse ? [
    {
      label: 'List-price MRR',
      value: formatUsd(pulse.estimatedMrrCents),
      detail: `${pulse.activePaidSubscriptions.toLocaleString()} active paid subscriptions`,
      href: '/admin/access?billing=paid',
    },
    {
      label: 'Collected · 30d',
      value: pulse.stripeRevenue30d ? formatUsd(pulse.stripeRevenue30d.netCollectedCents) : '—',
      detail: pulse.stripeRevenue30d
        ? `${formatUsd(pulse.stripeRevenue30d.grossCollectedCents)} charged · ${formatUsd(pulse.stripeRevenue30d.refundsCents + pulse.stripeRevenue30d.disputesCents)} returned`
        : pulse.stripeRevenueMessage || 'Stripe cash reporting unavailable',
      href: 'https://dashboard.stripe.com/balance',
    },
    {
      label: 'After fees · 30d',
      value: pulse.stripeRevenue30d ? formatUsd(pulse.stripeRevenue30d.netAfterFeesCents) : '—',
      detail: pulse.stripeRevenue30d
        ? `${formatUsd(pulse.stripeRevenue30d.stripeFeesCents)} Stripe fees`
        : 'Exact Stripe balance impact',
      href: 'https://dashboard.stripe.com/balance',
    },
    {
      label: 'New paid',
      value: pulse.newPaidAccounts30d.toLocaleString(),
      detail: 'First activation · 30 days',
      href: '/admin/growth',
    },
    {
      label: 'Canceled',
      value: pulse.cancellations30d.toLocaleString(),
      detail: 'Subscriptions · 30 days',
      href: '/admin/access?billing=canceled',
    },
    {
      label: 'Trial → paid',
      value: pulse.trialConversionRate == null ? '—' : `${Math.round(pulse.trialConversionRate * 100)}%`,
      detail: `${pulse.trialConversions.toLocaleString()} of ${pulse.recordedTrials.toLocaleString()} recorded trials`,
      href: '/admin/growth',
    },
  ] : []

  return (
    <section style={{ marginTop: 20, padding: '20px', borderRadius: 20, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
      <SectionHeader kicker="Business" title="Subscription pulse" subtitle="Current recurring value and recent billing movement." />
      {error ? <p role="alert" className="subtle-text">{error}</p> : null}
      {!pulse && !error ? <p className="subtle-text">Loading subscription activity…</p> : null}
      {pulse ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))', gap: 10, marginTop: 14 }}>
            {metrics.map((metric) => (
              <Link
                key={metric.label}
                href={metric.href}
                style={{ display: 'block', minWidth: 0, padding: '14px', borderRadius: 14, background: 'var(--surface-soft)', border: '1px solid var(--card-border-soft)', textDecoration: 'none' }}
                aria-label={`${metric.label}: ${metric.value}. View details`}
              >
                <div style={{ color: 'var(--muted-strong)', fontSize: 12, fontWeight: 800, lineHeight: 1.25 }}>{metric.label}</div>
                <div style={{ color: 'var(--foreground)', fontSize: 25, fontWeight: 900, lineHeight: 1.15, marginTop: 5, overflowWrap: 'anywhere' }}>{metric.value}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700, lineHeight: 1.35, marginTop: 6 }}>{metric.detail}</div>
              </Link>
            ))}
          </div>
          <BusinessTrend pulse={pulse} />
          <p className="subtle-text" style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.45 }}>
            MRR is active monthly subscriptions × current list price. Collected cash comes from Stripe balance activity and includes real discounts, taxes, refunds, disputes, and processing fees.
          </p>
        </>
      ) : null}
    </section>
  )
}

function BusinessTrend({ pulse }: { pulse: BusinessPulse }) {
  const revenueMonths = pulse.stripeRevenueTrend6m?.months ?? []
  const maxRevenue = Math.max(1, ...revenueMonths.map((month) => Math.abs(month.netAfterFeesCents)))
  const [selectedMonth, setSelectedMonth] = useState(() => revenueMonths.at(-1)?.month || pulse.subscriptionTrend6m.at(-1)?.month || '')
  const selectedRevenue = revenueMonths.find((month) => month.month === selectedMonth)
  const selectedSubscriptions = pulse.subscriptionTrend6m.find((month) => month.month === selectedMonth)
  const selectedLabel = selectedRevenue?.label || selectedSubscriptions?.label || 'Month'
  const [exportMessage, setExportMessage] = useState('')

  function exportSelectedMonth() {
    const snapshot = buildAdminMonthCsvExport({
      month: selectedMonth,
      label: selectedLabel,
      revenue: selectedRevenue,
      subscriptions: selectedSubscriptions,
    })
    const url = URL.createObjectURL(new Blob([snapshot.csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = snapshot.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExportMessage(`${selectedLabel} activity downloaded · ${snapshot.rowCount} ${snapshot.rowCount === 1 ? 'row' : 'rows'}`)
  }

  return (
    <div style={{ marginTop: 14, padding: '16px 12px', borderRadius: 16, border: '1px solid var(--card-border-soft)', background: 'color-mix(in srgb, var(--surface-soft) 74%, transparent)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--foreground)', fontSize: 16, fontWeight: 900, lineHeight: 1.2 }}>Six-month direction</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700, lineHeight: 1.35, marginTop: 4 }}>Cash after fees · new paid · canceled</div>
        </div>
        <Link href="https://dashboard.stripe.com/balance" style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 850, textDecoration: 'none' }}>Open Stripe</Link>
      </div>

      {revenueMonths.length > 0 ? (
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6, alignItems: 'end', marginTop: 16 }}
          aria-label="Six month Stripe revenue after fees"
        >
          {revenueMonths.map((month) => {
            const height = month.netAfterFeesCents === 0 ? 3 : Math.max(10, Math.round(Math.abs(month.netAfterFeesCents) / maxRevenue * 100))
            const value = formatCompactUsd(month.netAfterFeesCents)
            return (
              <button
                type="button"
                key={month.month}
                onClick={() => setSelectedMonth(month.month)}
                aria-pressed={selectedMonth === month.month}
                style={{ minWidth: 0, textAlign: 'center', padding: '4px 2px 6px', borderRadius: 10, border: selectedMonth === month.month ? '1px solid color-mix(in srgb, var(--brand-green) 55%, var(--card-border-soft))' : '1px solid transparent', background: 'transparent', boxShadow: selectedMonth === month.month ? 'inset 0 0 0 1px color-mix(in srgb, var(--brand-green) 18%, transparent)' : 'none', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
                title={`${month.label}: ${formatUsd(month.netAfterFeesCents)} after fees; ${formatUsd(month.netCollectedCents)} collected`}
                aria-label={`${month.label}: ${formatUsd(month.netAfterFeesCents)} after fees; ${formatUsd(month.netCollectedCents)} collected`}
              >
                <div style={{ height: 88, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingInline: 2 }}>
                  <span style={{ display: 'block', width: '100%', maxWidth: 38, height: `${height}%`, minHeight: 3, borderRadius: '7px 7px 3px 3px', background: month.netAfterFeesCents < 0 ? 'linear-gradient(180deg, #fb7185, #be123c)' : month.netAfterFeesCents > 0 ? 'linear-gradient(180deg, #b7f34a, #5f9f18)' : 'var(--card-border-soft)' }} />
                </div>
                <div style={{ color: 'var(--foreground)', fontSize: 10, fontWeight: 850, lineHeight: 1.2, marginTop: 6, overflowWrap: 'anywhere' }}>{value}</div>
                <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 800, lineHeight: 1.2, marginTop: 3 }}>{month.label}</div>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="subtle-text" style={{ margin: '14px 0 0', fontSize: 13 }}>{pulse.stripeRevenueMessage || 'Stripe cash trend is unavailable.'}</p>
      )}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--card-border-soft)' }}>
        <div style={{ display: 'flex', gap: 12, color: 'var(--muted)', fontSize: 11, fontWeight: 800 }}>
          <span><span aria-hidden="true" style={{ color: '#b7f34a' }}>●</span> New paid</span>
          <span><span aria-hidden="true" style={{ color: '#fb7185' }}>●</span> Canceled</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 6, marginTop: 10 }} aria-label="Six month subscription movement">
          {pulse.subscriptionTrend6m.map((month) => (
            <button type="button" key={month.month} onClick={() => setSelectedMonth(month.month)} aria-pressed={selectedMonth === month.month} style={{ minWidth: 0, textAlign: 'center', padding: '8px 2px', borderRadius: 10, border: selectedMonth === month.month ? '1px solid color-mix(in srgb, var(--brand-green) 55%, var(--card-border-soft))' : '1px solid transparent', background: 'var(--surface-soft)', color: 'inherit', font: 'inherit', cursor: 'pointer' }} aria-label={`${month.label}: ${month.newPaidAccounts} new paid, ${month.cancellations} canceled`}>
              <div style={{ color: '#b7f34a', fontSize: 12, fontWeight: 900, lineHeight: 1.2 }}>+{month.newPaidAccounts}</div>
              <div style={{ color: '#fb9aaa', fontSize: 12, fontWeight: 900, lineHeight: 1.2, marginTop: 4 }}>−{month.cancellations}</div>
              <div style={{ color: 'var(--muted)', fontSize: 10, fontWeight: 800, lineHeight: 1.2, marginTop: 5 }}>{month.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--card-border-soft)' }} aria-live="polite">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ color: 'var(--foreground)', fontSize: 15, fontWeight: 900 }}>{selectedLabel} details</div>
          <button
            type="button"
            onClick={exportSelectedMonth}
            disabled={!selectedMonth}
            style={{ minHeight: 36, padding: '8px 12px', borderRadius: 999, border: '1px solid color-mix(in srgb, var(--brand-green) 52%, var(--card-border-soft))', background: 'color-mix(in srgb, var(--brand-green) 10%, var(--surface-soft))', color: 'var(--foreground)', font: 'inherit', fontSize: 11, fontWeight: 900, cursor: selectedMonth ? 'pointer' : 'not-allowed' }}
          >
            Export CSV
          </button>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 750, marginTop: 4 }}>Tap another month to compare</div>
        {exportMessage ? <div role="status" style={{ color: 'var(--brand-green)', fontSize: 11, fontWeight: 800, marginTop: 7 }}>{exportMessage}</div> : null}

        {selectedRevenue ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 10 }}>
            {[
              ['Collected', formatUsd(selectedRevenue.netCollectedCents)],
              ['Fees', formatUsd(selectedRevenue.stripeFeesCents)],
              ['After fees', formatUsd(selectedRevenue.netAfterFeesCents)],
            ].map(([label, value]) => (
              <div key={label} style={{ minWidth: 0, padding: '8px 6px', borderRadius: 10, background: 'var(--surface-soft)' }}>
                <div style={{ color: 'var(--muted)', fontSize: 9, fontWeight: 850, textTransform: 'uppercase', lineHeight: 1.2 }}>{label}</div>
                <div style={{ color: 'var(--foreground)', fontSize: 13, fontWeight: 900, lineHeight: 1.25, marginTop: 3, overflowWrap: 'anywhere' }}>{value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {selectedRevenue?.activity.length ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ color: 'var(--muted-strong)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Cash activity</div>
            <div style={{ display: 'grid', gap: 6, marginTop: 7 }}>
              {selectedRevenue.activity.map((activity) => (
                <div key={activity.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', minWidth: 0, padding: '9px 10px', borderRadius: 11, background: 'var(--surface-soft)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--foreground)', fontSize: 12, fontWeight: 900, lineHeight: 1.3 }}>{revenueActivityLabel(activity.kind)}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 10, fontWeight: 700, lineHeight: 1.35, marginTop: 2, overflowWrap: 'anywhere' }}>{activity.description || activity.sourceId || activity.id} · {formatShortDate(activity.occurredAt)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: activity.netCents < 0 ? '#fb9aaa' : 'var(--foreground)', fontSize: 13, fontWeight: 900 }}>{formatUsd(activity.amountCents)}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 9, fontWeight: 750, marginTop: 2 }}>{formatUsd(activity.feeCents)} fee</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {selectedSubscriptions?.movements.length ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ color: 'var(--muted-strong)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>Account movement</div>
            <div style={{ display: 'grid', gap: 6, marginTop: 7 }}>
              {selectedSubscriptions.movements.map((movement) => {
                const content = (
                  <>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--foreground)', fontSize: 12, fontWeight: 900, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{movement.accountLabel}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 10, fontWeight: 700, lineHeight: 1.35, marginTop: 2 }}>{movement.planLabel} · {formatShortDate(movement.occurredAt)}</div>
                    </div>
                    <div style={{ color: movement.kind === 'canceled' ? '#fb9aaa' : '#b7f34a', fontSize: 10, fontWeight: 900, textAlign: 'right' }}>{movement.kind === 'canceled' ? 'Canceled' : 'New paid'}</div>
                  </>
                )
                const movementStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', minWidth: 0, padding: '9px 10px', borderRadius: 11, background: 'var(--surface-soft)', textDecoration: 'none' }
                return movement.profileId ? (
                  <Link key={`${movement.kind}-${movement.subscriptionId}-${movement.occurredAt}`} href={`/admin/access?search=${encodeURIComponent(movement.profileId)}`} style={movementStyle}>{content}</Link>
                ) : (
                  <div key={`${movement.kind}-${movement.subscriptionId}-${movement.occurredAt}`} style={movementStyle}>{content}</div>
                )
              })}
            </div>
          </div>
        ) : null}

        {!selectedRevenue?.activity.length && !selectedSubscriptions?.movements.length ? (
          <div style={{ marginTop: 10, padding: '10px', borderRadius: 10, background: 'var(--surface-soft)', color: 'var(--muted)', fontSize: 12, fontWeight: 750 }}>No cash or subscription movement was recorded this month.</div>
        ) : null}
      </div>
    </div>
  )
}

function revenueActivityLabel(kind: 'payment' | 'refund' | 'dispute' | 'recovered') {
  if (kind === 'refund') return 'Refund'
  if (kind === 'dispute') return 'Dispute'
  if (kind === 'recovered') return 'Dispute recovered'
  return 'Payment'
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}

function formatUsd(amountCents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountCents / 100)
}

function formatCompactUsd(amountCents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(amountCents) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(amountCents) >= 100_000 ? 1 : 0,
  }).format(amountCents / 100)
}

function AccountTiersPanel() {
  const [summary, setSummary] = useState<AccountTierSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session?.access_token) throw new Error('Sign in to see account counts.')
        const response = await fetch('/api/admin/account-tiers', {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: 'no-store',
        })
        const body = await response.json() as ({ ok: boolean; message?: string } & Partial<AccountTierSummary>)
        if (!response.ok || !body.counts || !body.healthByTier || !body.healthTotals) {
          throw new Error(body.message || 'Account counts are unavailable.')
        }
        if (active) setSummary({ counts: body.counts, healthByTier: body.healthByTier, healthTotals: body.healthTotals })
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Account counts are unavailable.')
      }
    })()
    return () => { active = false }
  }, [])

  return (
    <section style={{ marginTop: 20, padding: '20px', borderRadius: 20, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
      <SectionHeader kicker="Membership" title="Accounts by tier" subtitle="Current access for signed-up accounts, not upgrade requests or tennis player records." />
      {error ? <p role="alert" className="subtle-text">{error}</p> : null}
      {!summary && !error ? <p className="subtle-text">Loading account counts…</p> : null}
      {summary ? (
        <>
          <p style={{ margin: '12px 0', color: 'var(--muted-strong)' }}><strong style={{ color: 'var(--foreground)' }}>{summary.counts.total.toLocaleString()} accounts</strong> · {(summary.counts.total - summary.counts.admins).toLocaleString()} members · {summary.counts.admins.toLocaleString()} admins</p>

          {summary.healthTotals.pastDue > 0 || summary.healthTotals.expiring > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {summary.healthTotals.pastDue > 0 ? (
                <Link href="/admin/access?billing=past_due" className="button-secondary" style={{ minHeight: 38, borderColor: 'color-mix(in srgb, #f87171 55%, var(--shell-panel-border))' }}>
                  {summary.healthTotals.pastDue} past due · Review
                </Link>
              ) : null}
              {summary.healthTotals.expiring > 0 ? (
                <Link href="/admin/access?expiring=1" className="button-secondary" style={{ minHeight: 38, borderColor: 'color-mix(in srgb, var(--brand-gold) 55%, var(--shell-panel-border))' }}>
                  {summary.healthTotals.expiring} ending in 14 days · Review
                </Link>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
            {MEMBERSHIP_TIER_ORDER.map((tier) => (
              <div
                key={tier}
                style={{ padding: '14px', borderRadius: 14, background: 'var(--surface-soft)', border: '1px solid var(--card-border-soft)', minWidth: 0 }}
              >
                <Link
                  href={`/admin/access?tier=${tier}`}
                  aria-label={`View ${MEMBERSHIP_TIERS[tier].name} accounts`}
                  style={{ display: 'block', textDecoration: 'none' }}
                >
                  <div style={{ color: 'var(--muted-strong)', fontSize: 13, fontWeight: 700 }}>{MEMBERSHIP_TIERS[tier].name}</div>
                  <div style={{ color: 'var(--foreground)', fontSize: 26, fontWeight: 900 }}>{summary.counts[tier].toLocaleString()}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginTop: 4 }}>View accounts →</div>
                </Link>

                {tier === 'free' && summary.healthByTier.free.pastDue === 0 && summary.healthByTier.free.expiring === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--card-border-soft)' }}>Standard free access</div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--card-border-soft)' }}>
                    {(['paid', 'trial', 'complimentary', 'pastDue', 'expiring'] as AccountHealthKey[]).map((health) => {
                      const count = summary.healthByTier[tier][health]
                      if (tier === 'free' && health !== 'pastDue' && health !== 'expiring') return null
                      if ((health === 'pastDue' || health === 'expiring') && count === 0) return null
                      return (
                        <Link
                          key={health}
                          href={accountHealthHref(tier, health)}
                          aria-label={`View ${MEMBERSHIP_TIERS[tier].name} ${accountHealthLabel(health).toLowerCase()} accounts`}
                          style={{ color: health === 'pastDue' ? '#fca5a5' : health === 'expiring' ? 'var(--brand-gold)' : 'var(--muted-strong)', fontSize: 12, lineHeight: 1.2, fontWeight: 800, textDecoration: 'none', padding: '5px 7px', borderRadius: 999, border: '1px solid var(--card-border-soft)', background: 'var(--shell-chip-bg)' }}
                        >
                          {accountHealthLabel(health)} {count}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="subtle-text" style={{ margin: '12px 0 0', fontSize: 13 }}>Each member appears once at their highest effective tier. Paid means Stripe-managed active access. Complimentary includes manual, promotional, and role-based access.</p>
          <Link href="/admin/access" className="button-secondary" style={{ marginTop: 14 }}>Manage account access</Link>
        </>
      ) : null}
    </section>
  )
}

function accountHealthLabel(health: AccountHealthKey) {
  if (health === 'pastDue') return 'Past due'
  if (health === 'expiring') return 'Ending soon'
  if (health === 'complimentary') return 'Complimentary'
  if (health === 'trial') return 'Trial'
  return 'Paid'
}

function accountHealthHref(tier: string, health: AccountHealthKey) {
  if (health === 'expiring') return `/admin/access?tier=${tier}&expiring=1`
  const billing = health === 'pastDue' ? 'past_due' : health
  return `/admin/access?tier=${tier}&billing=${billing}`
}

function DataQualityPanel() {
  const [stats, setStats] = useState<{
    totalMatches: number | null
    matchesWithScores: number | null
    matchesWithPlayers: number | null
    totalPlayers: number | null
    pendingUpgradeRequests: number | null
    profileSyncNeedsReview: number | null
    activeMembers7d: number | null
    publicSiteActions7d: number | null
    checkoutStarts7d: number | null
    lastSnapshotDate: string | null
  }>({
    totalMatches: null,
    matchesWithScores: null,
    matchesWithPlayers: null,
    totalPlayers: null,
    pendingUpgradeRequests: null,
    profileSyncNeedsReview: null,
    activeMembers7d: null,
    publicSiteActions7d: null,
    checkoutStarts7d: null,
    lastSnapshotDate: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const [
        { count: totalMatches },
        { count: matchesWithScores },
        { count: totalPlayers },
        { count: pendingUpgradeRequests },
        { data: lastSnap },
        { data: matchesWithPlayersData },
        { data: profileSyncRepairData },
        { data: profileSyncReviewData },
        { data: recentProductEvents },
      ] = await Promise.all([
        supabase.from('matches').select('*', { count: 'exact', head: true }).not('match_type', 'is', null),
        supabase.from('matches').select('*', { count: 'exact', head: true }).not('score', 'is', null).neq('score', ''),
        supabase.from('players').select('*', { count: 'exact', head: true }),
        supabase.from('upgrade_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('rating_snapshots').select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1),
        supabase.from('match_players').select('match_id').limit(500),
        supabase
          .from('product_usage_events')
          .select('id, metadata')
          .eq('event_name', 'profile_cloud_sync_repair')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('profile_sync_review_events')
          .select('event_id, status')
          .eq('status', 'reviewed')
          .limit(500),
        supabase
          .from('product_usage_events')
          .select('user_id, surface, event_name')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1000),
      ])
      const linkedMatchIds = new Set((matchesWithPlayersData ?? []).map((r: { match_id: string }) => r.match_id))
      const reviewedSyncRepairEventIds = new Set((profileSyncReviewData ?? []).map((row: { event_id: string }) => row.event_id))
      setStats({
        totalMatches,
        matchesWithScores,
        matchesWithPlayers: linkedMatchIds.size,
        totalPlayers,
        pendingUpgradeRequests,
        activeMembers7d: new Set((recentProductEvents ?? []).map((row: { user_id: string }) => row.user_id)).size,
        publicSiteActions7d: (recentProductEvents ?? []).filter((row: { surface: string }) => row.surface === 'public_site').length,
        checkoutStarts7d: (recentProductEvents ?? []).filter((row: { event_name: string }) => row.event_name === 'upgrade_checkout_started').length,
        profileSyncNeedsReview: (profileSyncRepairData ?? []).filter((row: { id: string; metadata: Record<string, unknown> | null }) =>
          !reviewedSyncRepairEventIds.has(row.id) && isProfileSyncRepairNeedingReview(row.metadata),
        ).length,
        lastSnapshotDate: (lastSnap?.[0] as { snapshot_date: string } | undefined)?.snapshot_date ?? null,
      })
      setLoading(false)
    })()
  }, [])

  const scorePct = getCoveragePercent(stats.matchesWithScores, stats.totalMatches)
  const linkedPct = getCoveragePercent(stats.matchesWithPlayers, stats.totalMatches)

  return (
    <section style={{ marginTop: 18, padding: '18px 20px', borderRadius: 20, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
      <div style={{ color: 'var(--muted-strong)', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Operating health</div>
      {loading ? (
        <div className="subtle-text" style={{ fontSize: 13 }}>Loading health metrics...</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div className="subtle-text" style={{ fontSize: 13, maxWidth: 720 }}>
              <strong style={{ color: 'var(--foreground)' }}>Traffic & activity:</strong> Vercel Web Analytics is the source of truth for visitors and page views. TiQ activity below shows what signed-in members did after they arrived.
            </div>
            <a href="https://vercel.com/tennis-data/tennis-data/analytics" target="_blank" rel="noreferrer" className="button-ghost">Open site traffic</a>
          </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 12 }}>
          {[
            { label: 'Active members · 7d', value: stats.activeMembers7d?.toLocaleString() ?? '-', href: '/admin/product-events' },
            { label: 'Public actions · 7d', value: stats.publicSiteActions7d?.toLocaleString() ?? '-', href: '/admin/product-events?filter=public_site' },
            { label: 'Checkout starts · 7d', value: stats.checkoutStarts7d?.toLocaleString() ?? '-', href: '/admin/product-events?filter=upgrade' },
            { label: 'Total matches', value: stats.totalMatches?.toLocaleString() ?? '-' },
            { label: 'Scores entered', value: scorePct != null ? `${scorePct}%` : '-', flag: scorePct != null && scorePct < 80 },
            { label: 'Player-linked', value: linkedPct != null ? `${linkedPct}%` : '-', flag: linkedPct != null && linkedPct < 80 },
            { label: 'Total players', value: stats.totalPlayers?.toLocaleString() ?? '-' },
            {
              label: 'Open plan requests',
              value: stats.pendingUpgradeRequests?.toLocaleString() ?? '-',
              flag: Boolean(stats.pendingUpgradeRequests),
              href: '/admin/upgrade-requests',
            },
            {
              label: 'Profile sync reviews',
              value: stats.profileSyncNeedsReview?.toLocaleString() ?? '-',
              flag: Boolean(stats.profileSyncNeedsReview),
              href: '/admin/product-events?filter=profile_sync_attention',
            },
            { label: 'Last recalculate', value: stats.lastSnapshotDate ? new Date(stats.lastSnapshotDate).toLocaleDateString() : 'Never' },
          ].map((item) => {
            const cardStyle = {
              padding: '10px 14px',
              borderRadius: 14,
              background: 'var(--surface-soft)',
              border: `1px solid ${item.flag ? 'rgba(251,146,60,0.32)' : 'var(--card-border-soft)'}`,
              textDecoration: 'none',
            }
            const content = (
              <>
                <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{item.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: item.flag ? '#b45309' : 'var(--foreground)', letterSpacing: 0 }}>{item.value}</div>
              </>
            )

            return item.href ? (
              <Link key={item.label} href={item.href} style={cardStyle}>
                {content}
              </Link>
            ) : (
              <div key={item.label} style={cardStyle}>
                {content}
              </div>
            )
          })}
        </div>
        </>
      )}
    </section>
  )
}

function getCoveragePercent(value: number | null, total: number | null) {
  if (!total || value == null) return null
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)))
}

function isProfileSyncRepairNeedingReview(metadata: Record<string, unknown> | null) {
  return metadata?.result === 'failed' || metadata?.result === 'local_only' || metadata?.hasError === true
}

function AdminToolCard({ tool }: { tool: AdminTool }) {
  const [hovered, setHovered] = useState(false)
  const accent = accentStyles(tool.accent)

  return (
    <Link
      href={tool.href}
      className="surface-card admin-tool-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 14,
        alignItems: 'start',
        minHeight: 0,
        padding: 16,
        textDecoration: 'none',
        background: hovered ? 'var(--shell-panel-bg-strong)' : 'var(--shell-panel-bg)',
        border: `1px solid ${hovered ? accent.border : accent.softBorder}`,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease',
        boxShadow: hovered ? accent.shadow : '0 14px 30px rgba(2, 6, 23, 0.16)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span className={accent.badgeClass}>{tool.badge}</span>
        <div style={{ marginTop: 12, color: 'var(--foreground)', fontWeight: 900, fontSize: '1.08rem', lineHeight: 1.2 }}>
          {tool.title}
        </div>
        <p className="subtle-text" style={{ margin: '7px 0 0', lineHeight: 1.4 }}>
          {tool.description}
        </p>
      </div>
      <div style={{ display: 'grid', placeItems: 'center', justifySelf: 'end', opacity: hovered ? 1 : 0.72 }}>
        <TiqFeatureIcon name={tool.icon} size="sm" variant={hovered ? 'surface' : 'ghost'} />
      </div>
    </Link>
  )
}

function SectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string
  title: string
  subtitle: string
}) {
  return (
    <div>
      <div className="section-kicker">{kicker}</div>
      <h2 className="section-title" style={{ marginTop: 6 }}>
        {title}
      </h2>
      <p className="subtle-text" style={{ marginTop: 8, maxWidth: 760 }}>
        {subtitle}
      </p>
    </div>
  )
}

const moreToolsStyle = {
  marginTop: 24,
  border: '1px solid var(--shell-panel-border)',
  borderRadius: 18,
  background: 'var(--shell-panel-bg)',
  padding: 14,
} as const

const adminToolGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 224px), 1fr))',
  gap: 14,
  marginTop: 14,
} as const

const moreToolsSummaryStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 42,
  color: 'var(--foreground-strong)',
  fontSize: 15,
  fontWeight: 900,
  cursor: 'pointer',
} as const

