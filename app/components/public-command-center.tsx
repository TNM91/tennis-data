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
  PLATFORM_PILLARS,
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
  if (target.includes('start exploring')) return { eventName: 'search_category_selected', surface: 'public_site', metadata }
  if (target.includes('find player insights')) return { eventName: 'search_result_clicked', surface: 'public_site', metadata }
  if (target.includes('level up my game')) return { eventName: 'search_result_clicked', surface: 'public_site', metadata }
  if (target.includes('manage my team')) return { eventName: 'captain_tools_clicked', surface: 'captain', metadata }
  if (target.includes('run a league or tournament')) return { eventName: 'run_tournament_clicked', surface: 'tournaments', metadata }
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
    title: 'Find Player Insights',
    body: 'Search players, ratings, rankings, teams, and recent context so you can understand the tennis landscape fast.',
    href: '/explore/players',
    cta: 'Find Player Insights',
    meta: 'Explore',
  },
  {
    title: 'Level Up My Game',
    body: 'Find drills, skills, development paths, and simple next steps that help you improve with purpose.',
    href: '/player-development',
    cta: 'Level Up My Game',
    meta: 'Improve',
  },
  {
    title: 'Prepare for a Match',
    body: 'Compare players, scout opponents, check team strength, and know what to watch before match time.',
    href: '/matchup',
    cta: 'Prep a Matchup',
    meta: 'Compete',
  },
  {
    title: 'Manage My Team',
    body: 'Collect availability, build lineups, scout opponents, communicate clearly, and reduce match-week chaos.',
    href: '/captain',
    cta: 'Manage My Team',
    meta: 'Manage',
  },
  {
    title: 'Find or Work With a Coach',
    body: 'Find coaching support, connect goals, assign drills, and support player progress between sessions.',
    href: '/coaches',
    cta: 'Explore Coaches',
    meta: 'Coach Hub',
  },
  {
    title: 'Run a League or Tournament',
    body: 'Organize schedules, manage players or teams, track scores, publish results, and reduce admin work.',
    href: '/leagues-and-tournaments',
    cta: 'Run a League or Tournament',
    secondaryHref: '/tournaments',
    secondaryCta: 'Tournament Desk',
    meta: 'Leagues & Tournaments',
  },
  {
    title: 'Fix Tennis Context',
    body: 'Upload scorecards, schedules, rosters, team summaries, and corrections when tennis context needs a cleaner source.',
    href: DATA_ASSIST_STORY.href,
    cta: 'Open Data Assist',
    meta: 'Source review',
  },
]

export const previewCards: PreviewCard[] = [
  {
    label: 'Matchup',
    title: 'Scout the next match',
    body: 'Compare players, read the edge, and know what to watch before first serve.',
    metrics: [
      { label: 'Edge', value: 'Rating + form' },
      { label: 'Confidence', value: 'Context check' },
      { label: 'Next', value: 'Match plan' },
    ],
    href: '/matchup',
    cta: 'Open Matchup',
  },
  {
    label: 'Captain Tools',
    title: 'Build the team week',
    body: 'Check availability, lineup options, and opponent context before you send the plan.',
    metrics: [
      { label: 'Available', value: 'In / bubble / out' },
      { label: 'Team edge', value: 'Projected courts' },
      { label: 'Risk', value: 'Lineup swaps' },
    ],
    href: '/captain/lineup-builder',
    cta: 'Build Lineup',
  },
  {
    label: 'Coach Hub',
    title: 'Assign the next drill',
    body: 'Turn a player goal into court work, proof, and follow-up between lessons.',
    metrics: [
      { label: 'Assignment', value: 'Active plan' },
      { label: 'Evidence', value: 'Player proof' },
      { label: 'Next', value: 'Review' },
    ],
    href: '/coaches',
    cta: 'Review Player',
  },
  {
    label: 'Tournament Desk',
    title: 'Run the event desk',
    body: 'Draft draws, assign courts, track results, and keep players updated from one event sheet.',
    metrics: [
      { label: 'Entries', value: 'Entrants' },
      { label: 'Draws', value: 'Draft / live' },
      { label: 'Results', value: 'Reviewable' },
    ],
    href: '/tournaments',
    cta: 'Open Tournament Desk',
  },
  {
    label: 'League Office',
    title: 'Keep standings current',
    body: 'Publish schedules, collect scores, apply standings rules, and review data fixes.',
    metrics: [
      { label: 'Teams', value: 'Players or teams' },
      { label: 'Scores', value: 'Reviewed' },
      { label: 'Freshness', value: 'Current' },
    ],
    href: '/leagues',
    cta: 'Open League Office',
  },
]

const heroBoardActions = [
  { label: 'Explore', detail: 'Players, teams, leagues, events', href: '/explore' },
  { label: 'Improve', detail: 'Drills and player plans', href: '/player-development' },
  { label: 'Compete', detail: 'Matchups and scouting', href: '/compete' },
  { label: 'Manage', detail: 'Teams and events', href: '/manage' },
  { label: 'Fix Data', detail: 'Scorecards and rosters', href: DATA_ASSIST_STORY.href },
] as const

