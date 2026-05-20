'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
      title="Upcoming matches should drive the weekly flow."
      description="Schedule is the bridge between browseable season data and action-oriented preparation. This route anchors the week around what is next, then routes users into the execution tools that already work."
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
      <CompeteGrid>
        <CompeteCard
          href="/captain"
          meta="Weekly hub"
          title="Captain Week View"
          text="Use Captain tools as the current working surface for upcoming team matches and preparation status."
          icon="captainDashboard"
          action="Open week"
        />
        <CompeteCard
          href="/captain/scenario-builder"
          meta="Scenario prep"
          title="Scenario Builder"
          text="Test likely opponent outcomes and lineup branches before match day."
          icon="scenarioBuilder"
          action="Test options"
        />
        <CompeteCard
          href="/mylab"
          meta="Player prep"
          title="My Lab"
          text="Use premium comparison work when schedule context turns into opponent-specific preparation."
          icon="myLab"
          action="Open lab"
        />
      </CompeteGrid>

      {authResolved && !access.canUseCaptainWorkflow ? (
        <div style={upgradeWrapStyle}>
          <UpgradePrompt
            planId="captain"
            compact
            headline="Need your schedule to lead straight into lineup prep?"
            body="Unlock Captain to move from what is next on the calendar into availability, scenarios, lineups, and team messaging without losing context."
            ctaLabel="Build Smarter Lineups"
            ctaHref="/pricing"
            secondaryLabel="See Captain plan"
            secondaryHref="/pricing"
            footnote="Best for captains who want schedule context to become action instead of another page to check."
          />
        </div>
      ) : null}

      <section style={panelStyle}>
        <div style={sectionEyebrowStyle}>Up Next</div>
        <div style={sectionTextStyle}>
          Upcoming parent matches now carry team context directly into captain prep tools.
        </div>

        {loading ? (
          <div style={emptyStyle}>Loading upcoming matches...</div>
        ) : error ? (
          <div style={warningStyle}>{error}</div>
        ) : matches.length === 0 ? (
          <div style={emptyStyle}>
            No upcoming team matches are visible yet. When schedule data lands, this page will route each team into weekly prep.
          </div>
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

function ScheduleMatchRow({ match }: { match: ScheduleMatch }) {
  const homeTeam = cleanText(match.home_team)
  const awayTeam = cleanText(match.away_team)
  const league = cleanText(match.league_name)
  const flight = cleanText(match.flight)
  const teams = [homeTeam, awayTeam].filter(Boolean)
  const supportSubject = `Question about ${homeTeam || 'home team'} vs ${awayTeam || 'away team'}`
  const supportBody = [
    `Match: ${homeTeam || 'Home team TBD'} vs ${awayTeam || 'Away team TBD'}`,
    league ? `League: ${league}` : '',
    flight ? `Flight: ${flight}` : '',
    match.match_date ? `Date: ${match.match_date}` : '',
    cleanText(match.facility) ? `Facility: ${cleanText(match.facility)}` : '',
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
          {[league, flight, cleanText(match.facility)].filter(Boolean).join(' | ') || 'League context pending'}
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
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'linear-gradient(180deg, rgba(13,28,54,0.90) 0%, rgba(8,18,36,0.96) 100%)',
} as const

const sectionEyebrowStyle = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'rgba(116,190,255,0.82)',
} as const

const sectionTextStyle = {
  color: 'rgba(214,228,246,0.74)',
  fontSize: '14px',
  lineHeight: 1.72,
} as const

const emptyStyle = {
  padding: '16px',
  borderRadius: '18px',
  border: '1px dashed rgba(116,190,255,0.18)',
  color: 'rgba(214,228,246,0.74)',
  background: 'rgba(255,255,255,0.04)',
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
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
} as const

const matchInfoStyle = {
  minWidth: 0,
} as const

const rowDateStyle = {
  color: '#9be11d',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
} as const

const rowTitleStyle = {
  marginTop: '6px',
  color: '#f4f9ff',
  fontSize: '16px',
  fontWeight: 850,
  lineHeight: 1.35,
} as const

const rowMetaStyle = {
  marginTop: '5px',
  color: 'rgba(214,228,246,0.72)',
  fontSize: '13px',
  lineHeight: 1.55,
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
  color: 'rgba(244,249,255,0.88)',
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
