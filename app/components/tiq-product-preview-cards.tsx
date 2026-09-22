import type { CSSProperties, ReactNode } from 'react'
import TrackedProductLink, { type ProductLinkEvent } from '@/app/components/tracked-product-link'

type Metric = {
  label: string
  value: string
}

type TrustChipTone = 'info' | 'good' | 'warn' | 'danger'

type TrustChip = {
  label: string
  value: string
  tone?: TrustChipTone
}

type PreviewCardProps = {
  eyebrow: string
  title: string
  body: string
  metrics?: Metric[]
  href?: string
  cta?: string
  event?: ProductLinkEvent
  trust?: TrustChip[]
  children?: ReactNode
}

export function TiqWorkspacePreview(props: PreviewCardProps) {
  return <TiqPreviewCard {...props} />
}

export function TiqEntityCard(props: PreviewCardProps) {
  return <TiqPreviewCard {...props} />
}

export function TiqActionCard(props: PreviewCardProps) {
  return <TiqPreviewCard {...props} />
}

export function TiqMatchupCard({
  title = 'Scout the next match',
  body = 'Compare players, read the edge, and know what to watch before first serve.',
  metrics = [
    { label: 'Edge', value: 'Rating + form' },
    { label: 'Confidence', value: 'Context check' },
    { label: 'Next', value: 'Match plan' },
  ],
  ...props
}: Partial<PreviewCardProps>) {
  return <TiqPreviewCard eyebrow="Matchup" title={title} body={body} metrics={metrics} {...props} />
}

export function TiqLineupPreview({
  title = 'Build the team week',
  body = 'Check availability, lineup options, and opponent context before you send the plan.',
  metrics = [
    { label: 'Available', value: 'In / bubble / out' },
    { label: 'Team edge', value: 'Projected courts' },
    { label: 'Risk', value: 'Lineup swaps' },
  ],
  ...props
}: Partial<PreviewCardProps>) {
  return <TiqPreviewCard eyebrow="Captain Tools" title={title} body={body} metrics={metrics} {...props} />
}

export function TiqCoachAssignmentCard({
  title = 'Assign the next drill',
  body = 'Turn a player goal into court work, proof, and follow-up between lessons.',
  metrics = [
    { label: 'Assignment', value: 'Active plan' },
    { label: 'Evidence', value: 'Player proof' },
    { label: 'Next', value: 'Review' },
  ],
  ...props
}: Partial<PreviewCardProps>) {
  return <TiqPreviewCard eyebrow="Coach Hub" title={title} body={body} metrics={metrics} {...props} />
}

export function TiqTournamentDrawCard({
  title = 'Run the event desk',
  body = 'Draft draws, assign courts, track results, and keep players updated from one event sheet.',
  metrics = [
    { label: 'Entries', value: 'Entrants' },
    { label: 'Draws', value: 'Draft / live' },
    { label: 'Results', value: 'Reviewable' },
  ],
  ...props
}: Partial<PreviewCardProps>) {
  return <TiqPreviewCard eyebrow="Tournament Desk" title={title} body={body} metrics={metrics} {...props} />
}

export function TiqLeagueStandingCard({
  title = 'Keep standings current',
  body = 'Publish schedules, collect scores, apply standings rules, and review data fixes.',
  metrics = [
    { label: 'Teams', value: 'Players or teams' },
    { label: 'Scores', value: 'Reviewed' },
    { label: 'Freshness', value: 'Current' },
  ],
  ...props
}: Partial<PreviewCardProps>) {
  return <TiqPreviewCard eyebrow="League Office" title={title} body={body} metrics={metrics} {...props} />
}

export function TiqResourceCard(props: PreviewCardProps) {
  return <TiqPreviewCard {...props} />
}

export function TiqEmptyState({
  title,
  body,
  actions = [],
}: {
  title: string
  body: string
  actions?: Array<{ href: string; label: string; event?: ProductLinkEvent }>
}) {
  return (
    <section style={emptyStateStyle}>
      <h2 style={titleStyle}>{title}</h2>
      <p style={bodyStyle}>{body}</p>
      {actions.length ? (
        <div style={actionRowStyle}>
          {actions.map((action) => (
            <TrackedProductLink key={action.href} href={action.href} style={linkStyle} ariaLabel={`${action.label}: ${title}`} event={action.event}>
              {action.label}
            </TrackedProductLink>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function TiqConfidenceChip({ value, tone = 'warn' }: { value: string; tone?: TrustChipTone }) {
  return <span style={trustChipStyle(tone)}>Confidence: {value}</span>
}

export function TiqSourceFreshnessChip({ source, freshness }: { source: string; freshness: string }) {
  return (
    <span style={trustChipStyle('info')}>
      Source: {source} | Freshness: {freshness}
    </span>
  )
}

function TiqPreviewCard({
  eyebrow,
  title,
  body,
  metrics = [],
  href,
  cta,
  event,
  trust = [],
  children,
}: PreviewCardProps) {
  const titleId = `${slugifyForId(eyebrow)}-${slugifyForId(title)}-title`
  const bodyId = `${slugifyForId(eyebrow)}-${slugifyForId(title)}-body`

  return (
    <article style={cardStyle} aria-labelledby={titleId} aria-describedby={bodyId}>
      <div style={topRowStyle}>
        <span style={eyebrowStyle}>{eyebrow}</span>
        {href && cta ? (
          <TrackedProductLink href={href} style={smallLinkStyle} ariaLabel={`${cta}: ${title}`} event={event}>
            {cta}
          </TrackedProductLink>
        ) : null}
      </div>
      <h2 id={titleId} style={titleStyle}>{title}</h2>
      <p id={bodyId} style={bodyStyle}>{body}</p>
      {metrics.length ? (
        <dl style={metricGridStyle} aria-label={`${title} metrics`}>
          {metrics.map((metric) => (
            <div key={metric.label} style={metricStyle}>
              <dt>{metric.label}</dt>
              <dd style={metricValueStyle}>{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {trust.length ? (
        <div style={trustRowStyle} aria-label={`${title} trust signals`}>
          {trust.map((chip) => (
            <span key={`${chip.label}-${chip.value}`} style={trustChipStyle(chip.tone)}>
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      ) : null}
      {children}
    </article>
  )
}

function slugifyForId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tiq-card'
}

const cardStyle: CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 16,
  display: 'grid',
  gap: 12,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const emptyStateStyle: CSSProperties = {
  ...cardStyle,
  textAlign: 'left',
}

const topRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  padding: '5px 9px',
  fontSize: 11,
  fontWeight: 950,
  lineHeight: 1,
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.2,
  fontWeight: 950,
}

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 720,
}

const metricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const metricStyle: CSSProperties = {
  borderRadius: 8,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 10,
  display: 'grid',
  gap: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
  minWidth: 0,
}

const metricValueStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 950,
}

const trustRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const trustChipStyle = (tone: TrustChipTone = 'info'): CSSProperties => ({
  borderRadius: 999,
  border: tone === 'good'
    ? '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)'
    : tone === 'danger'
      ? '1px solid rgba(248,113,113,0.34)'
      : tone === 'warn'
        ? '1px solid rgba(251,191,36,0.34)'
        : '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  padding: '6px 9px',
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.2,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
})

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const linkStyle: CSSProperties = {
  minHeight: 40,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  padding: '0 12px',
  fontSize: 12,
  fontWeight: 950,
}

const smallLinkStyle: CSSProperties = {
  ...linkStyle,
  minHeight: 34,
}
