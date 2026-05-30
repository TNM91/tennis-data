import type { CSSProperties, ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import {
  TiqCoachAssignmentCard,
  TiqLeagueStandingCard,
  TiqLineupPreview,
  TiqMatchupCard,
  TiqTournamentDrawCard,
  TiqWorkspacePreview,
} from '@/app/components/tiq-product-preview-cards'
import TrackedProductLink, { type ProductLinkEvent } from '@/app/components/tracked-product-link'
import UniversalSearch from '@/app/components/universal-search'
import {
  DATA_ASSIST_STORY,
  PRODUCT_MOTTO,
} from '@/lib/product-story'

export type PublicActionCard = {
  title: string
  body: string
  href: string
  cta: string
  secondaryHref?: string
  secondaryCta?: string
  meta?: string
}

export type PreviewCard = {
  label: string
  title: string
  body: string
  metrics: Array<{ label: string; value: string }>
  href: string
  cta: string
  trust?: TrustSignal[]
}

export type TrustSignal = {
  label: 'Source' | 'Freshness' | 'Confidence' | 'Status'
  value: string
  tone?: 'info' | 'good' | 'warn'
}

const defaultTrustSignals: TrustSignal[] = [
  { label: 'Source', value: 'TIQ demo', tone: 'info' },
  { label: 'Freshness', value: 'Preview', tone: 'info' },
  { label: 'Confidence', value: 'Medium', tone: 'warn' },
  { label: 'Status', value: 'Reviewable', tone: 'good' },
]

function getPublicLinkEvent(label: string, href: string, context: string): ProductLinkEvent | undefined {
  const target = `${label} ${href}`.toLowerCase()
  const metadata = { label, href, context }

  if (target.includes('find a coach')) return { eventName: 'find_coach_clicked', surface: 'coach', metadata }
  if (target.includes('coach hub')) return { eventName: 'coach_hub_clicked', surface: 'coach', metadata }
  if (target.includes('assignment') || target.includes('open paths')) return { eventName: 'coach_assignment_preview_clicked', surface: 'coach', metadata }
  if (target.includes('explore coaches')) return { eventName: 'find_coach_clicked', surface: 'coach', metadata }
  if (target.includes('find teams')) return { eventName: 'team_search_submitted', surface: 'teams', metadata }
  if (target.includes('captain tools')) return { eventName: 'captain_tools_clicked', surface: 'teams', metadata }
  if (target.includes('build lineup')) return { eventName: 'lineup_preview_clicked', surface: 'teams', metadata }
  if (target.includes('availability')) return { eventName: 'availability_clicked', surface: 'teams', metadata }
  if (target.includes('find tournaments')) return { eventName: 'tournament_search_submitted', surface: 'tournaments', metadata }
  if (target.includes('run a tournament')) return { eventName: 'run_tournament_clicked', surface: 'tournaments', metadata }
  if (target.includes('tournament desk') || target.includes('open desk')) return { eventName: 'tournament_desk_clicked', surface: 'tournaments', metadata }
  if (target.includes('draw')) return { eventName: 'draw_preview_clicked', surface: 'tournaments', metadata }
  if (target.includes('find leagues')) return { eventName: 'league_search_submitted', surface: 'leagues', metadata }
  if (target.includes('league office')) return { eventName: 'league_office_clicked', surface: 'leagues', metadata }
  if (target.includes('schedule')) return { eventName: 'schedule_preview_clicked', surface: 'leagues', metadata }
  if (target.includes('standing')) return { eventName: 'standings_preview_clicked', surface: 'leagues', metadata }
  if (target.includes('report issue')) return { eventName: 'data_issue_reported', surface: 'data_assist', metadata }
  if (target.includes('request review')) return { eventName: 'data_assist_opened', surface: 'data_assist', metadata }
  if (target.includes('data assist') || target.includes('upload source')) return { eventName: 'data_assist_opened', surface: 'data_assist', metadata }
  if (target.includes('matchup')) return { eventName: 'matchup_started', surface: 'matchup', metadata }

  return undefined
}

export const homeActionCards: PublicActionCard[] = [
  {
    title: 'Find Players',
    body: 'Search players, ratings, teams, leagues, rankings, and recent context.',
    href: '/explore/players',
    cta: 'Find a Player',
    meta: 'Free',
  },
  {
    title: 'Prepare for a Match',
    body: 'Compare players, scout opponents, check team strength, and know what to watch.',
    href: '/matchup',
    cta: 'Prep a Matchup',
    meta: 'Matchup',
  },
  {
    title: 'Improve Your Game',
    body: 'Open My Lab, choose a goal, use workbook paths, and connect match evidence to progress.',
    href: '/mylab',
    cta: 'Open My Lab',
    meta: 'Player',
  },
  {
    title: 'Find or Work With a Coach',
    body: 'Find coaching support, connect goals, assign drills, and keep progress moving between lessons.',
    href: '/coaches',
    cta: 'Explore Coaches',
    meta: 'Coach Hub',
  },
  {
    title: 'Teams',
    body: 'Find teams, follow rosters, scout opponents, or captain match week.',
    href: '/teams',
    cta: 'Find Teams',
    secondaryHref: '/captain',
    secondaryCta: 'Captain Tools',
    meta: 'Team Hub',
  },
  {
    title: 'Tournaments',
    body: 'Find events, view draws, manage entries, schedule courts, collect results, and publish outcomes.',
    href: '/tournaments',
    cta: 'Find Tournaments',
    secondaryHref: '/tournaments#desk',
    secondaryCta: 'Run a Tournament',
    meta: 'Tournament Desk',
  },
  {
    title: 'Leagues',
    body: 'Find leagues, follow standings, manage schedules, collect results, and run a cleaner season.',
    href: '/leagues',
    cta: 'Find Leagues',
    secondaryHref: '/leagues#office',
    secondaryCta: 'League Office',
    meta: 'League Office',
  },
  {
    title: 'Fix Data',
    body: 'Upload scorecards, schedules, rosters, team summaries, and corrections.',
    href: DATA_ASSIST_STORY.href,
    cta: 'Open Data Assist',
    meta: 'Source review',
  },
]

export const previewCards: PreviewCard[] = [
  {
    label: 'Matchup',
    title: 'Rivera vs Brooks',
    body: 'Watch Brooks return pressure on second serves.',
    metrics: [
      { label: 'Edge', value: 'Rivera +0.18' },
      { label: 'Confidence', value: 'Medium' },
      { label: 'Preview', value: '63%' },
    ],
    href: '/matchup',
    cta: 'Open Matchup',
  },
  {
    label: 'Captain Tools',
    title: 'Saturday vs West County',
    body: 'D1 changes if Brooks is unavailable.',
    metrics: [
      { label: 'Available', value: '8/10' },
      { label: 'Team edge', value: '71%' },
      { label: 'Risk', value: 'Line 1' },
    ],
    href: '/captain/lineup-builder',
    cta: 'Build Lineup',
  },
  {
    label: 'Coach Hub',
    title: 'Ava M.',
    body: 'Serve target routine with evidence due Friday.',
    metrics: [
      { label: 'Assignment', value: 'Active' },
      { label: 'Evidence', value: '3 points' },
      { label: 'Next', value: 'Review' },
    ],
    href: '/coaches',
    cta: 'Review Player',
  },
  {
    label: 'Tournament Desk',
    title: 'Summer Doubles Classic',
    body: 'Draws are drafted and six courts are assigned.',
    metrics: [
      { label: 'Entries', value: '28' },
      { label: 'Draws', value: 'Draft' },
      { label: 'Results', value: 'Clear' },
    ],
    href: '/tournaments',
    cta: 'Open Tournament Desk',
  },
  {
    label: 'League Office',
    title: 'Spring Ladder',
    body: 'Standings are current and three scorecards need review.',
    metrics: [
      { label: 'Teams', value: '10' },
      { label: 'Matches', value: '36' },
      { label: 'Freshness', value: 'Today' },
    ],
    href: '/leagues',
    cta: 'Open League Office',
  },
]

export function PublicPageShell({ active, children }: { active?: string; children: ReactNode }) {
  return <SiteShell active={active}>{children}</SiteShell>
}

export function CommandHero({
  eyebrow = 'TenAceIQ command center',
  title = PRODUCT_MOTTO,
  body,
  primary,
  secondary,
  showSearch = true,
  searchPlaceholder,
}: {
  eyebrow?: string
  title?: string
  body: string
  primary?: { href: string; label: string }
  secondary?: { href: string; label: string }
  showSearch?: boolean
  searchPlaceholder?: string
}) {
  return (
    <section style={heroStyle}>
      <div style={heroCopyStyle}>
        <div style={eyebrowStyle}>{eyebrow}</div>
        <h1 style={heroTitleStyle}>{title}</h1>
        <p style={heroBodyStyle}>{body}</p>
        {showSearch ? <UniversalSearch placeholder={searchPlaceholder} /> : null}
        {(primary || secondary) ? (
          <div style={actionRowStyle}>
            {primary ? (
              <TrackedProductLink href={primary.href} style={primaryButtonStyle} event={getPublicLinkEvent(primary.label, primary.href, 'hero-primary')}>
                {primary.label}
              </TrackedProductLink>
            ) : null}
            {secondary ? (
              <TrackedProductLink href={secondary.href} style={ghostButtonStyle} event={getPublicLinkEvent(secondary.label, secondary.href, 'hero-secondary')}>
                {secondary.label}
              </TrackedProductLink>
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={heroPanelStyle}>
        <div style={miniCourtStyle} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <strong>What tennis thing do you need help with today?</strong>
        <p>Find the tennis landscape, prepare for the next match, improve your game, lead a team, run an event, or fix the data behind the read.</p>
      </div>
    </section>
  )
}

export function ActionGrid({ cards = homeActionCards }: { cards?: PublicActionCard[] }) {
  return (
    <section style={sectionStyle}>
      <SectionHeader eyebrow="Start here" title="What do you need today?" body="TenAceIQ is organized around tennis actions first, then the workspace that saves time when the job gets serious." />
      <div style={actionGridStyle}>
        {cards.map((card) => (
          <article key={card.title} style={actionCardStyle}>
            {card.meta ? <span style={chipStyle}>{card.meta}</span> : null}
            <h2 style={cardTitleStyle}>{card.title}</h2>
            <p style={cardBodyStyle}>{card.body}</p>
            <div style={cardActionRowStyle}>
              <TrackedProductLink href={card.href} style={cardPrimaryLinkStyle} event={getPublicLinkEvent(card.cta, card.href, `action-${card.title}`)}>
                {card.cta}
              </TrackedProductLink>
              {card.secondaryHref && card.secondaryCta ? (
                <TrackedProductLink href={card.secondaryHref} style={cardGhostLinkStyle} event={getPublicLinkEvent(card.secondaryCta, card.secondaryHref, `action-${card.title}-secondary`)}>
                  {card.secondaryCta}
                </TrackedProductLink>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ProductPreviewGrid({ cards = previewCards }: { cards?: PreviewCard[] }) {
  return (
    <section style={sectionStyle}>
      <SectionHeader eyebrow="Product previews" title="The next tennis action, already shaped." body="Preview cards make each workspace feel concrete before a visitor commits to a plan." />
      <div style={previewGridStyle}>
        {cards.map((card) => renderPreviewCard(card))}
      </div>
    </section>
  )
}

function renderPreviewCard(card: PreviewCard) {
  const props = {
    key: card.title,
    title: card.title,
    body: card.body,
    metrics: card.metrics,
    href: card.href,
    cta: card.cta,
    event: getPublicLinkEvent(card.cta, card.href, `preview-${card.label}`),
    trust: card.trust,
  }

  if (card.label === 'Matchup') return <TiqMatchupCard {...props} />
  if (card.label === 'Captain Tools') return <TiqLineupPreview {...props} />
  if (card.label === 'Coach Hub') return <TiqCoachAssignmentCard {...props} />
  if (card.label === 'Tournament Desk') return <TiqTournamentDrawCard {...props} />
  if (card.label === 'League Office') return <TiqLeagueStandingCard {...props} />

  return <TiqWorkspacePreview eyebrow={card.label} {...props} />
}

export function TrustStrip({
  signals = defaultTrustSignals,
  context = 'Homepage trust strip',
}: {
  signals?: TrustSignal[]
  context?: string
}) {
  return <TiqTrustChips signals={signals} context={context} />
}

export function TiqTrustChips({
  signals = defaultTrustSignals,
  context = 'Homepage trust strip',
}: {
  signals?: TrustSignal[]
  context?: string
}) {
  const trustContext = encodeURIComponent(context)
  const uploadHref = `/data-assist?intent=upload-source&context=${trustContext}`
  const reportHref = `/data-assist?intent=report-issue&context=${trustContext}`
  const reviewHref = `/data-assist?intent=request-review&context=${trustContext}`

  return (
    <div style={trustWrapStyle} aria-label="Data trust signals">
      <div style={trustRowStyle}>
        {signals.map((signal) => (
          <span key={`${signal.label}-${signal.value}`} style={trustChipStyle(signal.tone)}>
            <span style={trustChipLabelStyle}>{signal.label}</span>
            {signal.value}
          </span>
        ))}
      </div>
      <div style={trustActionRowStyle}>
        <TrackedProductLink href={uploadHref} style={trustActionStyle} event={getPublicLinkEvent('Upload source', uploadHref, 'trust-strip')}>
          Upload source
        </TrackedProductLink>
        <TrackedProductLink href={reportHref} style={trustActionStyle} event={getPublicLinkEvent('Report issue', reportHref, 'trust-strip')}>
          Report issue
        </TrackedProductLink>
        <TrackedProductLink href={reviewHref} style={trustActionStyle} event={getPublicLinkEvent('Request review', reviewHref, 'trust-strip')}>
          Request review
        </TrackedProductLink>
      </div>
    </div>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  body,
  titleId,
}: {
  eyebrow: string
  title: string
  body: string
  titleId?: string
}) {
  return (
    <div style={sectionHeaderStyle}>
      <span style={eyebrowStyle}>{eyebrow}</span>
      <h2 id={titleId} style={sectionTitleStyle}>{title}</h2>
      <p style={sectionBodyStyle}>{body}</p>
    </div>
  )
}

export function TwoColumnStory({
  id,
  leftTitle,
  leftBody,
  rightTitle,
  rightBody,
}: {
  id?: string
  leftTitle: string
  leftBody: string
  rightTitle: string
  rightBody: string
}) {
  return (
    <section id={id} style={twoColumnStyle}>
      <article style={storyCardStyle}>
        <h2 style={cardTitleStyle}>{leftTitle}</h2>
        <p style={cardBodyStyle}>{leftBody}</p>
      </article>
      <article style={storyCardStyle}>
        <h2 style={cardTitleStyle}>{rightTitle}</h2>
        <p style={cardBodyStyle}>{rightBody}</p>
      </article>
    </section>
  )
}

export const pageWrapStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '18px 0 64px',
  display: 'grid',
  gap: 22,
  minWidth: 0,
}

const heroStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 0.8fr)',
  gap: 18,
  alignItems: 'stretch',
  minWidth: 0,
}

const heroCopyStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'center',
  gap: 16,
  minWidth: 0,
  padding: 24,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(7,20,40,0.90))',
  boxShadow: '0 30px 86px rgba(2, 8, 23, 0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const heroPanelStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'space-between',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 28,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'linear-gradient(160deg, rgba(155,225,29,0.12), rgba(116,190,255,0.08) 42%, rgba(8,16,34,0.84))',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  fontWeight: 760,
}

const eyebrowStyle: CSSProperties = {
  width: 'fit-content',
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2.5rem, 6vw, 5.7rem)',
  lineHeight: 0.92,
  fontWeight: 950,
  letterSpacing: 0,
}

const heroBodyStyle: CSSProperties = {
  margin: 0,
  maxWidth: 820,
  color: 'var(--shell-copy-muted)',
  fontSize: 'clamp(1rem, 1.4vw, 1.2rem)',
  lineHeight: 1.7,
  fontWeight: 700,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'linear-gradient(180deg, #eaff9e 0%, #9be11d 100%)',
  color: '#071226',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 950,
}

const ghostButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(116,190,255,0.16)',
}

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  maxWidth: 820,
  minWidth: 0,
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.65rem, 3vw, 2.6rem)',
  lineHeight: 1.05,
  fontWeight: 950,
}

const sectionBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.7,
}

const actionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const actionCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minHeight: 236,
  alignContent: 'start',
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,16,34,0.74)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.20), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const chipStyle: CSSProperties = {
  width: 'fit-content',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.10)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const cardBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
  fontWeight: 700,
}

const cardActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 'auto',
  minWidth: 0,
}

const cardPrimaryLinkStyle: CSSProperties = {
  ...primaryButtonStyle,
  minHeight: 40,
  fontSize: 12,
}

const cardGhostLinkStyle: CSSProperties = {
  ...ghostButtonStyle,
  minHeight: 40,
  fontSize: 12,
}

const previewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const storyCardStyle: CSSProperties = {
  ...actionCardStyle,
  minHeight: 180,
}

const miniCourtStyle: CSSProperties = {
  position: 'relative',
  minHeight: 180,
  borderRadius: 20,
  border: '2px solid rgba(155,225,29,0.44)',
  background: 'linear-gradient(135deg, rgba(32,75,52,0.76), rgba(12,40,48,0.72))',
  overflow: 'hidden',
}

const trustWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  paddingTop: 4,
  minWidth: 0,
}

const trustRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
}

function trustChipStyle(tone: TrustSignal['tone'] = 'info'): CSSProperties {
  const toneStyles = {
    info: {
      border: '1px solid rgba(116,190,255,0.15)',
      background: 'rgba(116,190,255,0.07)',
    },
    good: {
      border: '1px solid rgba(155,225,29,0.18)',
      background: 'rgba(155,225,29,0.08)',
    },
    warn: {
      border: '1px solid rgba(255,211,106,0.22)',
      background: 'rgba(255,211,106,0.08)',
    },
  } satisfies Record<NonNullable<TrustSignal['tone']>, Pick<CSSProperties, 'border' | 'background'>>

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    padding: '0 9px',
    borderRadius: 999,
    color: 'var(--shell-copy-muted)',
    fontSize: 11,
    lineHeight: 1.2,
    fontWeight: 850,
    ...toneStyles[tone],
  }
}

const trustChipLabelStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 950,
}

const trustActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const trustActionStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  textDecoration: 'none',
}
