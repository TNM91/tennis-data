'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import { buildProductAccessState } from '@/lib/access-model'
import { useAuth } from '@/app/components/auth-provider'
import { listTeamDirectoryOptions, type TeamDirectoryOption } from '@/lib/team-directory'
import {
  listTiqTeamParticipations,
  type TiqTeamParticipationRecord,
} from '@/lib/tiq-league-service'

const dataAssistTeamsHref = '/data-assist?intent=upload-source&context=League%20Office%20teams'

const emptyTeamActions = [
  { href: '/league-coordinator', label: 'Create team league' },
  { href: dataAssistTeamsHref, label: 'Refresh team data' },
  { href: '/teams', label: 'Browse teams' },
] as const

export default function CompeteTeamsPage() {
  return (
    <CompetePageFrame
      eyebrow="My Teams"
      title="Team context, already in motion."
      description="Entered TIQ seasons, roster links, and captain actions sit together."
    >
      <CompeteTeamsContent />
    </CompetePageFrame>
  )
}

function CompeteTeamsContent() {
  const { role, userId, entitlements, authResolved } = useAuth()
  const [participations, setParticipations] = useState<TiqTeamParticipationRecord[]>([])
  const [teamDirectory, setTeamDirectory] = useState<TeamDirectoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [storageWarning, setStorageWarning] = useState('')
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const [participationResult, teamOptions] = await Promise.all([
        listTiqTeamParticipations(),
        listTeamDirectoryOptions().catch(() => []),
      ])

      if (!active) return

      setParticipations(participationResult.entries)
      setTeamDirectory(teamOptions)
      setStorageWarning(participationResult.warning || '')
      setLoading(false)
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const groupedTeams = useMemo(() => {
    const directoryByTeam = new Map(teamDirectory.map((option) => [option.team, option]))
    const grouped = new Map<
      string,
      {
        teamName: string
        sourceLeagueName: string
        sourceFlight: string
        tiqLeagues: TiqTeamParticipationRecord[]
        directoryOption: TeamDirectoryOption | null
      }
    >()

    for (const entry of participations) {
      const key = entry.teamEntityId || `${entry.teamName}__${entry.sourceLeagueName}__${entry.sourceFlight}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          teamName: entry.teamName,
          sourceLeagueName: entry.sourceLeagueName,
          sourceFlight: entry.sourceFlight,
          tiqLeagues: [],
          directoryOption: directoryByTeam.get(entry.teamName) || null,
        })
      }

      grouped.get(key)?.tiqLeagues.push(entry)
    }

    return Array.from(grouped.values()).sort((left, right) => {
      if (right.tiqLeagues.length !== left.tiqLeagues.length) {
        return right.tiqLeagues.length - left.tiqLeagues.length
      }
      return left.teamName.localeCompare(right.teamName)
    })
  }, [participations, teamDirectory])

  return (
    <>
      <CompeteGrid>
        <CompeteCard
          href="/teams"
          meta="Public map"
          title="Team directory"
          text="Open roster, standings, and team analytics."
          icon="teamRankings"
          action="Find team"
        />
        <CompeteCard
          href="/league-coordinator/results"
          meta="Scorebook"
          title="Team book"
          text="Record team match events, line scores, and standings-moving outcomes."
          icon="reports"
          action="Open book"
        />
        <CompeteCard
          href="/captain/lineup-builder"
          meta="Team handoff"
          title="Build lineup"
          text="Build from the team already in view."
          icon="lineupBuilder"
          action="Build lineup"
        />
        <CompeteCard
          href="/compete/schedule"
          meta="Shared calendar"
          title="Match dates"
          text="Keep team matches connected to the league calendar."
          icon="schedule"
          action="Open calendar"
        />
      </CompeteGrid>

      {authResolved ? (
        <div style={upgradeGridStyle}>
          {!access.canUseCaptainWorkflow ? (
            <UpgradePrompt
              planId="captain"
              compact
              headline="Still moving from team context to lineups by hand?"
              body="Unlock Captain to connect team workflow, availability, lineup building, and messaging in one workspace."
              ctaLabel="Unlock Captain"
              ctaHref="/pricing"
              secondaryLabel="See Captain plan"
              secondaryHref="/pricing"
            />
          ) : null}
          {!access.canUseLeagueTools ? (
            <UpgradePrompt
              planId="league"
              compact
              headline="Running TIQ team seasons without a real organizer layer?"
              body="League gives you one place for season structure, standings, scheduling, and team-level coordination instead of spreadsheet cleanup."
              ctaLabel="Unlock League"
              ctaHref="/pricing"
              secondaryLabel="See league plan"
              secondaryHref="/pricing"
            />
          ) : null}
        </div>
      ) : null}

      <section style={sectionStyle}>
        <div style={sectionEyebrowStyle}>TIQ Entered Teams</div>
        <div style={sectionTextStyle}>
          {loading
            ? 'Loading TIQ team participation...'
            : groupedTeams.length > 0
              ? 'These teams are already entered in TIQ competition and should act like living workflow objects, not isolated league labels.'
              : 'Start with a team league, roster refresh, or public team lookup.'}
        </div>

        {storageWarning ? <div style={warningStyle}>{storageWarning}</div> : null}
        {groupedTeams.length === 0 ? (
          <EmptyTeamsState />
        ) : (
          <div style={listStyle}>
            {groupedTeams.map((group) => {
              const teamPageHref = `/team/${encodeURIComponent(group.teamName)}?layer=tiq${group.sourceLeagueName ? `&league=${encodeURIComponent(group.sourceLeagueName)}` : ''}${group.sourceFlight ? `&flight=${encodeURIComponent(group.sourceFlight)}` : ''}`
              const lineupHref = `/captain/lineup-builder?layer=tiq&team=${encodeURIComponent(group.teamName)}${group.sourceLeagueName ? `&league=${encodeURIComponent(group.sourceLeagueName)}` : ''}${group.sourceFlight ? `&flight=${encodeURIComponent(group.sourceFlight)}` : ''}`
              const teamReadinessItems = [
                {
                  label: 'Leagues',
                  value: group.tiqLeagues.length > 0 ? `${group.tiqLeagues.length}` : 'Waiting',
                  ready: group.tiqLeagues.length > 0,
                },
                {
                  label: 'History',
                  value: group.directoryOption ? `${group.directoryOption.matchCount} matches` : 'No matches',
                  ready: Boolean(group.directoryOption),
                },
                {
                  label: 'Captain',
                  value: access.canUseCaptainWorkflow ? 'Ready' : 'Locked',
                  ready: access.canUseCaptainWorkflow,
                },
              ]
              const primaryHref = access.canUseCaptainWorkflow ? lineupHref : teamPageHref
              const primaryLabel = access.canUseCaptainWorkflow ? 'Build lineup' : 'Open team'

              return (
                <div key={`${group.teamName}-${group.sourceLeagueName}-${group.sourceFlight}`} style={rowStyle}>
                  <div style={teamCopyStyle}>
                    <div style={rowTitleStyle}>{group.teamName}</div>
                    <div style={rowMetaStyle}>
                      {[group.sourceLeagueName, group.sourceFlight, `${group.tiqLeagues.length} TIQ leagues`]
                        .filter(Boolean)
                        .join(' | ')}
                    </div>
                    <div style={rowSubtleStyle}>
                      {group.tiqLeagues
                        .map((entry) => [entry.leagueName, entry.seasonLabel].filter(Boolean).join(' - '))
                        .join(' | ')}
                    </div>
                    <div style={teamReadinessGridStyle}>
                      {teamReadinessItems.map((item) => (
                        <div key={item.label} style={teamReadinessItemStyle}>
                          <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                      <Link href={primaryHref} style={teamPrimaryActionStyle}>
                        {primaryLabel}
                      </Link>
                    </div>
                  </div>
                  {access.canUseCaptainWorkflow ? (
                    <Link href={teamPageHref} style={teamSecondaryLinkStyle}>
                      Team page
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

function EmptyTeamsState() {
  return (
    <div style={emptyTeamsStyle}>
      <div style={emptyTeamsCopyStyle}>
        <strong>Team workflow starts with one real team signal.</strong>
        <span>Create a TIQ team league, upload a roster or scorecard through Data Assist, or find the team already in the public map.</span>
      </div>
      <div style={emptyTeamsActionRowStyle}>
        {emptyTeamActions.map((action) => (
          <Link key={action.href} href={action.href} style={emptyTeamsActionStyle}>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

const sectionStyle = {
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

const upgradeGridStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: '16px',
  marginTop: '24px',
} as const

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

const emptyTeamsStyle = {
  display: 'grid',
  gap: '14px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px dashed rgba(116,190,255,0.18)',
  color: 'var(--shell-copy-muted)',
  background: 'rgba(8,16,34,0.66)',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const emptyTeamsCopyStyle = {
  display: 'grid',
  gap: '6px',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const emptyTeamsActionRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  minWidth: 0,
} as const

const emptyTeamsActionStyle = {
  minWidth: 0,
  maxWidth: '100%',
  padding: '10px 13px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 900,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
} as const

const listStyle = {
  display: 'grid',
  gap: '12px',
} as const

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: '12px',
  alignItems: 'center',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.66)',
  minWidth: 0,
} as const

const teamCopyStyle = {
  minWidth: 0,
} as const

const rowTitleStyle = {
  color: 'var(--foreground-strong)',
  fontSize: '18px',
  fontWeight: 800,
  overflowWrap: 'anywhere',
} as const

const rowMetaStyle = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
} as const

const rowSubtleStyle = {
  marginTop: '6px',
  color: 'var(--foreground)',
  fontSize: '12px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
} as const

const teamReadinessGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))',
  gap: '8px',
  marginTop: '12px',
  minWidth: 0,
} as const

const teamReadinessItemStyle = {
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

const teamPrimaryActionStyle = {
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

const teamSecondaryLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: '34px',
  padding: '7px 12px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(7,17,33,0.72)',
  color: '#eef5ff',
  fontSize: '12px',
  fontWeight: 850,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
} as const

const readinessDotReadyStyle = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
  flex: '0 0 auto',
} as const

const readinessDotWaitingStyle = {
  ...readinessDotReadyStyle,
  background: 'rgba(116,190,255,0.46)',
  boxShadow: '0 0 0 4px rgba(116,190,255,0.08)',
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
