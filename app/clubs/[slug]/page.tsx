'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import {
  getClubCompetitionRatingModeLabel,
  getClubCompetitionRatingModeShortDescription,
  normalizeClubCompetitionRatingMode,
} from '@/lib/club-competition'
import { describeClubAccountConnection, type ClubMemberRole } from '@/lib/club-membership'
import {
  getClubExperienceBySlug,
  type ClubExperience,
} from '@/lib/club-service'
import { supabase } from '@/lib/supabase'
import styles from './club-experience.module.css'

type ClubLeague = {
  id: string
  league_name: string | null
  season_label: string | null
  season_status: string | null
  location_label: string | null
  is_public: boolean | null
  result_mode: string | null
}

type ClubTournament = {
  id: string
  name: string | null
  starts_on: string | null
  status: string | null
  location_label: string | null
  is_public: boolean | null
  result_mode: string | null
}

type ProfileLink = {
  linked_player_id: string | null
  linked_player_name: string | null
  message_display_name: string | null
}

type ClubView = 'home' | 'coach' | 'player' | 'league' | 'tournament'

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Date to be announced'
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function roleLabel(role: ClubMemberRole | null) {
  if (!role) return 'Guest view'
  if (role === 'owner') return 'Club owner'
  if (role === 'admin') return 'Club admin'
  if (role === 'director') return 'Program director'
  return `${role.charAt(0).toUpperCase()}${role.slice(1)} account`
}

function canManageClub(role: ClubMemberRole | null) {
  return role === 'owner' || role === 'admin' || role === 'director'
}

function getInitials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] || 'T') + (parts[1]?.[0] || 'I')
}