export function PublicPageShell({ active, children }: { active?: string; children: ReactNode }) {
  return <SiteShell active={active}>{children}</SiteShell>
}

export function CommandHero({
  eyebrow = 'TenAceIQ',
  title = PRODUCT_MOTTO,
  body,
  primary,
  secondary,
  showSearch = true,
  searchCompact = false,
  showSearchResults = true,
  searchPlaceholder,
  showBoard = true,
}: {
  eyebrow?: string
  title?: string
  body: string
  primary?: { href: string; label: string }
  secondary?: { href: string; label: string }
  showSearch?: boolean
  searchCompact?: boolean
  showSearchResults?: boolean
  searchPlaceholder?: string
  showBoard?: boolean
}) {
  return (
    <section style={showBoard ? heroStyle : heroSingleColumnStyle}>
      <div style={heroCopyStyle}>
        <span aria-hidden="true" style={heroCopyBrandMarkStyle} />
        <div style={heroCopyContentStyle}>
          <div style={eyebrowStyle}>{eyebrow}</div>
          <h1 style={heroTitleStyle}>{title}</h1>
          <p style={heroBodyStyle}>{body}</p>
          {showSearch ? (
            <UniversalSearch
              compact={searchCompact}
              placeholder={searchPlaceholder}
              showResults={showSearchResults}
            />
          ) : null}
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
      </div>
      {showBoard ? (
        <div style={heroPanelStyle}>
          <span aria-hidden="true" style={heroPanelBrandMarkStyle} />
          <div style={heroPanelHeaderStyle}>
            <span style={panelKickerStyle}>Quick actions</span>
            <strong style={panelTitleStyle}>Pick the job, then move.</strong>
            <p style={panelCopyStyle}>Search when you know the name. Use a lane when you know what needs doing next.</p>
          </div>
          <div style={heroBoardGridStyle}>
            {heroBoardActions.map((action) => (
              <TrackedProductLink
                key={action.label}
                href={action.href}
                style={heroBoardActionStyle}
                ariaLabel={`${action.label}: ${action.detail}`}
                event={getPublicLinkEvent(action.label, action.href, 'hero-board')}
              >
                <span style={heroBoardActionLabelStyle}>{action.label}</span>
                <span style={heroBoardActionDetailStyle}>{action.detail}</span>
              </TrackedProductLink>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function PlatformPillarGrid() {
  return (
    <section style={sectionStyle} aria-labelledby="platform-pillars-title">
      <SectionHeader
        eyebrow="Tennis lanes"
        title="Improve, compete, and manage without the extra noise."
        body="Three lanes cover the common tennis work: get better, prepare to play, or keep the season moving."
        titleId="platform-pillars-title"
      />
      <div style={pillarGridStyle}>
        {PLATFORM_PILLARS.map((pillar, index) => (
          <article key={pillar.id} style={pillarCardStyle}>
            <span style={pillarLaneStyle}>{`Lane ${index + 1}`}</span>
            <h2 style={cardTitleStyle}>{pillar.title}</h2>
            <p style={pillarPromiseStyle}>{pillar.promise}</p>
            <p style={cardBodyStyle}>{pillar.body}</p>
            <div style={pillarProofGridStyle}>
              {pillar.proof.map((item) => (
                <span key={item} style={pillarProofStyle}>{item}</span>
              ))}
            </div>
            <TrackedProductLink
              href={pillar.href}
              style={cardPrimaryLinkStyle}
              event={getPublicLinkEvent(pillar.cta, pillar.href, `pillar-${pillar.id}`)}
            >
              {pillar.cta}
            </TrackedProductLink>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ActionGrid({ cards = homeActionCards }: { cards?: PublicActionCard[] }) {
  return (
    <section style={sectionStyle}>
      <SectionHeader
        eyebrow="Next best step"
        title="Choose the tennis move you need now."
        body="Search first if you know the name. Use these cards when you know the decision, team week, player goal, event, or data fix in front of you."
      />
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
      <SectionHeader
        eyebrow="Tool previews"
        title="See what each path actually does."
        body="Each preview shows the decision it supports, the signal it reads, and the next tennis action."
      />
      <div style={previewGridStyle}>
        {cards.map((card) => renderPreviewCard(card))}
      </div>
    </section>
  )
}

function renderPreviewCard(card: PreviewCard) {
  const props = {
    title: card.title,
    body: card.body,
    metrics: card.metrics,
    href: card.href,
    cta: card.cta,
    event: getPublicLinkEvent(card.cta, card.href, `preview-${card.label}`),
    trust: card.trust,
  }

  if (card.label === 'Matchup') return <TiqMatchupCard key={card.title} {...props} />
  if (card.label === 'Captain Tools') return <TiqLineupPreview key={card.title} {...props} />
  if (card.label === 'Coach Hub') return <TiqCoachAssignmentCard key={card.title} {...props} />
  if (card.label === 'Tournament Desk') return <TiqTournamentDrawCard key={card.title} {...props} />
  if (card.label === 'League Office') return <TiqLeagueStandingCard key={card.title} {...props} />

  return <TiqWorkspacePreview key={card.title} eyebrow={card.label} {...props} />
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
        <TrackedProductLink href={uploadHref} style={trustActionStyle} event={getPublicLinkEvent('Upload source', uploadHref, context)}>
          Upload source
        </TrackedProductLink>
        <TrackedProductLink href={reportHref} style={trustActionStyle} event={getPublicLinkEvent('Report issue', reportHref, context)}>
          Report issue
        </TrackedProductLink>
        <TrackedProductLink href={reviewHref} style={trustActionStyle} event={getPublicLinkEvent('Request review', reviewHref, context)}>
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
  padding: '18px 0 56px',
  display: 'grid',
  gap: 18,
  minWidth: 0,
}

const heroStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
  gap: 'clamp(12px, 2vw, 18px)',
  alignItems: 'stretch',
  minWidth: 0,
}

const heroSingleColumnStyle: CSSProperties = {
  ...heroStyle,
  gridTemplateColumns: 'minmax(0, 1fr)',
}

const heroCopyStyle: CSSProperties = {
  position: 'relative',
  containerType: 'inline-size',
  display: 'grid',
  alignContent: 'center',
  gap: 10,
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
  padding: 'clamp(14px, 4cqw, 22px)',
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(7,20,40,0.90))',
  boxShadow: '0 30px 86px rgba(2, 8, 23, 0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
  overflow: 'hidden',
}

const heroCopyBrandMarkStyle: CSSProperties = {
  position: 'absolute',
  right: 'clamp(14px, 4vw, 36px)',
  bottom: 'clamp(12px, 4vw, 34px)',
  width: 'min(58%, 420px)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.12,
  mixBlendMode: 'screen',
  pointerEvents: 'none',
  zIndex: 0,
}

const heroCopyContentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const heroPanelStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
  padding: 'clamp(14px, 3cqw, 16px)',
  borderRadius: 8,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'linear-gradient(160deg, rgba(155,225,29,0.12), rgba(116,190,255,0.08) 42%, rgba(8,16,34,0.84))',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.55,
  fontWeight: 760,
  overflow: 'hidden',
}

const heroPanelBrandMarkStyle: CSSProperties = {
  position: 'absolute',
  right: 'clamp(14px, 3vw, 28px)',
  top: 'clamp(26px, 5vw, 58px)',
  width: 'min(70%, 430px)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.2,
  mixBlendMode: 'screen',
  pointerEvents: 'none',
  zIndex: 0,
}

const heroPanelHeaderStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const panelKickerStyle: CSSProperties = {
  width: 'fit-content',
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const panelTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 19,
  lineHeight: 1.05,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const panelCopyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.36,
  fontWeight: 720,
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
  fontSize: 'clamp(2.05rem, 9cqw, 3.7rem)',
  lineHeight: 0.95,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const heroBodyStyle: CSSProperties = {
  margin: 0,
  maxWidth: 820,
  color: 'var(--shell-copy-muted)',
  fontSize: 'clamp(0.9rem, 2.2cqw, 1.08rem)',
  lineHeight: 1.48,
  fontWeight: 700,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 42,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'linear-gradient(180deg, #eaff9e 0%, #9be11d 100%)',
  color: '#071226',
  textDecoration: 'none',
  fontSize: 12.5,
  fontWeight: 950,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const ghostButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(116,190,255,0.16)',
}

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  maxWidth: 820,
  minWidth: 0,
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.45rem, 2.6vw, 2.25rem)',
  lineHeight: 1.05,
  fontWeight: 950,
}

const sectionBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.55,
}

const actionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const actionCardStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  minHeight: 202,
  alignContent: 'start',
  padding: 16,
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,16,34,0.74)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.20), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const chipStyle: CSSProperties = {
  width: 'fit-content',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 26,
  padding: '0 9px',
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
  fontSize: 22,
  lineHeight: 1.08,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const cardBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.5,
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

const pillarGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const pillarCardStyle: CSSProperties = {
  ...actionCardStyle,
  minHeight: 244,
  border: '1px solid rgba(155,225,29,0.16)',
  background:
    'linear-gradient(160deg, rgba(155,225,29,0.08), rgba(116,190,255,0.055) 40%, rgba(8,16,34,0.84))',
}

const pillarLaneStyle: CSSProperties = {
  width: 'fit-content',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(116,190,255,0.07)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const pillarPromiseStyle: CSSProperties = {
  margin: '-2px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.35,
  fontWeight: 900,
}

const pillarProofGridStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const pillarProofStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 9px',
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.58)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const previewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 12,
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

const heroBoardGridStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 7,
  minWidth: 0,
}

const heroBoardActionStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minHeight: 50,
  padding: 8,
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(7,17,33,0.74)',
  color: 'var(--shell-copy-muted)',
  textDecoration: 'none',
  minWidth: 0,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const heroBoardActionLabelStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.1,
  fontWeight: 950,
}

const heroBoardActionDetailStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11.5,
  lineHeight: 1.22,
  fontWeight: 760,
  overflowWrap: 'anywhere',
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
