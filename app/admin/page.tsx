'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  AdminReviewFrame,
  AdminReviewHero,
  AdminReviewPanel,
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
    description:
      'Admin-only fallback for reviewed schedule, roster, and scorecard files when Data Assist needs a manual correction path.',
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
    description:
      'Review captured payloads that need human confirmation before they can become trusted TenAceIQ records.',
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
    description:
      'Review player, captain, and coordinator TennisLink uploads, confirm confidence, and keep imports locked behind verification before anything can affect trusted data.',
    badge: 'Data Assist',
    accent: 'green',
    icon: 'reports',
    highlights: ['Upload batches', 'Layout confidence', 'Review boundary', 'Import lock'],
    statLabel: 'Best for',
    statValue: 'Community uploads',
  },
  {
    title: 'Match Accuracy Reports',
    href: '/admin/match-reports',
    description:
      'Review player-reported match inaccuracies, action data corrections, and pause scorecard uploads for linked contributors when trust issues repeat.',
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
    description:
      'Track which scheduled matches still need scorecard uploads, filter by league and team, and jump directly into Data Assist or match review.',
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
    description:
      'Review player availability snapshots and lineup readiness so admin support stays aligned with the captain workflow.',
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
    description:
      'Create a single match manually when you need a precise entry, correction, or one-off administrative adjustment.',
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
    description:
      'Review, inspect, and clean up match records from one operational surface built for ongoing data quality control.',
    badge: 'Control',
    accent: 'green',
    icon: 'matchupAnalysis',
    highlights: ['Match cleanup', 'Record review', 'Operational oversight'],
    statLabel: 'Best for',
    statValue: 'Match hygiene',
  },
  {
    title: 'Access Control',
    href: '/admin/access',
    description:
      'Manage Player, Coach, Captain, and League Office entitlement flags so monetization and league access stay explicit instead of being inferred only from role names.',
    badge: 'Access',
    accent: 'blue',
    icon: 'accountSecurity',
    highlights: ['Coach subscription', 'Captain subscription', 'League access', 'Profile entitlements'],
    statLabel: 'Best for',
    statValue: 'Access control',
  },
  {
    title: 'Upgrade Requests',
    href: '/admin/upgrade-requests',
    description:
      'Review paid-plan requests, open internal support follow-up, and activate Player, Captain, or TIQ League access once an account is linked.',
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
    description:
      'Review paid usage signals, profile linking, and cloud sync repair events that need admin follow-up.',
    badge: 'Analytics',
    accent: 'blue',
    icon: 'playerRatings',
    highlights: ['Billing opens', 'Player activation', 'Sync repairs', 'Captain closeout'],
    statLabel: 'Best for',
    statValue: 'Activation health',
  },
  {
    title: 'Manage Players',
    href: '/admin/manage-players',
    description:
      'Update player records, ratings, metadata, and notes so your player graph stays trustworthy and usable.',
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
    description:
      'Create team match events, enter line-by-line results, and watch completed lines feed the TIQ rating engine automatically.',
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
    description:
      'Detect players whose names are within two edits of each other, confirm which record to keep, and merge match history automatically before deleting the duplicate.',
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
    description:
      'Scan all matches for suspicious data: extreme rating gaps, missing scores, and possible duplicate entries before bad records corrupt ratings.',
    badge: 'Data quality',
    accent: 'slate',
    icon: 'opponentScouting',
    highlights: ['Extreme mismatches', 'Missing scores', 'Duplicate detection'],
    statLabel: 'Best for',
    statValue: 'Data integrity',
  },
]

const importTools = adminTools.filter((tool) =>
  ['/admin/import', '/admin/import-queue', '/admin/data-assist', '/admin/missing-scorecards', '/admin/lineup-availability'].includes(tool.href)
)

