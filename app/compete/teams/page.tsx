'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import { type UserRole } from '@/lib/roles'
import { listTeamDirectoryOptions, type TeamDirectoryOption } from '@/lib/team-directory'
import {
  listTiqTeamParticipations,
  type TiqTeamParticipationRecord,
} from '@/lib/tiq-league-service'

function GhostSmallLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...buttonStyle,
        transform: hovered ? 'translateY(-2px)' : 'none',
        borderColor: hovered ? 'rgba(155,225,29,0.28)' : buttonStyle.border,
        boxShadow: hovered ? '0 6px 18px rgba(2,8,18,0.28)' : 'none',
        transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
      }}
    >
      {children}
    </Link>
  )
}

export default function CompeteTeamsPage() {
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [participations, setParticipations] = useState<TiqTeamParticipationRecord[]>([])
  const [teamDirectory, setTeamDirectory] = useState<TeamDirectoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [storageWarning, setStorageWarning] = useState('')
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  useEffect(() => {
    let active = true

    async function loadAuth() {
      try {
        const authState = await getClientAuthState()
        if (!active) return
        setRole(authState.role)
        setEntitlements(authState.entitlements)
      } catch {
        if (!active) return
        setRole('public')
        setEntitlements(null)
      }
    }

    void loadAuth()

    return () => {
      active = false
    }
  }, [])

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
    <CompetePageFrame
      eyebrow="My Teams"
      title="Teams should carry their TIQ participation into the weekly workflow."
      description="This view now treats teams as the participant unit across both team operations and TIQ league entry. It bridges roster context, entered TIQ seasons, and the captain actions that come next."
    >
      <CompeteGrid>
        <CompeteCard
          href="/teams"
          meta="Roster view"
          title="Team Directory"
          text="Open current team pages for roster, standings context, and existing team-level analytics."
        />
        <CompeteCard
          href="/captain/availability"
          meta="Action surface"
          title="Availability"
          text="Collect or review availability before you move into lineup construction."
        />
        <CompeteCard
          href="/captain/lineup-builder"
          meta="Action surface"
          title="Lineup Builder"
          text="Move from team context into lineup optimization without needing to rediscover the right captain tool."
        />
      </CompeteGrid>

      <div style={upgradeGridStyle}>
        {!access.canUseCaptainWorkflow ? (
          <UpgradePrompt
            planId="captain"
            compact
            headline="Still moving from team context to lineups by hand?"
            body="Unlock Captain to connect team workflow, availability, lineup building, and messaging without hunting across tools."
            ctaLabel="Unlock Captain Tools"
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
            body="League tools give you one place for season structure, standings, scheduling, and team-level coordination instead of spreadsheet cleanup."
            ctaLabel="Run Your League on TIQ"
            ctaHref="/pricing"
            secondaryLabel="See league plan"
            secondaryHref="/pricing"
          />
        ) : null}
      </div>

      <section style={sectionStyle}>
        <div style={sectionEyebrowStyle}>TIQ Entered Teams</div>
        <div style={sectionTextStyle}>
          {loading
            ? 'Loading TIQ team participation...'
            : groupedTeams.length > 0
              ? 'These teams are already entered in TIQ competition and should act like living workflow objects, not isolated league labels.'
              : 'No TIQ team entries are visible yet. As teams enter TIQ leagues, they will appear here with direct links into team pages and captain actions.'}
        </div>

        {storageWarning ? <div style={warningStyle}>{storageWarning}</div> : null}
        {groupedTeams.length === 0 ? (
          <div style={emptyStyle}>
            Start from a TIQ team league detail page to enter a team, then return here to manage that team in the weekly workflow.
          </div>
        ) : (
          <div style={listStyle}>
            {groupedTeams.map((group) => (
              <div key={`${group.teamName}-${group.sourceLeagueName}-${group.sourceFlight}`} style={rowStyle}>
                <div>
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
                </div>

                <div style={buttonWrapStyle}>
                  <GhostSmallLink href={`/team/${encodeURIComponent(group.teamName)}?layer=tiq${group.sourceLeagueName ? `&league=${encodeURIComponent(group.sourceLeagueName)}` : ''}${group.sourceFlight ? `&flight=${encodeURIComponent(group.sourceFlight)}` : ''}`}>
                    Team Page
                  </GhostSmallLink>
                  <GhostSmallLink href={`/captain/lineup-builder?layer=tiq&team=${encodeURIComponent(group.teamName)}${group.sourceLeagueName ? `&league=${encodeURIComponent(group.sourceLeagueName)}` : ''}${group.sourceFlight ? `&flight=${encodeURIComponent(group.sourceFlight)}` : ''}`}>
                    Lineup Builder
                  </GhostSmallLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </CompetePageFrame>
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
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'linear-gradient(180deg, rgba(13,28,54,0.90) 0%, rgba(8,18,36,0.96) 100%)',
} as const

const upgradeGridStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '16px',
  marginTop: '24px',
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

const listStyle = {
  display: 'grid',
  gap: '12px',
} as const

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
} as const

const rowTitleStyle = {
  color: '#f4f9ff',
  fontSize: '18px',
  fontWeight: 800,
} as const

const rowMetaStyle = {
  marginTop: '4px',
  color: 'rgba(214,228,246,0.72)',
  fontSize: '13px',
  lineHeight: 1.6,
} as const

const rowSubtleStyle = {
  marginTop: '6px',
  color: 'rgba(197,213,234,0.82)',
  fontSize: '12px',
  lineHeight: 1.55,
} as const

const buttonWrapStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
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

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(7,17,33,0.72)',
  color: '#eef5ff',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '13px',
} as const
