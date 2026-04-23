'use client'

import Link from 'next/link'
import { useState } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'

type Accent = 'blue' | 'green' | 'slate'

type AdminTool = {
  title: string
  href: string
  description: string
  badge: string
  accent: Accent
  highlights: string[]
  statLabel: string
  statValue: string
}

const adminTools: AdminTool[] = [
  {
    title: 'Unified Import Center',
    href: '/admin/import',
    description:
      'Upload or paste schedule and scorecard JSON in one place, preview normalized rows, review warnings, and commit through the shared TenAceIQ ingestion pipeline.',
    badge: 'Primary',
    accent: 'green',
    highlights: ['Schedule ingest', 'Scorecard ingest', 'File upload + paste', 'Preview + commit'],
    statLabel: 'Best for',
    statValue: 'All imports',
  },
  {
    title: 'Missing Scorecards',
    href: '/admin/missing-scorecards',
    description:
      'Track which scheduled matches still need scorecards, filter by league and team, and jump directly into import or match review.',
    badge: 'Operations',
    accent: 'green',
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
    highlights: ['Match cleanup', 'Record review', 'Operational oversight'],
    statLabel: 'Best for',
    statValue: 'Match hygiene',
  },
  {
    title: 'Access Control',
    href: '/admin/access',
    description:
      'Manage captain subscriptions and TIQ league entitlement flags so monetization and league access stay explicit instead of being inferred only from role names.',
    badge: 'Access',
    accent: 'blue',
    highlights: ['Captain subscription', 'Team entry', 'Individual creation', 'Profile entitlements'],
    statLabel: 'Best for',
    statValue: 'Access control',
  },
  {
    title: 'Manage Players',
    href: '/admin/manage-players',
    description:
      'Update player records, ratings, metadata, and notes so your player graph stays trustworthy and usable.',
    badge: 'Roster',
    accent: 'slate',
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
    highlights: ['Team events', 'Line entry', 'Auto rating sync', 'Singles + doubles'],
    statLabel: 'Best for',
    statValue: 'Team leagues',
  },
]

const importTools = adminTools.filter((tool) =>
  ['/admin/import', '/admin/missing-scorecards', '/admin/lineup-availability'].includes(tool.href)
)

const managementTools = adminTools.filter((tool) =>
  ['/admin/add-match', '/admin/manage-matches', '/admin/manage-players', '/admin/access', '/admin/tiq-team-matches'].includes(tool.href)
)

function accentStyles(accent: Accent) {
  if (accent === 'green') {
    return {
      glow: 'radial-gradient(circle, rgba(155,225,29,0.18) 0%, transparent 72%)',
      border: 'rgba(155,225,29,0.18)',
      softBorder: 'rgba(155,225,29,0.12)',
      badgeClass: 'badge badge-green',
      chipBg: 'rgba(155,225,29,0.10)',
      chipBorder: 'rgba(155,225,29,0.15)',
      chipText: '#C8F56B',
      icon: '▲',
      shadow: '0 28px 60px rgba(31, 58, 18, 0.20)',
    }
  }

  if (accent === 'slate') {
    return {
      glow: 'radial-gradient(circle, rgba(148,163,184,0.18) 0%, transparent 72%)',
      border: 'rgba(148,163,184,0.18)',
      softBorder: 'rgba(148,163,184,0.12)',
      badgeClass: 'badge badge-slate',
      chipBg: 'rgba(148,163,184,0.10)',
      chipBorder: 'rgba(148,163,184,0.16)',
      chipText: '#D7E2F2',
      icon: '◼',
      shadow: '0 28px 60px rgba(15, 23, 42, 0.24)',
    }
  }

  return {
    glow: 'radial-gradient(circle, rgba(74,163,255,0.20) 0%, transparent 72%)',
    border: 'rgba(116,190,255,0.18)',
    softBorder: 'rgba(116,190,255,0.12)',
    badgeClass: 'badge badge-blue',
    chipBg: 'rgba(74,163,255,0.10)',
    chipBorder: 'rgba(74,163,255,0.16)',
    chipText: '#BFE1FF',
    icon: '●',
    shadow: '0 28px 60px rgba(17, 53, 88, 0.22)',
  }
}