export default function ClubExperiencePage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const { userId, session, authResolved } = useAuth()
  const slug = cleanText(params?.slug).toLowerCase()
  const [experience, setExperience] = useState<ClubExperience | null>(null)
  const [profile, setProfile] = useState<ProfileLink | null>(null)
  const [leagues, setLeagues] = useState<ClubLeague[]>([])
  const [tournaments, setTournaments] = useState<ClubTournament[]>([])
  const [loading, setLoading] = useState(true)

  const requestedView = searchParams.get('view')
  const view: ClubView = requestedView === 'coach' || requestedView === 'player' || requestedView === 'league' || requestedView === 'tournament'
    ? requestedView
    : 'home'

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const nextExperience = await getClubExperienceBySlug(slug)
      if (!active) return
      setExperience(nextExperience)

      if (nextExperience) {
        const [leagueResult, tournamentResult] = await Promise.all([
          supabase
            .from('tiq_leagues')
            .select('id,league_name,season_label,season_status,location_label,is_public,result_mode')
            .eq('club_id', nextExperience.club.id)
            .order('updated_at', { ascending: false })
            .limit(6),
          supabase
            .from('tiq_tournaments')
            .select('id,name,starts_on,status,location_label,is_public,result_mode')
            .eq('club_id', nextExperience.club.id)
            .order('starts_on', { ascending: true })
            .limit(6),
        ])
        if (!active) return
        setLeagues((leagueResult.data || []) as ClubLeague[])
        setTournaments((tournamentResult.data || []) as ClubTournament[])
      }

      if (userId) {
        const { data } = await supabase
          .from('profiles')
          .select('linked_player_id,linked_player_name,message_display_name')
          .eq('id', userId)
          .maybeSingle()
        if (active) setProfile((data || null) as ProfileLink | null)
      } else if (active) {
        setProfile(null)
      }
      if (active) setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [slug, userId])

  const club = experience?.club || null
  const membership = useMemo(
    () => experience?.memberships.find((item) => item.userId === userId) || null,
    [experience, userId],
  )
  const activeMembership = membership?.status === 'active' ? membership : null
  const memberName = cleanText(profile?.message_display_name) || cleanText(profile?.linked_player_name) || cleanText(session?.user.email?.split('@')[0]) || 'Tennis member'
  const linkedPlayerId = cleanText(profile?.linked_player_id)
  const primaryLocation = experience?.locations.find((item) => item.id === activeMembership?.locationId)
    || experience?.locations.find((item) => item.isPrimary)
    || experience?.locations[0]

  if (!club && !loading) {
    return (
      <main className={styles.page}>
        <div className={styles.frame}>
          <section className={styles.hero}>
            <span className={styles.eyebrow}>Club directory</span>
            <h1>This Club is not available yet.</h1>
            <p>Check the address or return to TenAceIQ Explore.</p>
            <div className={styles.heroActions}><Link className={styles.primaryAction} href="/explore">Open Explore</Link></div>
          </section>
        </div>
      </main>
    )
  }

  if (!club) return null
  const theme = {
    '--club-primary': club.primaryColor,
    '--club-secondary': club.secondaryColor,
  } as CSSProperties

  const viewCopy = getViewCopy(view, activeMembership?.role || null)
  const clubCreateQuery = new URLSearchParams({
    clubId: club.id,
    clubLocationId: primaryLocation?.id || '',
    clubName: club.name,
  }).toString()
  const actions = getViewActions(view, linkedPlayerId, canManageClub(activeMembership?.role || null), clubCreateQuery)

  return (
    <main className={styles.page} style={theme}>
      <div className={styles.frame}>
        <header className={styles.clubBar}>
          <div className={styles.brandGroup}>
            {club.logoUrl ? (
              <>
                {/* Club logos are intentionally sourced from each Club record. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.clubLogo} src={club.logoUrl} alt={club.name} />
              </>
            ) : (
              <span className={styles.clubLogoFallback}>{club.name}</span>
            )}
            <span className={styles.powered}>Member experience powered by</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.tiqLogo} src="/brand/web/header-logo-transparent.png" alt="TenAceIQ" />
          </div>
          <div className={styles.clubTitle}>
            <strong>{club.name}</strong>
            <span>{primaryLocation ? `${primaryLocation.name}${primaryLocation.city ? ` · ${primaryLocation.city}` : ''}` : 'Connected Club experience'}</span>
          </div>
        </header>

        <section className={styles.identityBar} aria-label="Club membership connection">
          <div className={styles.identityMain}>
            <span className={styles.avatar}>{getInitials(memberName).toUpperCase()}</span>
            <div className={styles.identityCopy}>
              <strong>{authResolved && userId ? memberName : 'Your tennis identity travels with you'}</strong>
              <span>
                {activeMembership
                  ? `${roleLabel(activeMembership.role)} · ${linkedPlayerId ? 'Player ID connected' : 'Connect a Player ID to publish personal results'}`
                  : describeClubAccountConnection(Boolean(userId))}
              </span>
            </div>
          </div>
          <div className={styles.identityActions}>
            {!userId ? <Link className={styles.primaryAction} href={`/login?next=${encodeURIComponent(`/clubs/${slug}`)}`}>Sign in to connect</Link> : null}
            {userId && !linkedPlayerId ? <Link className={styles.secondaryAction} href="/profile">Select Player ID</Link> : null}
            {linkedPlayerId ? <Link className={styles.quietAction} href={`/players/${linkedPlayerId}`}>View national history</Link> : null}
          </div>
        </section>

        <nav className={styles.roleNav} aria-label={`${club.name} experience`}>
          {([
            ['home', 'Club Home'],
            ['coach', 'Coach'],
            ['player', 'Player'],
            ['league', 'Leagues'],
            ['tournament', 'Tournaments'],
          ] as Array<[ClubView, string]>).map(([key, label]) => (
            <Link key={key} href={`/clubs/${slug}?view=${key}`} className={`${styles.roleTab} ${view === key ? styles.roleTabActive : ''}`}>
              {label}
            </Link>
          ))}
        </nav>

        <section className={styles.hero}>
          <span className={styles.eyebrow}>{viewCopy.eyebrow}</span>
          <h1>{viewCopy.title}</h1>
          <p>{viewCopy.copy}</p>
          <div className={styles.heroActions}>
            {actions.slice(0, 2).map((action, index) => (
              <Link key={action.href} className={index === 0 ? styles.primaryAction : styles.secondaryAction} href={action.href}>{action.label}</Link>
            ))}
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><span className={styles.eyebrow}>Act next</span><h2>{viewCopy.actionTitle}</h2></div>
              <span className={styles.pill}>{activeMembership ? roleLabel(activeMembership.role) : 'Public preview'}</span>
            </div>
            <div className={styles.actionList}>
              {actions.map((action) => (
                <article className={styles.actionCard} key={`${action.href}-${action.label}`}>
                  <div><strong>{action.label}</strong><p>{action.description}</p></div>
                  <Link className={styles.quietAction} href={action.href}>{action.cta}</Link>
                </article>
              ))}
            </div>
          </div>

          <aside className={styles.panel}>
            <span className={styles.eyebrow}>Connected Club</span>
            <h3>One identity. Every tennis role.</h3>
            <div className={styles.metricGrid}>
              <div className={styles.metric}><strong>{experience?.memberships.filter((item) => item.status === 'active').length || '—'}</strong><span>Active linked members</span></div>
              <div className={styles.metric}><strong>{experience?.locations.length || '—'}</strong><span>Club locations</span></div>
              <div className={styles.metric}><strong>{leagues.length}</strong><span>Connected leagues</span></div>
              <div className={styles.metric}><strong>{tournaments.length}</strong><span>Connected tournaments</span></div>
            </div>
          </aside>
        </section>

        <section className={`${styles.panel} ${styles.connectionPanel}`}>
          <div className={styles.panelHeader}>
            <div><span className={styles.eyebrow}>How data moves</span><h2>The Club adds context—not a second account.</h2></div>
          </div>
          <div className={styles.connectionSteps}>
            <div className={styles.connectionStep}><b>01</b><strong>TenAceIQ account</strong><span>Sign in once. Your follows, tools, messages, and access stay with you.</span></div>
            <div className={styles.connectionStep}><b>02</b><strong>Player ID</strong><span>Your canonical player record keeps national match history and ratings together.</span></div>
            <div className={styles.connectionStep}><b>03</b><strong>{club.name} affiliation</strong><span>The Club connects locations, coaches, programs, teams, leagues, and events.</span></div>
            <div className={styles.connectionStep}><b>04</b><strong>Results policy</strong><span>TIQ Rated, Club standings, or event-only is chosen before competition begins.</span></div>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>League office</span><h2>Club seasons</h2></div><Link className={styles.quietAction} href={`/league-coordinator?${clubCreateQuery}`}>Open League Office</Link></div>
            <CompetitionList type="league" records={leagues} />
          </div>
          <div className={styles.panel}>
            <div className={styles.panelHeader}><div><span className={styles.eyebrow}>Tournament desk</span><h2>One-off events</h2></div><Link className={styles.quietAction} href={`/league-coordinator/tournaments?${clubCreateQuery}`}>Open Tournament Desk</Link></div>
            <CompetitionList type="tournament" records={tournaments} />
          </div>
        </section>
      </div>
    </main>
  )
}

function CompetitionList(props: { type: 'league'; records: ClubLeague[] } | { type: 'tournament'; records: ClubTournament[] }) {
  const { type } = props
  const records: Array<ClubLeague | ClubTournament> = props.records
  if (!records.length) return <p className={styles.emptyCopy}>No live Club-owned {type === 'league' ? 'leagues' : 'tournaments'} are published yet. New events will appear here automatically.</p>

  return (
    <div className={styles.competitionList}>
      {records.map((record) => {
        const mode = normalizeClubCompetitionRatingMode(record.result_mode === 'public_history' ? 'club_standings' : record.result_mode)
        const href = type === 'league' ? `/explore/leagues/tiq/${record.id}` : `/tournaments/${record.id}`
        const title = 'league_name' in record ? cleanText(record.league_name) : cleanText(record.name)
        const meta = 'season_label' in record
          ? `${cleanText(record.season_label) || 'Season'} · ${cleanText(record.location_label) || 'Club courts'}`
          : `${formatDate(record.starts_on)} · ${cleanText(record.location_label) || 'Club courts'}`
        return (
          <article className={styles.competitionCard} key={record.id}>
            <div className={styles.competitionTop}><span className={styles.pill}>{getClubCompetitionRatingModeLabel(mode)}</span></div>
            <strong>{title || (type === 'league' ? 'Club league' : 'Club tournament')}</strong>
            <p>{meta}<br />{getClubCompetitionRatingModeShortDescription(mode)}</p>
            <div className={styles.panelActions}><Link className={styles.quietAction} href={href}>Open {type}</Link></div>
          </article>
        )
      })}
    </div>
  )
}

function getViewCopy(view: ClubView, role: ClubMemberRole | null) {
  if (view === 'coach') return {
    eyebrow: 'Coach Hub', title: 'Know what every player needs next.', copy: 'Connected Club players, assignments, proof, tactics, and lesson preparation stay tied to the same Player ID.', actionTitle: 'Coach the next useful action',
  }
  if (view === 'player') return {
    eyebrow: 'Player experience', title: 'Your Club tennis belongs in My Lab.', copy: 'Coach work, follows, goals, match preparation, leagues, tournaments, and national history meet in one player-linked experience.', actionTitle: 'Move your game forward',
  }
  if (view === 'league') return {
    eyebrow: 'League Office', title: 'Run the season without losing the players.', copy: 'Registration, scheduling, results, standings, and result policy connect directly to verified player and team identities.', actionTitle: 'Keep the season moving',
  }
  if (view === 'tournament') return {
    eyebrow: 'Tournament Desk', title: 'Run event day—and publish the right history.', copy: 'Entries, Player ID checks, draws, courts, scores, alerts, and rating treatment stay in one organizer workflow.', actionTitle: 'Prepare the event room',
  }
  return {
    eyebrow: role ? `${roleLabel(role)} home` : 'Connected Club experience', title: 'Your tennis week—connected from Club to court.', copy: 'See the next program, coach action, league match, tournament, and personal development step without chasing separate systems.', actionTitle: 'Start with what matters now',
  }
}

function getViewActions(view: ClubView, linkedPlayerId: string, manager: boolean, clubCreateQuery: string) {
  if (view === 'coach') return [
    { label: 'Open connected players', description: 'Review each linked player, assignment status, and the next coaching decision.', href: '/coach', cta: 'Open Coach Hub' },
    { label: 'Build the court plan', description: 'Move from a player need into a reusable practice or match pattern.', href: '/tactics', cta: 'Open tactics' },
    { label: 'Prepare the next lesson', description: 'Use real player context instead of rebuilding the lesson from memory.', href: '/player-development/coach-planner', cta: 'Open planner' },
  ]
  if (view === 'player') return [
    { label: 'Open My Lab', description: 'Keep goals, follows, match context, and your next action together.', href: '/mylab', cta: 'Open My Lab' },
    { label: 'Continue My Quest', description: 'Turn a tennis goal into a visible streak and practical weekly work.', href: '/level-up/my-quest', cta: 'Continue quest' },
    { label: 'Review national history', description: 'See every eligible Club and national result attached to your Player ID.', href: linkedPlayerId ? `/players/${linkedPlayerId}` : '/profile', cta: linkedPlayerId ? 'View history' : 'Select Player ID' },
  ]
  if (view === 'league') return [
    { label: 'Review live Club leagues', description: 'Open schedules, participants, standings, and result review.', href: `/league-coordinator?${clubCreateQuery}`, cta: 'Open office' },
    { label: 'Record verified results', description: 'Publish results under the league’s selected TIQ rating policy.', href: '/league-coordinator/results', cta: 'Review results' },
    { label: 'Create a Club season', description: manager ? 'Build a Club-owned league with visibility and result policy set up front.' : 'Club managers can build and publish new seasons.', href: `/league-coordinator?${clubCreateQuery}`, cta: manager ? 'Create league' : 'View leagues' },
  ]
  if (view === 'tournament') return [
    { label: 'Open Tournament Desk', description: 'Manage entrants, draws, courts, results, alerts, and event-day status.', href: `/league-coordinator/tournaments?${clubCreateQuery}`, cta: 'Open desk' },
    { label: 'Verify Player IDs', description: 'Rated and public-history results require canonical Player IDs before publishing.', href: `/league-coordinator/tournaments?${clubCreateQuery}`, cta: 'Review entrants' },
    { label: 'Choose how results count', description: 'Use TIQ Rated, Club standings only, or Social / event only.', href: `/league-coordinator/tournaments?${clubCreateQuery}`, cta: 'Set event policy' },
  ]
  return [
    { label: 'My next player action', description: 'Open the goals, follows, assignments, and preparation tied to your Player ID.', href: '/mylab', cta: 'Open My Lab' },
    { label: 'Coach follow-through', description: 'Move from a lesson into one clear assignment and proof loop.', href: '/coach', cta: 'Open Coach Hub' },
    { label: 'Compete at the Club', description: 'Find connected leagues, tournament entries, schedules, and results.', href: '/compete', cta: 'Open Compete' },
  ]
}
