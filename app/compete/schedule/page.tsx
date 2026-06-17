'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import QuickMessageComposer from '@/app/components/quick-message-composer'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState } from '@/lib/access-model'
import { useAuth } from '@/app/components/auth-provider'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import { cleanText, formatWeekdayDate } from '@/lib/captain-formatters'
import { supabase } from '@/lib/supabase'
import { PRODUCT_MOTTO } from '@/lib/product-story'

type ScheduleMatch = {
  id: string
  match_date: string | null
  match_time: string | null
  facility: string | null
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
}

const dataAssistScheduleHref = '/data-assist?intent=upload-source&context=League%20Office%20schedule'

const emptyScheduleActions = [
  { href: '/league-coordinator#league-setup-form', label: 'League setup' },
  { href: dataAssistScheduleHref, label: 'Upload schedule' },
  { href: '/messages', label: 'Coordinate dates' },
  { href: '/league-coordinator/results', label: 'Team results' },
] as const

const schedulePathActions = [
  {
    href: '/league-coordinator#league-setup-form',
    job: 'publish_dates',
    question: 'How do I organize the season?',
    title: 'Publish dates',
    body: 'Start or edit the shared league schedule before captains and players chase match details.',
    cta: 'Set schedule',
  },
  {
    href: dataAssistScheduleHref,
    job: 'upload_schedule',
    question: 'How do I avoid retyping dates?',
    title: 'Upload a schedule',
    body: 'Send reviewed TennisLink schedule exports through Data Assist so League Office can refresh dates.',
    cta: 'Upload dates',
  },
  {
    href: '#up-next-schedule',
    job: 'prep_match_week',
    question: 'What match needs prep?',
    title: 'Open match week',
    body: 'Use ready dates, sites, and teams to move into availability, lineup, briefs, and messages.',
    cta: 'View up next',
  },
  {
    href: '/league-coordinator/results',
    job: 'post_results',
    question: 'What happens after the match?',
    title: 'Post results',
    body: 'Move finished matches into the team scorebook once score entry is ready.',
    cta: 'Open scorebook',
  },
] as const

function PrepLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...prepLinkStyle,
        borderColor: hovered ? 'rgba(155,225,29,0.32)' : prepLinkStyle.borderColor,
        color: hovered ? '#d9f84a' : prepLinkStyle.color,
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
    >
      {children}
    </Link>
  )
}

export default function CompeteSchedulePage() {
  return (
    <CompetePageFrame
      eyebrow="Schedule"
      title="Next matches, next actions."
      description="Dates, opponents, facilities, briefs, availability, lineups, and messages stay connected."
    >
      <CompeteScheduleContent />
    </CompetePageFrame>
  )
}