export default function AdminDashboardPage() {
  return (
    <SiteShell active="/admin">
      <AdminGate>
        <section
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '18px 24px 0',
        }}
      >
        <HeroSection />

        <section
          className="surface-card panel-pad section"
          style={{
            position: 'relative',
            overflow: 'hidden',
            marginTop: 18,
          }}
        >
          <GlowOrb
            top="-90px"
            right="-72px"
            size={250}
            background="radial-gradient(circle, rgba(74,163,255,0.14) 0%, transparent 72%)"
          />
          <GlowOrb
            bottom="-100px"
            left="-58px"
            size={230}
            background="radial-gradient(circle, rgba(155,225,29,0.10) 0%, transparent 74%)"
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="metric-grid">
              <MetricCard label="Admin Tools" value="7" helper="Includes access control" />
              <MetricCard label="Primary Import Path" value="1" helper="Use /admin/import first" />
              <MetricCard label="Data Control" value="5" helper="Imports, availability, match, player, and access ops" />
              <MetricCard label="Recommended Flow" value="Preview -> Commit" helper="Validate before writing" />
            </div>

            <div className="card-grid three" style={{ marginTop: 18 }}>
              <MiniPanel
                title="Unified Import"
                text="Use the import center first so schedule and scorecard data always flow through the same ingestion path."
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
                text="Use Access Control when captain subscriptions and TIQ league permissions need explicit profile-level updates."
                tone="slate"
              />
            </div>
          </div>
        </section>

        <section id="imports" style={{ marginTop: 26 }}>
          <SectionHeader
            kicker="Imports"
            title="Bring data into the system and manage weekly result flow"
            subtitle="Start with the unified import center, use missing scorecards to track what is still outstanding, and use lineup availability when weekly readiness needs admin support."
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

        <section
          className="surface-card section"
          style={{
            marginTop: 30,
            padding: 18,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <GlowOrb
            top="-70px"
            right="-50px"
            size={180}
            background="radial-gradient(circle, rgba(74,163,255,0.12) 0%, transparent 72%)"
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 18,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ maxWidth: 760 }}>
                <div className="section-kicker">System map</div>
                <h2 className="section-title" style={{ marginTop: 6 }}>
                  Recommended admin route structure
                </h2>
                <p className="subtle-text" style={{ marginTop: 8, maxWidth: 700 }}>
                  Keep this page as the hub. Route all future schedule and scorecard imports through
                  the unified import center so you avoid the legacy split pipeline problem.
                </p>
              </div>

              <div className="badge badge-green" style={{ minHeight: 42 }}>
                Unified import live
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="data-table" style={{ minWidth: 880 }}>
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Purpose</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>/admin</td>
                    <td>Dashboard / hub only</td>
                    <td>Should render this page only</td>
                  </tr>
                  <tr>
                    <td>/admin/import</td>
                    <td>Unified schedule + scorecard ingest</td>
                    <td>Main import route going forward</td>
                  </tr>
                  <tr>
                    <td>/admin/missing-scorecards</td>
                    <td>Schedule-to-scorecard operations dashboard</td>
                    <td>Best for past-due result follow-up and weekly tracking</td>
                  </tr>
                  <tr>
                    <td>/admin/lineup-availability</td>
                    <td>Availability and readiness support</td>
                    <td>Use when admin operations overlap with captain planning</td>
                  </tr>
                  <tr>
                    <td>/admin/add-match</td>
                    <td>Manual match entry</td>
                    <td>Best for one-off records</td>
                  </tr>
                  <tr>
                    <td>/admin/manage-matches</td>
                    <td>Match review and editing</td>
                    <td>Best for cleanup and oversight</td>
                  </tr>
                  <tr>
                    <td>/admin/manage-players</td>
                    <td>Player editing and maintenance</td>
                    <td>Best for ratings and metadata</td>
                  </tr>
                  <tr>
                    <td>/admin/access</td>
                    <td>Captain and TIQ entitlement control</td>
                    <td>Best for subscription and league-access operations</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section
          className="surface-card section"
          style={{
            marginTop: 30,
            padding: 18,
            background: 'var(--shell-panel-bg-strong)',
            border: '1px solid var(--shell-panel-border)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 1fr',
              gap: 18,
            }}
          >
            <div>
              <div className="section-kicker">Suggested workflow</div>
              <h2 className="section-title" style={{ marginTop: 6 }}>
                A cleaner admin operating rhythm
              </h2>
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  marginTop: 14,
                }}
              >
                <WorkflowStep
                  number="01"
                  title="Import through one pipeline"
                  text="Start with the unified import center so both schedule and scorecard data go through the same preview and commit workflow."
                />
                <WorkflowStep
                  number="02"
                  title="Track what still needs scorecards"
                  text="Use Missing Scorecards after uploads to see which scheduled parent matches are still waiting on results."
                />
                <WorkflowStep
                  number="03"
                  title="Validate and support the week"
                  text="Preview normalized rows, check warnings, and use lineup availability when roster readiness needs admin help."
                />
                <WorkflowStep
                  number="04"
                  title="Clean up records"
                  text="Use Manage Matches and Manage Players to tighten data quality after imports or manual entry."
                />
                <WorkflowStep
                  number="05"
                  title="Update access explicitly"
                  text="Use Access Control when captain subscriptions or TIQ league permissions need to be granted, adjusted, or revoked."
                />
              </div>
            </div>

            <div
              className="surface-card"
              style={{
                padding: 18,
                background: 'var(--shell-panel-bg)',
                border: '1px solid var(--shell-panel-border)',
              }}
            >
              <div
                style={{
                  color: 'var(--foreground)',
                  fontWeight: 800,
                  fontSize: '1rem',
                }}
              >
                Quick actions
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <QuickAction href="/admin/import" label="Open Unified Import Center" />
                <QuickAction href="/admin/missing-scorecards" label="Open Missing Scorecards" />
                <QuickAction href="/admin/lineup-availability" label="Open Lineup Availability" />
                <QuickAction href="/admin/add-match" label="Open Add Match" />
                <QuickAction href="/admin/manage-matches" label="Open Manage Matches" />
                <QuickAction href="/admin/manage-players" label="Open Manage Players" />
                <QuickAction href="/admin/access" label="Open Access Control" />
                <RecalculateRatingsAction />
              </div>
            </div>
          </div>
        </section>
        </section>
      </AdminGate>
    </SiteShell>
  )
}

