'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  AdminReviewFrame,
  AdminReviewHero,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { supabase } from '@/lib/supabase'

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
    description: 'Review plan requests and activate approved access.',
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

const priorityToolHrefs = [
  '/admin/access',
  '/admin/promotions',
  '/admin/growth',
  '/admin/product-events',
  '/admin/tennisrecord',
  '/admin/data-assist',
  '/admin/missing-scorecards',
]

const priorityTools = priorityToolHrefs
  .map((href) => adminTools.find((tool) => tool.href === href))
  .filter((tool): tool is AdminTool => Boolean(tool))

const moreAdminTools = adminTools.filter((tool) => !priorityToolHrefs.includes(tool.href))

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
          title="What needs attention?"
          actions={
            <>
              <Link href="/admin/data-assist" className="button-primary">Review uploads</Link>
              <Link href="/admin/access" className="button-secondary">Grant access</Link>
              <Link href="/admin/promotions" className="button-secondary">Stripe promotions</Link>
              <Link href="/admin/growth" className="button-secondary">Growth funnel</Link>
              <Link href="/admin/product-events" className="button-secondary">Traffic & activity</Link>
              <Link href="/admin/clubs" className="button-secondary">Manage clubs</Link>
            </>
          }
        >
          Review tennis data, account access, and club workspaces from one place.
        </AdminReviewHero>
        <DataQualityPanel />

        <section style={{ marginTop: 24 }}>
          <SectionHeader
            kicker="Start here"
            title="Common admin work"
            subtitle="Open the job you need."
          />
          <div className="admin-tool-grid" style={adminToolGridStyle}>
            {priorityTools.map((tool) => (
              <AdminToolCard key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        <details style={moreToolsStyle}>
          <summary style={moreToolsSummaryStyle}>More admin tools <span>{moreAdminTools.length}</span></summary>
          <div className="admin-tool-grid" style={adminToolGridStyle}>
            {moreAdminTools.map((tool) => <AdminToolCard key={tool.href} tool={tool} />)}
          </div>
        </details>

        </AdminReviewFrame>
      </AdminGate>
    </SiteShell>
  )
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
              label: 'Pending upgrades',
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