function CompeteScheduleContent() {
  const { role, userId, entitlements, authResolved } = useAuth()
  const [matches, setMatches] = useState<ScheduleMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])
  const postedDateCount = matches.filter((match) => match.match_date).length
  const facilityCount = matches.filter((match) => cleanText(match.facility)).length
  const teamContextCount = matches.filter((match) => cleanText(match.home_team) || cleanText(match.away_team)).length
  const scheduleReadyCount = matches.filter((match) =>
    match.match_date && (cleanText(match.home_team) || cleanText(match.away_team)),
  ).length
  const schedulerStatusItems = [
    {
      label: 'Dates',
      value: matches.length ? `${postedDateCount}/${matches.length}` : 'Waiting',
      ready: matches.length > 0 && postedDateCount === matches.length,
    },
    {
      label: 'Sites',
      value: matches.length ? `${facilityCount}/${matches.length}` : 'Waiting',
      ready: matches.length > 0 && facilityCount === matches.length,
    },
    {
      label: 'Teams',
      value: matches.length ? `${teamContextCount}/${matches.length}` : 'Waiting',
      ready: matches.length > 0 && teamContextCount === matches.length,
    },
  ]
  const calendarLayerItems = [
    {
      label: 'My calendar',
      value: scheduleReadyCount ? `${scheduleReadyCount} visible` : 'Empty',
      detail: 'Your private tennis view for matches, practices, lessons, and RSVPs.',
      action: 'Open Messages',
      href: '/messages#alerts',
    },
    {
      label: 'Shared league',
      value: matches.length ? `${matches.length} events` : 'Waiting',
      detail: 'League Office dates everyone can trust before team prep starts.',
      action: 'Upload dates',
      href: dataAssistScheduleHref,
    },
    {
      label: 'Team overlays',
      value: teamContextCount ? `${teamContextCount} ready` : 'Needs teams',
      detail: 'Captain views can layer team matches, availability, and lineup work.',
      action: 'Open week',
      href: '/captain/weekly-brief',
    },
    {
      label: 'External sync',
      value: 'Planned',
      detail: 'Google, Outlook, and iCal should subscribe to the same TIQ calendar feed.',
      action: 'Coordinate',
      href: '/messages?compose=support&category=league&subject=Calendar%20sync',
    },
  ] as const

  useEffect(() => {
    let active = true

    async function loadUpcomingMatches() {
      setLoading(true)
      setError('')

      const today = new Date().toISOString().slice(0, 10)
      const { data, error: scheduleError } = await supabase
        .from('matches')
        .select('id, match_date, match_time, facility, league_name, flight, home_team, away_team')
        .is('line_number', null)
        .gte('match_date', today)
        .order('match_date', { ascending: true })
        .limit(12)

      if (!active) return

      if (scheduleError) {
        setError(scheduleError.message)
        setMatches([])
      } else {
        setMatches((data ?? []) as ScheduleMatch[])
      }

      setLoading(false)
    }

    void loadUpcomingMatches()

    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <SchedulePathPanel />

      <CompeteGrid>
        <CompeteCard
          href="/league-coordinator#league-setup-form"
          meta="League setup"
          title="Publish dates"
          text="Structure the season calendar before players and captains start chasing times."
          icon="schedule"
          action="Set schedule"
        />
        <CompeteCard
          href="/league-coordinator/results"
          meta="Scorebook"
          title="Team book"
          text="Move confirmed matches into score entry when results are ready."
          icon="reports"
          action="Open book"
        />
        <CompeteCard
          href="/captain"
          meta="Team handoff"
          title="Team week"
          text="Use the schedule as the handoff into availability, lineups, and messages."
          icon="captainDashboard"
          action="Open week"
        />
      </CompeteGrid>

      {authResolved && !access.canUseCaptainWorkflow ? (
        <div style={upgradeWrapStyle}>
          <UpgradePrompt
            planId="captain"
            compact
            headline="Turn the calendar into the team week."
            body="Captain connects confirmed dates to availability, lineup planning, and team messages."
            ctaLabel="Unlock Captain"
            ctaHref="/pricing"
            secondaryLabel="See Captain plan"
            secondaryHref="/pricing"
            footnote="Best when schedule context needs to become team action."
          />
        </div>
      ) : null}

      <section id="up-next-schedule" style={panelStyle}>
        <div style={sectionEyebrowStyle}>Up Next</div>
        <div style={sectionTextStyle}>
          Confirmed matches stay visible before they become team prep or scorebook work.
        </div>
        <div style={schedulerStripStyle} aria-label="League scheduler status">
          <div style={schedulerStripCopyStyle}>
            <strong>Shared scheduler</strong>
            <span>Confirmed dates become prep, messages, and result entry.</span>
          </div>
          <div style={schedulerStatusGridStyle}>
            {schedulerStatusItems.map((item) => (
              <div key={item.label} style={schedulerStatusItemStyle}>
                <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} />
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </div>
            ))}
          </div>
        </div>
        <div style={calendarLayerPanelStyle} aria-label="Calendar layers">
          <div style={calendarLayerHeaderStyle}>
            <div>
              <strong>Calendar layers</strong>
              <span>Keep one personal tennis calendar, then layer shared league, team, coach, and message schedules on top.</span>
            </div>
            <Link href="/messages" style={calendarLayerActionStyle}>
              Scheduling inbox
            </Link>
          </div>
          <div style={calendarLayerGridStyle}>
            {calendarLayerItems.map((item) => (
              <Link key={item.label} href={item.href} style={calendarLayerCardStyle}>
                <span style={calendarLayerMetaStyle}>{item.label}</span>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
                <span style={calendarLayerActionTextStyle}>{item.action}</span>
              </Link>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={emptyStyle}>Loading upcoming matches...</div>
        ) : error ? (
          <div style={warningStyle}>{error}</div>
        ) : matches.length === 0 ? (
          <EmptyScheduleState />
        ) : (
          <div style={listStyle}>
            {matches.map((match) => (
              <ScheduleMatchRow key={match.id} match={match} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function SchedulePathPanel() {
  return (
    <section style={schedulePathStyle} aria-labelledby="compete-schedule-path-title">
      <div style={schedulePathHeaderStyle}>
        <div>
          <span style={schedulePathEyebrowStyle}>Schedule path</span>
          <h2 id="compete-schedule-path-title" style={schedulePathTitleStyle}>{PRODUCT_MOTTO}</h2>
        </div>
        <p style={schedulePathIntroStyle}>
          Start with the calendar job, then open the smallest action that keeps match week moving.
        </p>
      </div>
      <div style={schedulePathGridStyle}>
        {schedulePathActions.map((action) => (
          <Link
            key={action.job}
            href={action.href}
            style={schedulePathCardStyle}
            data-compete-schedule-path-job={action.job}
            aria-label={`${action.cta}: ${action.question}`}
          >
            <span style={schedulePathQuestionStyle}>{action.question}</span>
            <strong style={schedulePathCardTitleStyle}>{action.title}</strong>
            <span>{action.body}</span>
            <span style={schedulePathCtaStyle}>{action.cta}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function EmptyScheduleState() {
  return (
    <div style={emptySchedulerStyle}>
      <strong>Start the shared calendar.</strong>
      <span>Build the league schedule, upload reviewed dates, or coordinate match times before results are ready.</span>
      <div style={emptyActionGridStyle}>
        {emptyScheduleActions.map((action) => (
          <Link key={action.href} href={action.href} style={emptyActionStyle}>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function ScheduleMatchRow({ match }: { match: ScheduleMatch }) {
  const homeTeam = cleanText(match.home_team)
  const awayTeam = cleanText(match.away_team)
  const league = cleanText(match.league_name)
  const flight = cleanText(match.flight)
  const facility = cleanText(match.facility)
  const teams = [homeTeam, awayTeam].filter(Boolean)
  const rowReadinessItems = [
    { label: 'Date', value: match.match_date ? 'Set' : 'Missing', ready: Boolean(match.match_date) },
    { label: 'Site', value: facility || 'Missing', ready: Boolean(facility) },
    { label: 'Teams', value: teams.length >= 2 ? 'Ready' : 'Needs team', ready: teams.length >= 2 },
  ]
  const primaryTeam = homeTeam || awayTeam
  const primaryOpponent = primaryTeam === homeTeam ? awayTeam : homeTeam
  const rowScope = {
    competitionLayer: 'usta',
    team: primaryTeam,
    league,
    flight,
    date: match.match_date || '',
    opponent: primaryOpponent,
  }
  const scheduleIsReady = rowReadinessItems.every((item) => item.ready)
  const rowNextHref = scheduleIsReady && primaryTeam
    ? buildCaptainScopedHref('/captain/weekly-brief', rowScope)
    : dataAssistScheduleHref
  const rowNextLabel = scheduleIsReady ? 'Open prep' : 'Fill schedule'
  const supportSubject = `Question about ${homeTeam || 'home team'} vs ${awayTeam || 'away team'}`
  const supportBody = [
    `Match: ${homeTeam || 'Home team TBD'} vs ${awayTeam || 'Away team TBD'}`,
    league ? `League: ${league}` : '',
    flight ? `Flight: ${flight}` : '',
    match.match_date ? `Date: ${match.match_date}` : '',
    facility ? `Facility: ${facility}` : '',
    '',
    'What I need help with:',
  ].filter(Boolean).join('\n')

  return (
    <div style={rowStyle}>
      <div style={matchInfoStyle}>
        <div style={rowDateStyle}>
          {formatWeekdayDate(match.match_date, 'Date TBD')}
          {match.match_time ? ` at ${match.match_time}` : ''}
        </div>
        <div style={rowTitleStyle}>
          {homeTeam || 'Home team TBD'} vs {awayTeam || 'Away team TBD'}
        </div>
        <div style={rowMetaStyle}>
          {[league, flight, facility].filter(Boolean).join(' | ') || 'League context pending'}
        </div>
        <div style={rowReadinessGridStyle}>
          {rowReadinessItems.map((item) => (
            <div key={item.label} style={rowReadinessItemStyle}>
              <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
          <Link href={rowNextHref} style={rowNextActionStyle}>
            {rowNextLabel}
          </Link>
        </div>
        <div style={supportActionRowStyle}>
          <QuickMessageComposer
            mode="support"
            triggerLabel="Ask support"
            category="league"
            subject={supportSubject}
            body={supportBody}
            entityType="schedule_match"
            entityId={match.id}
          />
        </div>
      </div>

      <div style={teamPrepStackStyle}>
        {teams.length > 0 ? (
          teams.map((team) => {
            const opponent = team === homeTeam ? awayTeam : homeTeam
            const scope = {
              competitionLayer: 'usta',
              team,
              league,
              flight,
              date: match.match_date || '',
              opponent,
            }

            return (
              <div key={team} style={teamPrepRowStyle}>
                <div style={teamPrepNameStyle}>{team}</div>
                <div style={prepActionRowStyle}>
                  <PrepLink href={buildCaptainScopedHref('/captain/weekly-brief', scope)}>Brief</PrepLink>
                  <PrepLink href={buildCaptainScopedHref('/captain/availability', scope)}>Availability</PrepLink>
                  <PrepLink href={buildCaptainScopedHref('/captain/lineup-builder', scope)}>Lineup</PrepLink>
                  {opponent ? (
                    <QuickMessageComposer
                      mode="direct"
                      triggerLabel="Message opponent"
                      recipientName={opponent}
                      subject={`${team} vs ${opponent}`}
                      body={[
                        `Hi ${opponent},`,
                        '',
                        `Checking in about ${team} vs ${opponent}${match.match_date ? ` on ${match.match_date}` : ''}.`,
                      ].join('\n')}
                      entityType="schedule_match"
                      entityId={match.id}
                    />
                  ) : null}
                </div>
              </div>
            )
          })
        ) : (
          <PrepLink href="/captain">Open Captain</PrepLink>
        )}
      </div>
    </div>
  )
}

const upgradeWrapStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '12px',
  marginTop: '24px',
} as const

const panelStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '12px',
  marginTop: '24px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8, 16, 34, 0.74)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
} as const

const schedulePathStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '14px',
  padding: '16px',
  borderRadius: '22px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.09), rgba(116,190,255,0.045)), rgba(8,16,34,0.76)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.22), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const schedulePathHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const schedulePathEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const schedulePathTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(22px, 5vw, 30px)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const schedulePathIntroStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.55,
  fontWeight: 750,
  maxWidth: 560,
  overflowWrap: 'anywhere',
}

const schedulePathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: '10px',
  minWidth: 0,
}

const schedulePathCardStyle: CSSProperties = {
  display: 'grid',
  gap: '7px',
  alignContent: 'start',
  minHeight: 148,
  minWidth: 0,
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.72)',
  color: 'var(--shell-copy-muted)',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const schedulePathQuestionStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  lineHeight: 1.3,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const schedulePathCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const schedulePathCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '12px',
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const sectionEyebrowStyle = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  color: 'var(--brand-blue-2)',
} as const

const sectionTextStyle = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.72,
} as const

const schedulerStripStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: '12px',
  alignItems: 'center',
  minWidth: 0,
  padding: '14px',
  borderRadius: '20px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.08), rgba(116,190,255,0.055))',
} as const

const schedulerStripCopyStyle = {
  display: 'grid',
  gap: '4px',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
} as const

const schedulerStatusGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 110px), 1fr))',
  gap: '8px',
  minWidth: 0,
} as const

const schedulerStatusItemStyle = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '2px 7px',
  alignItems: 'center',
  minWidth: 0,
  padding: '9px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,16,34,0.42)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 850,
  overflowWrap: 'anywhere',
} as const

const calendarLayerPanelStyle = {
  display: 'grid',
  gap: '12px',
  minWidth: 0,
  padding: '14px',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,16,34,0.52)',
} as const

const calendarLayerHeaderStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '10px',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
} as const

const calendarLayerGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: '10px',
  minWidth: 0,
} as const

const calendarLayerCardStyle = {
  display: 'grid',
  gap: '7px',
  minWidth: 0,
  minHeight: '150px',
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
} as const

const calendarLayerMetaStyle = {
  color: 'var(--brand-blue-2)',
  fontSize: '11px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
} as const

const calendarLayerActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '34px',
  maxWidth: '100%',
  padding: '0 11px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(116,190,255,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
} as const

const calendarLayerActionTextStyle = {
  color: '#d9f84a',
  fontSize: '12px',
  fontWeight: 950,
  overflowWrap: 'anywhere',
} as const

const readinessDotReadyStyle = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
} as const

const readinessDotWaitingStyle = {
  ...readinessDotReadyStyle,
  background: 'rgba(116,190,255,0.46)',
  boxShadow: '0 0 0 4px rgba(116,190,255,0.08)',
} as const

const emptyStyle = {
  padding: '16px',
  borderRadius: '18px',
  border: '1px dashed rgba(116,190,255,0.18)',
  color: 'var(--shell-copy-muted)',
  background: 'rgba(8,16,34,0.66)',
} as const

const emptySchedulerStyle = {
  ...emptyStyle,
  display: 'grid',
  gap: '10px',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
} as const

const emptyActionGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
  gap: '8px',
  minWidth: 0,
} as const

const emptyActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '36px',
  maxWidth: '100%',
  padding: '0 11px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(116,190,255,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
} as const

const warningStyle = {
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(251,191,36,0.18)',
  background: 'rgba(120,80,0,0.18)',
  color: 'rgba(253,230,138,0.88)',
  fontSize: '13px',
  lineHeight: 1.55,
} as const

const listStyle = {
  display: 'grid',
  gap: '12px',
} as const

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: '16px',
  alignItems: 'center',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.66)',
  minWidth: 0,
} as const