function HeroSection() {
  return (
    <section
      className="hero-panel"
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <GlowOrb
        top="-110px"
        left="-70px"
        size={270}
        background="radial-gradient(circle, rgba(74,163,255,0.16) 0%, transparent 72%)"
      />
      <GlowOrb
        bottom="-120px"
        right="-90px"
        size={260}
        background="radial-gradient(circle, rgba(155,225,29,0.10) 0%, transparent 74%)"
      />

      <div className="hero-inner" style={{ position: 'relative', zIndex: 1 }}>
        <div className="section-kicker">Admin Command</div>
        <h1 className="page-title">Elite Admin Dashboard</h1>
        <p className="page-subtitle" style={{ maxWidth: 860 }}>
          Centralize imports, manual entry, match cleanup, and player maintenance in one premium
          control surface that matches the rest of the TenAceIQ experience.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 18,
          }}
        >
          <a href="#imports" className="button-primary" style={{ textDecoration: 'none' }}>
            Start with Imports
          </a>
          <a href="#management" className="button-secondary" style={{ textDecoration: 'none' }}>
            Open Management Tools
          </a>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 18,
          }}
        >
          <span className="badge badge-blue">Premium shell aligned</span>
          <span className="badge badge-green">Unified import centered</span>
          <span className="badge badge-slate">Legacy overlap reduced</span>
        </div>
      </div>
    </section>
  )
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
      <div
        style={{
          position: 'absolute',
          top: '-58px',
          right: '-44px',
          width: 170,
          height: 170,
          borderRadius: '999px',
          background: accent.glow,
          pointerEvents: 'none',
          opacity: hovered ? 1 : 0.82,
          transition: 'opacity 180ms ease',
        }}
      />

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
          <span
            style={{
            color: 'var(--foreground)',
              fontWeight: 800,
              fontSize: '1rem',
              opacity: hovered ? 1 : 0.72,
              transition: 'opacity 180ms ease',
            }}
          >
            {accent.icon}
          </span>
        </div>

        <div
          style={{
            marginTop: 16,
            color: 'var(--foreground)',
            fontWeight: 800,
            fontSize: '1.08rem',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
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
                letterSpacing: '-0.01em',
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
          Open tool <span aria-hidden="true">{hovered ? '↗' : '→'}</span>
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

function WorkflowStep({
  number,
  title,
  text,
}: {
  number: string
  title: string
  text: string
}) {
  return (
    <div
      className="surface-card"
      style={{
        padding: 16,
        background: 'var(--shell-panel-bg)',
        border: '1px solid var(--shell-panel-border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            minWidth: 46,
            height: 46,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(155,225,29,0.10)',
            border: '1px solid rgba(155,225,29,0.16)',
            color: '#C8F56B',
            fontWeight: 900,
            fontSize: '0.9rem',
          }}
        >
          {number}
        </div>

        <div>
          <div
            style={{
              color: 'var(--foreground)',
              fontWeight: 800,
              fontSize: '0.98rem',
            }}
          >
            {title}
          </div>
          <div className="subtle-text" style={{ marginTop: 6 }}>
            {text}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecalculateRatingsAction() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleRun() {
    if (status === 'running') return
    setStatus('running')
    setMessage('')
    try {
      await recalculateDynamicRatings()
      setStatus('done')
      setMessage('All dynamic ratings recalculated.')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Recalculation failed.')
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={status === 'running'}
        className="button-secondary"
        style={{ width: '100%', justifyContent: 'space-between', opacity: status === 'running' ? 0.7 : 1 }}
      >
        <span>{status === 'running' ? 'Recalculating…' : 'Recalculate All Ratings'}</span>
        <span aria-hidden="true">⟳</span>
      </button>
      {message ? (
        <div style={{ marginTop: 6, fontSize: 12, color: status === 'error' ? '#f87171' : '#9be11d' }}>
          {message}
        </div>
      ) : null}
    </div>
  )
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="button-secondary"
      style={{
        textDecoration: 'none',
        justifyContent: 'space-between',
        width: '100%',
      }}
    >
      <span>{label}</span>
      <span aria-hidden="true">→</span>
    </Link>
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

function GlowOrb({
  top,
  right,
  bottom,
  left,
  size,
  background,
}: {
  top?: string
  right?: string
  bottom?: string
  left?: string
  size: number
  background: string
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        right,
        bottom,
        left,
        width: size,
        height: size,
        borderRadius: '999px',
        background,
        pointerEvents: 'none',
      }}
    />
  )
}