const managementTools = adminTools.filter((tool) =>
  ['/admin/add-match', '/admin/manage-matches', '/admin/manage-players', '/admin/access', '/admin/upgrade-requests', '/admin/product-events', '/admin/tiq-team-matches', '/admin/deduplicate', '/admin/anomalies'].includes(tool.href)
)

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
          kicker="Admin Command"
          title="Elite Admin Dashboard"
          actions={
            <>
              <a href="#imports" className="button-primary" style={{ textDecoration: 'none' }}>
                Start with Data Assist
              </a>
              <a href="#management" className="button-secondary" style={{ textDecoration: 'none' }}>
                Open Management Tools
              </a>
            </>
          }
        >
          Centralize imports, manual entry, match cleanup, and player maintenance in one premium
          control surface that matches the rest of the TenAceIQ experience.
        </AdminReviewHero>
        <DataQualityPanel />

        <AdminReviewPanel style={{ marginTop: 18 }}>
          <div>
            <div className="metric-grid">
              <MetricCard label="Admin Tools" value={String(adminTools.length)} helper="Includes access control and upgrade requests" />
              <MetricCard label="Upload Review Path" value="1" helper="Use Data Assist first" />
              <MetricCard label="Data Control" value="6" helper="Uploads, availability, match, player, access, and lead ops" />
              <MetricCard label="Recommended Flow" value="Upload -> Review" helper="Confirm before writing" />
            </div>

            <div className="card-grid three" style={{ marginTop: 18 }}>
              <MiniPanel
                title="Data Assist First"
                text="Use reviewed uploads for scorecards, schedules, and rosters before falling back to admin-only correction tools."
                tone="green"
              />
              <MiniPanel
                title="Missing Scorecards"
                text="Use the scorecard queue to see which scheduled matches are still missing results after match day."
                tone="green"
              />
              <MiniPanel
                title="Data Stewardship"
                text="Use the management tools when you need to clean records, fix metadata, or refine ratings inputs."
                tone="blue"
              />
              <MiniPanel
                title="Access + Monetization"
                text="Use Access Control when Coach, Captain, and League Office permissions need explicit profile-level updates."
                tone="slate"
              />
            </div>
          </div>
        </AdminReviewPanel>

        <section id="imports" style={{ marginTop: 26 }}>
          <SectionHeader
            kicker="Imports"
            title="Bring data into the system and manage weekly result flow"
            subtitle="Start with Data Assist uploads, use missing scorecards to track what is still outstanding, and use lineup availability when weekly readiness needs admin support."
          />
          <div className="card-grid three" style={{ marginTop: 14 }}>
            {importTools.map((tool) => (
              <AdminToolCard key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

        <section id="management" style={{ marginTop: 30 }}>
          <SectionHeader
            kicker="Management"
            title="Control records and maintain quality"
            subtitle="These routes are for precise edits, cleanup, one-off corrections, and ongoing stewardship of your data."
          />
          <div className="card-grid three" style={{ marginTop: 14 }}>
            {managementTools.map((tool) => (
              <AdminToolCard key={tool.href} tool={tool} />
            ))}
          </div>
        </section>

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
    lastSnapshotDate: string | null
  }>({
    totalMatches: null,
    matchesWithScores: null,
    matchesWithPlayers: null,
    totalPlayers: null,
    pendingUpgradeRequests: null,
    profileSyncNeedsReview: null,
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
      ])
      const linkedMatchIds = new Set((matchesWithPlayersData ?? []).map((r: { match_id: string }) => r.match_id))
      const reviewedSyncRepairEventIds = new Set((profileSyncReviewData ?? []).map((row: { event_id: string }) => row.event_id))
      setStats({
        totalMatches,
        matchesWithScores,
        matchesWithPlayers: linkedMatchIds.size,
        totalPlayers,
        pendingUpgradeRequests,
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 12 }}>
          {[
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
      className="surface-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'block',
        overflow: 'hidden',
        minHeight: 290,
        padding: 18,
        textDecoration: 'none',
        background:
          hovered
            ? 'var(--shell-panel-bg-strong)'
            : 'var(--shell-panel-bg)',
        border: `1px solid ${hovered ? accent.border : accent.softBorder}`,
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        transition:
          'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease',
        boxShadow: hovered ? accent.shadow : '0 18px 44px rgba(2, 6, 23, 0.20)',
      }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span className={accent.badgeClass}>{tool.badge}</span>
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              opacity: hovered ? 1 : 0.72,
              transition: 'opacity 180ms ease',
            }}
          >
            <TiqFeatureIcon name={tool.icon} size="sm" variant={hovered ? 'surface' : 'ghost'} />
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            color: 'var(--foreground)',
            fontWeight: 800,
            fontSize: '1.08rem',
            lineHeight: 1.2,
            letterSpacing: 0,
          }}
        >
          {tool.title}
        </div>

        <p
          className="subtle-text"
          style={{
            marginTop: 10,
            minHeight: 78,
          }}
        >
          {tool.description}
        </p>

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${accent.softBorder}`,
          }}
        >
          <div className="subtle-text" style={{ fontSize: '0.78rem' }}>
            {tool.statLabel}
          </div>
          <div
            style={{
              color: 'var(--foreground)',
              fontWeight: 800,
              fontSize: '0.88rem',
            }}
          >
            {tool.statValue}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 14,
          }}
        >
          {tool.highlights.map((item) => (
            <span
              key={item}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 30,
                padding: '6px 10px',
                borderRadius: 999,
                background: accent.chipBg,
                border: `1px solid ${accent.chipBorder}`,
                color: accent.chipText,
                fontSize: '0.76rem',
                fontWeight: 700,
                letterSpacing: 0,
              }}
            >
              {item}
            </span>
          ))}
        </div>

        <div
          style={{
            marginTop: 18,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: '#9BE11D',
            fontWeight: 800,
            fontSize: '0.92rem',
          }}
        >
          Open tool <span aria-hidden="true">{hovered ? 'up' : '->'}</span>
        </div>
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

function MiniPanel({
  title,
  text,
  tone,
}: {
  title: string
  text: string
  tone: Accent
}) {
  const toneStyles =
    tone === 'green'
      ? {
          border: '1px solid rgba(155,225,29,0.14)',
          background: 'var(--shell-panel-bg)',
        }
      : tone === 'slate'
        ? {
            border: '1px solid rgba(148,163,184,0.14)',
            background: 'var(--shell-panel-bg)',
          }
        : {
            border: '1px solid rgba(116,190,255,0.14)',
            background: 'var(--shell-panel-bg)',
          }

  return (
    <div
      className="surface-card"
        style={{
          padding: 18,
          ...toneStyles,
        }}
      >
        <div
          style={{
          color: 'var(--foreground)',
          fontWeight: 800,
          fontSize: '1rem',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div className="subtle-text">{text}</div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ fontSize: '1.22rem', lineHeight: 1.15 }}>
        {value}
      </div>
      <div className="subtle-text" style={{ marginTop: 8, fontSize: '0.82rem' }}>
        {helper}
      </div>
    </div>
  )
}