const matchInfoStyle = {
  minWidth: 0,
} as const

const rowDateStyle = {
  color: '#9be11d',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
} as const

const rowTitleStyle = {
  marginTop: '6px',
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 850,
  lineHeight: 1.35,
} as const

const rowMetaStyle = {
  marginTop: '5px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
} as const

const rowReadinessGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))',
  gap: '8px',
  marginTop: '12px',
  minWidth: 0,
} as const

const rowReadinessItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  minHeight: '34px',
  minWidth: 0,
  padding: '7px 9px',
  borderRadius: '12px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.035)',
  color: 'rgba(223,238,255,0.84)',
  fontSize: '12px',
  fontWeight: 850,
  overflow: 'hidden',
} as const

const rowNextActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '34px',
  minWidth: 0,
  padding: '7px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.11)',
  color: '#f5ffe2',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  textAlign: 'center',
} as const

const supportActionRowStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '10px',
  minWidth: 0,
} as const

const teamPrepStackStyle = {
  display: 'grid',
  gap: '10px',
} as const

const teamPrepRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: '10px',
  alignItems: 'center',
} as const

const teamPrepNameStyle = {
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  fontWeight: 850,
  overflowWrap: 'anywhere',
} as const

const prepActionRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: '8px',
  minWidth: 0,
} as const

const prepLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: '30px',
  padding: '0 10px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.16)',
  borderColor: 'rgba(116,190,255,0.16)',
  background: 'rgba(116,190,255,0.08)',
  color: '#dfeeff',
  fontSize: '12px',
  fontWeight: 850,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
  transition: 'transform 160ms ease, border-color 160ms ease, color 160ms ease',
} as const
