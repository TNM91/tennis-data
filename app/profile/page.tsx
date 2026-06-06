'use client'

import Link from 'next/link'
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'
import { cleanText, formatRating } from '@/lib/captain-formatters'
import { buildScopedTeamEntityId } from '@/lib/entity-ids'
import { getTiqRating, getUstaRating } from '@/lib/player-rating-display'
import { writeLocalProfileLink } from '@/lib/profile-link-storage'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import { supabase } from '@/lib/supabase'
import { loadUserProfileLink, saveUserProfileLink, type LoadUserProfileLinkResult, type UserProfileLink } from '@/lib/user-profile'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { loadTiqAwardsForPlayer, type TiqAwardRecord } from '@/lib/tiq-awards-registry'

type PreferredRole = 'singles' | 'doubles' | 'both'
type AvailabilityDefault = 'ask-weekly' | 'usually-available' | 'limited'

type PlayerRow = {
  id: string
  name: string
  location?: string | null
  flight?: string | null
  overall_rating?: number | null
  singles_rating?: number | null
  doubles_rating?: number | null
  overall_dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
  overall_usta_dynamic_rating?: number | null
  singles_usta_dynamic_rating?: number | null
  doubles_usta_dynamic_rating?: number | null
  rating_source?: string | null
}

type ProfileLinkApiResponse = {
  ok?: boolean
  message?: string
  player?: PlayerRow | null
  profile?: UserProfileLink | null
}

type MatchRow = {
  id: string
  flight: string | null
  league_name: string | null
  home_team: string | null
  away_team: string | null
}

type MatchPlayerRow = {
  match_id: string
  player_id: string
  side: string | null
}

type TeamSummary = {
  id: string
  name: string
  league: string
  flight: string
}

type ProfilePrefs = {
  preferredRole: PreferredRole
  availabilityDefault: AvailabilityDefault
}

const LOCAL_PROFILE_PREFS_KEY = 'tenaceiq-profile-prefs-v1'

const DEFAULT_PREFS: ProfilePrefs = {
  preferredRole: 'both',
  availabilityDefault: 'ask-weekly',
}

const PROFILE_PLAYER_SELECT_BASE = `
  id,
  name,
  location,
  flight,
  overall_rating,
  singles_rating,
  doubles_rating,
  overall_dynamic_rating,
  singles_dynamic_rating,
  doubles_dynamic_rating,
  overall_usta_dynamic_rating,
  singles_usta_dynamic_rating,
  doubles_usta_dynamic_rating
`

const PROFILE_PLAYER_SELECT_WITH_SOURCE = `
  ${PROFILE_PLAYER_SELECT_BASE},
  rating_source
`

function readProfilePrefs(): ProfilePrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_PROFILE_PREFS_KEY) || 'null') as Partial<ProfilePrefs> | null
    return {
      preferredRole:
        parsed?.preferredRole === 'singles' || parsed?.preferredRole === 'doubles' || parsed?.preferredRole === 'both'
          ? parsed.preferredRole
          : DEFAULT_PREFS.preferredRole,
      availabilityDefault:
        parsed?.availabilityDefault === 'usually-available' ||
        parsed?.availabilityDefault === 'limited' ||
        parsed?.availabilityDefault === 'ask-weekly'
          ? parsed.availabilityDefault
          : DEFAULT_PREFS.availabilityDefault,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function writeProfilePrefs(prefs: ProfilePrefs) {
  window.localStorage.setItem(LOCAL_PROFILE_PREFS_KEY, JSON.stringify(prefs))
}

function normalizeSelfRating(value: string) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 3.5
  return Math.min(7, Math.max(1, Math.round(parsed * 10) / 10))
}

function isMissingRatingSourceError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('rating_source') || normalized.includes('schema cache') || normalized.includes('column')
}

async function loadProfilePlayers(): Promise<PlayerRow[]> {
  const withSource = await supabase
    .from('players')
    .select(PROFILE_PLAYER_SELECT_WITH_SOURCE)
    .order('name', { ascending: true })

  if (!withSource.error) return (withSource.data || []) as PlayerRow[]
  if (!isMissingRatingSourceError(withSource.error.message)) throw new Error(withSource.error.message)

  const base = await supabase
    .from('players')
    .select(PROFILE_PLAYER_SELECT_BASE)
    .order('name', { ascending: true })

  if (base.error) throw new Error(base.error.message)
  return ((base.data || []) as PlayerRow[]).map((player) => ({ ...player, rating_source: null }))
}

async function createSelfRatedPlayer(name: string, rating: number): Promise<PlayerRow | null> {
  const basePayload = {
    name,
    singles_rating: rating,
    singles_dynamic_rating: rating,
    doubles_rating: rating,
    doubles_dynamic_rating: rating,
    overall_rating: rating,
    overall_dynamic_rating: rating,
  }
  const selfRatedPayload = {
    ...basePayload,
    rating_source: 'self',
  }

  const insertWithSource = await supabase
    .from('players')
    .insert(selfRatedPayload)
    .select('id,name,location,flight,overall_rating,singles_rating,doubles_rating,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating,overall_usta_dynamic_rating,singles_usta_dynamic_rating,doubles_usta_dynamic_rating,rating_source')
    .maybeSingle()

  if (!insertWithSource.error) return insertWithSource.data as PlayerRow

  const message = insertWithSource.error.message.toLowerCase()
  const canFallback = isMissingRatingSourceError(message)
  if (!canFallback) {
    const duplicate = message.includes('duplicate') || insertWithSource.error.code === '23505'
    if (!duplicate) throw new Error(insertWithSource.error.message)
  }

  const insertFallback = await supabase
    .from('players')
    .insert(basePayload)
    .select('id,name,location,flight,overall_rating,singles_rating,doubles_rating,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating,overall_usta_dynamic_rating,singles_usta_dynamic_rating,doubles_usta_dynamic_rating')
    .maybeSingle()

  if (!insertFallback.error) return { ...(insertFallback.data as PlayerRow), rating_source: 'self' }

  const duplicate = insertFallback.error.code === '23505' || insertFallback.error.message.toLowerCase().includes('duplicate')
  if (!duplicate) throw new Error(insertFallback.error.message)

  const existing = await supabase
    .from('players')
    .select('id,name,location,flight,overall_rating,singles_rating,doubles_rating,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating,overall_usta_dynamic_rating,singles_usta_dynamic_rating,doubles_usta_dynamic_rating')
    .ilike('name', name)
    .limit(1)
    .maybeSingle()

  if (existing.error) throw new Error(existing.error.message)
  return existing.data ? { ...(existing.data as PlayerRow), rating_source: 'self' } : null
}

async function saveProfileIdentityViaApi(input: {
  linkedPlayerId?: string
  playerName?: string
  selfRating?: number
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) return null

  const response = await fetch('/api/profile/link', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const body = (await response.json().catch(() => null)) as ProfileLinkApiResponse | null

  if (!response.ok || !body?.ok || !body.player || !body.profile) {
    throw new Error(body?.message ?? 'Unable to save your player profile.')
  }

  return {
    player: body.player,
    profile: body.profile,
  }
}

export default function ProfilePage() {
  return (
    <SiteShell active="/profile">
      <ProfilePageInner />
    </SiteShell>
  )
}

function ProfilePageInner() {
  const { role, entitlements, session, userId, authResolved } = useAuth()
  const { isTablet, isMobile } = useViewportBreakpoints()
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayerRow[]>([])
  const [profile, setProfile] = useState<UserProfileLink | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [typedPlayerName, setTypedPlayerName] = useState('')
  const [selfRating, setSelfRating] = useState('3.5')
  const [prefs, setPrefs] = useState<ProfilePrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [billingPortalOpening, setBillingPortalOpening] = useState(false)
  const [billingMessage, setBillingMessage] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [profileAwards, setProfileAwards] = useState<TiqAwardRecord[]>([])
  const [profileSource, setProfileSource] = useState<LoadUserProfileLinkResult['source']>('none')

  useEffect(() => {
    setPrefs(readProfilePrefs())
    if (new URLSearchParams(window.location.search).get('billing') === 'returned') {
      setBillingMessage('Billing management closed. Your access will reflect the latest Stripe updates.')
    }
  }, [])

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [playersRes, matchesRes, matchPlayersRes, profileRes] = await Promise.all([
        loadProfilePlayers(),
        supabase
          .from('matches')
          .select('id, flight, league_name, home_team, away_team')
          .limit(5000),
        supabase
          .from('match_players')
          .select('match_id, player_id, side')
          .limit(12000),
        loadUserProfileLink(userId),
      ])

      if (matchesRes.error) throw new Error(matchesRes.error.message)
      if (matchPlayersRes.error) throw new Error(matchPlayersRes.error.message)
      if (profileRes.error && !profileRes.data) {
        throw new Error(profileRes.error.message)
      }

      const nextProfile = profileRes.data
      setPlayers(playersRes)
      setMatches((matchesRes.data || []) as MatchRow[])
      setMatchPlayers((matchPlayersRes.data || []) as MatchPlayerRow[])
      setProfile(nextProfile)
      setProfileSource(profileRes.source)
      setSelectedPlayerId(nextProfile?.linked_player_id || '')
      setTypedPlayerName(nextProfile?.linked_player_id ? '' : nextProfile?.linked_player_name || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your profile.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!authResolved) return
    if (!userId) {
      setProfile(null)
      setProfileSource('none')
      setSelectedPlayerId('')
      setLoading(false)
      setError('')
      return
    }
    void loadProfile()
  }, [authResolved, loadProfile, userId])

  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player])), [players])
  const selectedPlayer = selectedPlayerId ? playerMap.get(selectedPlayerId) || null : null
  const linkedPlayer = profile?.linked_player_id ? playerMap.get(profile.linked_player_id) || null : null
  const typedPlayerNameClean = cleanText(typedPlayerName)
  const typedProfileActive = Boolean(!selectedPlayerId && typedPlayerNameClean)
  const matchingPlayers = useMemo(() => {
    const query = typedPlayerNameClean.toLowerCase()
    const selected = selectedPlayerId ? playerMap.get(selectedPlayerId) || null : null
    const matches = query.length >= 2
      ? players
          .filter((player) => {
            const name = cleanText(player.name).toLowerCase()
            const location = cleanText(player.location).toLowerCase()
            return name.includes(query) || location.includes(query)
          })
          .sort((a, b) => {
            const aName = cleanText(a.name).toLowerCase()
            const bName = cleanText(b.name).toLowerCase()
            const aStarts = aName.startsWith(query) ? 0 : 1
            const bStarts = bName.startsWith(query) ? 0 : 1
            return aStarts - bStarts || a.name.localeCompare(b.name)
          })
      : []

    const merged = selected && !matches.some((player) => player.id === selected.id)
      ? [selected, ...matches]
      : matches

    return merged.slice(0, 8)
  }, [playerMap, players, selectedPlayerId, typedPlayerNameClean])

  useEffect(() => {
    let active = true

    async function loadProfileAwards() {
      const linkedPlayerId = profile?.linked_player_id || ''
      const linkedPlayerName = profile?.linked_player_name || linkedPlayer?.name || ''

      if (!linkedPlayerId && !linkedPlayerName) {
        setProfileAwards([])
        return
      }

      const result = await loadTiqAwardsForPlayer(linkedPlayerId, linkedPlayerName)
      if (!active) return
      setProfileAwards(result.data)
    }

    void loadProfileAwards()

    return () => {
      active = false
    }
  }, [linkedPlayer?.name, profile?.linked_player_id, profile?.linked_player_name])

  const matchPlayersByMatch = useMemo(() => {
    const map = new Map<string, MatchPlayerRow[]>()
    for (const row of matchPlayers) {
      const existing = map.get(row.match_id) ?? []
      existing.push(row)
      map.set(row.match_id, existing)
    }
    return map
  }, [matchPlayers])

  const selectedPlayerTeams = useMemo<TeamSummary[]>(() => {
    if (!selectedPlayerId) return []
    const map = new Map<string, TeamSummary>()

    for (const match of matches) {
      const participants = matchPlayersByMatch.get(match.id) ?? []
      const playerSide = participants.find((participant) => participant.player_id === selectedPlayerId)?.side
      if (!playerSide) continue

      const teamName = cleanText(playerSide === 'A' ? match.home_team : match.away_team)
      const league = cleanText(match.league_name)
      const flight = cleanText(match.flight)
      if (!teamName) continue

      const id = buildScopedTeamEntityId({
        competitionLayer: '',
        teamName,
        leagueName: league,
        flight,
      })

      if (!map.has(id)) {
        map.set(id, { id, name: teamName, league, flight })
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [matches, matchPlayersByMatch, selectedPlayerId])

  async function saveProfile() {
    if (!userId) {
      setError('Sign in to manage your profile.')
      return
    }

    if (!selectedPlayer && !typedPlayerNameClean) {
      setError('Choose an existing player or type your name to create a self-rated player.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    try {
      const selfRatingNumber = normalizeSelfRating(selfRating)
      let nextPlayer = selectedPlayer
      let nextProfile: UserProfileLink | null = null
      let saveSource: 'cloud' | 'local' = 'local'
      let apiSaveError: Error | null = null

      let apiResult: Awaited<ReturnType<typeof saveProfileIdentityViaApi>> = null
      try {
        apiResult = await saveProfileIdentityViaApi(
          nextPlayer
            ? { linkedPlayerId: nextPlayer.id }
            : { playerName: typedPlayerNameClean, selfRating: selfRatingNumber },
        )
      } catch (err) {
        apiSaveError = err instanceof Error ? err : new Error('Cloud profile sync failed.')
      }

      if (apiResult) {
        nextPlayer = apiResult.player
        nextProfile = apiResult.profile
        saveSource = 'cloud'
        setProfileSource('cloud')
      }

      if (!nextPlayer && typedPlayerNameClean) {
        const created = await createSelfRatedPlayer(typedPlayerNameClean, selfRatingNumber)
        nextPlayer = created
      }

      if (nextPlayer) {
        setPlayers((current) => current.some((player) => player.id === nextPlayer.id) ? current : [...current, nextPlayer].sort((a, b) => a.name.localeCompare(b.name)))
        setSelectedPlayerId(nextPlayer.id)
      }

      const payload: UserProfileLink & { linked_team_at: string } = {
        linked_player_id: nextPlayer?.id || null,
        linked_player_name: nextPlayer?.name || typedPlayerNameClean || null,
        linked_team_name: null,
        linked_league_name: null,
        linked_flight: null,
        linked_team_at: new Date().toISOString(),
      }

      let saveError: Error | null = apiSaveError
      if (!apiResult) {
        const saveRes = await saveUserProfileLink(userId, payload)
        saveSource = saveRes.source
        saveError = saveRes.error
        setProfileSource(saveRes.source)
        if (saveRes.error && saveRes.source !== 'local') throw saveRes.error
      } else {
        writeLocalProfileLink(userId, payload)
      }

      writeProfilePrefs(prefs)
      setProfile({
        linked_player_id: nextProfile?.linked_player_id ?? payload.linked_player_id,
        linked_player_name: nextProfile?.linked_player_name ?? payload.linked_player_name,
        linked_team_name: nextProfile?.linked_team_name ?? payload.linked_team_name,
        linked_league_name: nextProfile?.linked_league_name ?? payload.linked_league_name,
        linked_flight: nextProfile?.linked_flight ?? payload.linked_flight,
        profile_photo_url: nextProfile?.profile_photo_url ?? profile?.profile_photo_url ?? null,
        message_display_name: nextProfile?.message_display_name ?? profile?.message_display_name ?? payload.linked_player_name ?? null,
      })
      setMessage(
        saveSource === 'local'
          ? 'Profile saved on this device. Cloud sync will catch up when profile storage is available.'
          : 'Profile saved. My Lab, Matchup, Team, and League can use this context.',
      )
      if (saveError) {
        setError(saveError.message)
      }
      if (nextPlayer?.id) {
        void trackProductUsageEvent({
          eventName: 'profile_player_linked',
          surface: 'profile',
          planId: access.canUseCaptainWorkflow ? 'captain' : access.canUseAdvancedPlayerInsights ? 'player_plus' : null,
          metadata: {
            playerId: nextPlayer.id,
            playerName: nextPlayer.name,
            teamCount: selectedPlayerTeams.length,
          },
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your profile.')
    } finally {
      setSaving(false)
    }
  }

  async function openBillingPortal() {
    if (!userId || billingPortalOpening) return

    setBillingPortalOpening(true)
    setBillingMessage('')
    setError('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Sign in to manage billing.')
      }

      const response = await fetch('/api/checkout/portal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const body = await response.json().catch(() => null) as
        | { ok?: boolean; message?: string; url?: string }
        | null

      if (!response.ok || !body?.ok || !body.url) {
        throw new Error(body?.message ?? 'Billing portal could not be opened.')
      }

      void trackProductUsageEvent({
        eventName: 'billing_portal_opened',
        surface: 'billing',
        planId: access.canUseCaptainWorkflow ? 'captain' : 'player_plus',
        metadata: {
          source: 'profile',
        },
      })
      window.location.assign(body.url)
    } catch (err) {
      setBillingMessage(err instanceof Error ? err.message : 'Billing portal could not be opened.')
      setBillingPortalOpening(false)
    }
  }

  const profileComplete = Boolean(profile?.linked_player_id || profile?.linked_player_name)
  const signedIn = Boolean(userId || session?.user?.id)
  const authPending = !authResolved && !signedIn
  const primaryRating = linkedPlayer || selectedPlayer
  const detectedLeagueCount = new Set(
    selectedPlayerTeams
      .map((team) => [team.league, team.flight].filter(Boolean).join(' - '))
      .filter(Boolean),
  ).size
  const profileMatchupHref = profile?.linked_player_id || selectedPlayerId
    ? `/matchup?type=singles&playerA=${encodeURIComponent(profile?.linked_player_id || selectedPlayerId)}`
    : '/matchup'
  const canManageBilling = Boolean(
    userId &&
    (access.canUseAdvancedPlayerInsights || access.canUseCaptainWorkflow),
  )
  const profileDisplayName = profile?.linked_player_name || selectedPlayer?.name || typedPlayerNameClean || 'Choose player'
  const selfRatingValue = normalizeSelfRating(selfRating)
  const ratingSourceLabel = (primaryRating?.rating_source === 'self' || typedProfileActive) ? 'Self-rated S' : 'Verified'
  const tiqOverallValue = typedProfileActive ? selfRatingValue : getTiqRating(primaryRating, 'overall')
  const tiqSinglesValue = typedProfileActive ? selfRatingValue : getTiqRating(primaryRating, 'singles')
  const tiqDoublesValue = typedProfileActive ? selfRatingValue : getTiqRating(primaryRating, 'doubles')
  const ratingTiles = [
    { label: 'TIQ', value: `${formatRating(tiqOverallValue)}${ratingSourceLabel === 'Self-rated S' ? ' S' : ''}` },
    { label: 'USTA', value: ratingSourceLabel === 'Self-rated S' ? 'Pending' : formatRating(getUstaRating(primaryRating, 'overall')) },
    { label: 'Singles', value: `${formatRating(tiqSinglesValue)}${ratingSourceLabel === 'Self-rated S' ? ' S' : ''}` },
    { label: 'Doubles', value: `${formatRating(tiqDoublesValue)}${ratingSourceLabel === 'Self-rated S' ? ' S' : ''}` },
    { label: 'Source', value: ratingSourceLabel },
  ]
  const dataAssistProfileHref = '/data-assist?intent=upload-source&context=Profile'
  const firstTiqMoves = [
    { title: 'Upload scorecard', href: dataAssistProfileHref, icon: 'reports' },
    { title: 'Local leagues', href: '/explore/leagues', icon: 'schedule' },
    { title: 'Create TIQ league', href: '/league-coordinator', icon: 'captainDashboard' },
    { title: 'Find players', href: '/explore/players', icon: 'playerRatings' },
  ] as const
  const profileNextMoves = [
    { title: 'Open My Lab', href: '/mylab', icon: 'myLab' },
    { title: 'Improve data', href: dataAssistProfileHref, icon: 'reports' },
    { title: 'Prep matchup', href: profileMatchupHref, icon: 'matchPrep' },
    { title: 'Review messages', href: '/messages', icon: 'messagingCenter' },
  ] as const
  const profileIdentityTitle = profileComplete ? profileDisplayName : 'Set your player identity'
  const profileSyncText = profileSource === 'cloud'
    ? 'Cloud synced. This player should follow you across devices.'
    : profileSource === 'local'
      ? 'Saved on this device. Cloud repair will retry when this browser has your session.'
      : ''
  const heroTitle = authPending
    ? 'Checking your account.'
    : profileComplete
    ? `${profileDisplayName} is your player.`
    : signedIn
      ? 'Set your player identity.'
      : 'Sign in to set up your profile.'
  const heroCopy = authPending
    ? 'Give TenAceIQ a moment to confirm your access.'
    : profileComplete
    ? 'My Lab, Matchup, Team, and League now start from this identity.'
    : signedIn
      ? 'Type your name, self-rate if needed, or choose an existing public record.'
      : 'Sign in once, then choose or create the player identity that powers your workspace.'

  return (
    <section style={pageStyle}>
        <section style={profileIntroStyle(isTablet, isMobile)}>
          <span aria-hidden="true" style={watermarkStyle} />
          <div style={profileIntroCopyStyle}>
            <h1 style={heroTitleStyle}>{heroTitle}</h1>
            <p style={heroTextStyle}>{heroCopy}</p>
          </div>
          <div style={profileIntroActionsStyle}>
            {profileComplete ? (
              <>
                <Link href="/mylab" style={primaryButtonStyle}>Open My Lab</Link>
                <Link href={profileMatchupHref} style={secondaryButtonStyle}>Open Matchup</Link>
              </>
            ) : authPending ? (
              <span style={secondaryButtonStyle}>Checking access</span>
            ) : signedIn ? (
              <a href="#profile-identity" style={primaryButtonStyle}>Set profile</a>
            ) : (
              <Link href="/login?next=%2Fprofile" style={primaryButtonStyle}>Sign in</Link>
            )}
          </div>
          {billingMessage ? <div style={billingMessageStyle}>{billingMessage}</div> : null}
        </section>

          <section style={contentGridStyle}>
            <div id="profile-identity" style={surfaceStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>{profileIdentityTitle}</h2>
                  <p style={sectionTextStyle}>
                    {profileComplete
                      ? 'Ratings, teams, leagues, and prep now start from this record.'
                      : 'Type your name, or choose an existing public record. Self-rated profiles show an S until verified data replaces it.'}
                  </p>
                </div>
                <TiqFeatureIcon name={profileComplete ? 'playerRatings' : 'accountSecurity'} size="md" variant={profileComplete ? 'surface' : 'ghost'} />
              </div>
              {loading ? (
                <div style={profileLoadingNoticeStyle}>
                  Loading existing records. You can type your name now.
                </div>
              ) : null}

              <div style={identityGridStyle(isMobile)}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Your tennis name</span>
                  <input
                    value={typedPlayerName}
                    onChange={(event) => {
                      setTypedPlayerName(event.target.value)
                      if (event.target.value.trim()) setSelectedPlayerId('')
                      setMessage('')
                      setError('')
                    }}
                    placeholder="Type your name"
                    style={inputStyle}
                  />
                </label>

                <label style={fieldStyle}>
                  <span style={labelStyle}>Possible match</span>
                  <select
                    value={selectedPlayerId}
                    onChange={(event) => {
                      setSelectedPlayerId(event.target.value)
                      if (event.target.value) setTypedPlayerName('')
                      setMessage('')
                      setError('')
                    }}
                    style={inputStyle}
                    disabled={loading && !matchingPlayers.length}
                  >
                    <option value="">
                      {typedPlayerNameClean
                        ? 'Create new self-rated profile'
                        : loading
                          ? 'Loading matches...'
                          : 'Type a name to find matches'}
                    </option>
                    {matchingPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}{player.location ? ` - ${player.location}` : ''}
                      </option>
                    ))}
                  </select>
                  <span style={hintStyle}>
                    {selectedPlayerId
                      ? 'Using a public player record.'
                      : typedPlayerNameClean
                        ? matchingPlayers.length
                          ? 'Pick a match only if it is clearly you.'
                          : 'No clear match yet. Saving creates your player profile.'
                        : 'Start with your name. Existing records appear only when they look relevant.'}
                  </span>
                </label>

                {typedProfileActive ? (
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Self rating</span>
                    <select value={selfRating} onChange={(event) => setSelfRating(event.target.value)} style={inputStyle}>
                      {['2.5', '3.0', '3.5', '4.0', '4.5', '5.0'].map((rating) => (
                        <option key={rating} value={rating}>{rating} S</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div style={autoContextStripStyle(isMobile)} aria-label="Automatically detected tennis context">
                  <Metric label="Teams" value={selectedPlayerTeams.length ? String(selectedPlayerTeams.length) : 'Auto'} />
                  <Metric label="Leagues" value={detectedLeagueCount ? String(detectedLeagueCount) : 'Auto'} />
                  <Metric label="Role" value={prefs.preferredRole === 'both' ? 'Both' : prefs.preferredRole} />
                </div>
              </div>

              <div style={ratingTileGridStyle}>
                {ratingTiles.map((tile) => (
                  <div key={tile.label} style={ratingTileStyle}>
                    <span>{tile.label}</span>
                    <strong>{tile.value}</strong>
                  </div>
                ))}
              </div>

              {profileAwards.length ? (
                <div style={profileAwardStripStyle}>
                  <div style={profileAwardHeaderStyle}>
                    <strong>{profileAwards.length} honor{profileAwards.length === 1 ? '' : 's'} linked</strong>
                    {profile?.linked_player_id ? (
                      <Link href={`/players/${encodeURIComponent(profile.linked_player_id)}#profile-trophy-case`} style={profileAwardLinkStyle}>
                        Trophy case
                      </Link>
                    ) : null}
                  </div>
                  <div style={profileAwardProofGridStyle} aria-label="Profile award proof">
                    <div style={profileAwardProofItemStyle}>
                      <span style={profileAwardProofDotStyle} />
                      <strong>Player link</strong>
                      <em>{profile?.linked_player_id ? 'Confirmed' : 'Name match'}</em>
                    </div>
                    <div style={profileAwardProofItemStyle}>
                      <span style={profileAwardProofDotStyle} />
                      <strong>Certificates</strong>
                      <em>{profileAwards.length}</em>
                    </div>
                  </div>
                  <div style={profileAwardPillRowStyle}>
                    {profileAwards.slice(0, 4).map((award) => (
                      <Link key={award.id} href={`/awards/${encodeURIComponent(award.id)}`} style={profileAwardPillStyle}>
                        <span>{award.badgeCode}</span>
                        <small>{award.badgeLabel}</small>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {profileComplete ? (
                <div style={nextMovePathStyle}>
                  <div style={newPlayerPathHeaderStyle}>
                    <TiqFeatureIcon name="myLab" size="sm" variant="ghost" />
                    <div>
                      <strong>Next move</strong>
                      <span>
                        {ratingSourceLabel === 'Self-rated S'
                          ? 'Self-rated is live. Add a scorecard or match signal when you are ready.'
                          : 'Your player identity is ready across the portal.'}
                      </span>
                    </div>
                  </div>
                  <div style={newPlayerActionGridStyle}>
                    {profileNextMoves.map((move) => (
                      <Link key={move.href} href={move.href} style={newPlayerActionCardStyle}>
                        <TiqFeatureIcon name={move.icon} size="sm" variant="ghost" />
                        <span>{move.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={newPlayerPathStyle}>
                  <div style={newPlayerPathHeaderStyle}>
                    <TiqFeatureIcon name="myLab" size="sm" variant="ghost" />
                    <div>
                      <strong>Start your TIQ</strong>
                      <span>Save your name, then add the first verified tennis signal.</span>
                    </div>
                  </div>
                  <div style={newPlayerActionGridStyle}>
                    {firstTiqMoves.map((move) => (
                      <Link key={move.href} href={move.href} style={newPlayerActionCardStyle}>
                        <TiqFeatureIcon name={move.icon} size="sm" variant="ghost" />
                        <span>{move.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div style={formGridStyle(isMobile)}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Preferred role</span>
                  <select
                    value={prefs.preferredRole}
                    onChange={(event) => {
                      setPrefs((current) => ({ ...current, preferredRole: event.target.value as PreferredRole }))
                      setMessage('')
                    }}
                    style={inputStyle}
                  >
                    <option value="both">Singles and doubles</option>
                    <option value="singles">Singles</option>
                    <option value="doubles">Doubles</option>
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span style={labelStyle}>Availability default</span>
                  <select
                    value={prefs.availabilityDefault}
                    onChange={(event) => {
                      setPrefs((current) => ({ ...current, availabilityDefault: event.target.value as AvailabilityDefault }))
                      setMessage('')
                    }}
                    style={inputStyle}
                  >
                    <option value="ask-weekly">Ask weekly</option>
                    <option value="usually-available">Usually available</option>
                    <option value="limited">Limited</option>
                  </select>
                </label>
              </div>

              <div style={actionRowStyle}>
                <button type="button" onClick={saveProfile} disabled={saving || !userId} style={primaryButtonStyle}>
                  {saving ? 'Saving...' : profileComplete ? 'Update profile' : 'Save profile'}
                </button>
                {profileComplete ? (
                  <>
                    <Link href="/mylab" style={secondaryButtonStyle}>Open My Lab</Link>
                    <Link href={profileMatchupHref} style={secondaryButtonStyle}>Compare matchup</Link>
                  </>
                ) : (
                  <Link href="/explore/players" style={secondaryButtonStyle}>Find players</Link>
                )}
                {canManageBilling ? (
                  <button
                    type="button"
                    onClick={() => void openBillingPortal()}
                    disabled={billingPortalOpening}
                    style={{
                      ...secondaryButtonStyle,
                      opacity: billingPortalOpening ? 0.72 : 1,
                      cursor: billingPortalOpening ? 'wait' : 'pointer',
                    }}
                  >
                    {billingPortalOpening ? 'Opening billing...' : 'Manage billing'}
                  </button>
                ) : null}
              </div>

              {selectedPlayerId && selectedPlayerTeams.length ? (
                <div style={teamContextListStyle}>
                  {selectedPlayerTeams.slice(0, 6).map((team) => (
                    <div key={team.id} style={teamContextRowStyle}>
                      <span>{team.name}</span>
                      <strong>{[team.league, team.flight].filter(Boolean).join(' - ') || 'Team context'}</strong>
                    </div>
                  ))}
                  {selectedPlayerTeams.length > 6 ? (
                    <div style={hintStyle}>
                      +{selectedPlayerTeams.length - 6} more detected team context {selectedPlayerTeams.length - 6 === 1 ? 'entry' : 'entries'}.
                    </div>
                  ) : null}
                </div>
              ) : null}
              {message ? <div style={successStyle}>{message}</div> : null}
              {profileComplete && profileSyncText ? <div style={profileSyncStatusStyle(profileSource)}>{profileSyncText}</div> : null}
              {error ? <div style={errorStyle}>{error}</div> : null}
            </div>
          </section>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  )
}

const pageStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '18px 0 64px',
  display: 'grid',
  gap: 18,
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
}

const profileIntroStyle = (isTablet: boolean, isMobile: boolean): CSSProperties => ({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
  gap: isMobile ? 12 : 18,
  alignItems: 'end',
  padding: isMobile ? '16px 14px' : '20px 22px',
  borderRadius: isMobile ? 22 : 28,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2,8,23,0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflow: 'hidden',
})

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 'clamp(-86px, -7vw, -32px)',
  bottom: 'clamp(-120px, -11vw, -54px)',
  width: 'clamp(210px, 29vw, 390px)',
  aspectRatio: '1',
  borderRadius: '50%',
  border: '1px solid rgba(155,225,29,0.16)',
  background:
    'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.15) 0 7%, transparent 8%), radial-gradient(circle at 52% 52%, rgba(155,225,29,0.09), rgba(125,211,252,0.04) 42%, transparent 68%)',
  opacity: 0.78,
  pointerEvents: 'none',
}

const profileIntroCopyStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minWidth: 0,
}

const profileIntroActionsStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 1.08,
  fontSize: 'clamp(1.45rem, 2.4vw, 2rem)',
  overflowWrap: 'anywhere',
}

const heroTextStyle: CSSProperties = {
  margin: '8px 0 0',
  maxWidth: 760,
  color: 'var(--shell-copy-muted)',
  fontSize: '0.95rem',
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const billingMessageStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  marginTop: 12,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
}

const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  textDecoration: 'none',
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
}

const metricStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.12)',
  background: 'rgba(255,255,255,0.045)',
  padding: 12,
  minWidth: 0,
}

const metricLabelStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const metricValueStyle: CSSProperties = {
  marginTop: 5,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
}

const contentGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  minWidth: 0,
}

const surfaceStyle: CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(8,13,28,0.64)',
  padding: '18px 20px',
  display: 'grid',
  gap: 16,
  minWidth: 0,
  boxShadow: '0 18px 45px rgba(2,8,23,0.30)',
}

const profileLoadingNoticeStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.18)',
  background: 'rgba(125,211,252,0.08)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionTitleStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: '1.45rem',
  fontWeight: 900,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const sectionTextStyle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
}

const formGridStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  minWidth: 0,
})

const identityGridStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.2fr) minmax(min(100%, 280px), 0.8fr)',
  gap: 12,
  alignItems: 'end',
  minWidth: 0,
})

const autoContextStripStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: isMobile ? 8 : 10,
  minWidth: 0,
})

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
}

const labelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 46,
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  padding: '0 12px',
  fontWeight: 800,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const hintStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const teamContextListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const teamContextRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.12)',
  background: 'rgba(255,255,255,0.045)',
  padding: '11px 12px',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const successStyle: CSSProperties = {
  color: '#bbf7d0',
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const profileSyncStatusStyle = (source: LoadUserProfileLinkResult['source']): CSSProperties => ({
  borderRadius: 14,
  border: source === 'cloud' ? '1px solid rgba(155,225,29,0.24)' : '1px solid rgba(251,191,36,0.24)',
  background: source === 'cloud' ? 'rgba(155,225,29,0.08)' : 'rgba(251,191,36,0.08)',
  color: source === 'cloud' ? '#d9ff99' : '#fde68a',
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 850,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
})

const errorStyle: CSSProperties = {
  color: '#fecaca',
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const ratingTileGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const ratingTileStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.12)',
  background: 'rgba(255,255,255,0.045)',
  padding: 13,
  display: 'grid',
  gap: 8,
  minHeight: 86,
  minWidth: 0,
}

const profileAwardStripStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.08), rgba(116,190,255,0.055))',
  minWidth: 0,
}

const profileAwardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
  minWidth: 0,
}

const profileAwardPillRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  minWidth: 0,
}

const profileAwardProofGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const profileAwardProofItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  padding: '9px 10px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.42)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const profileAwardProofDotStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
}

const profileAwardPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 28,
  maxWidth: '100%',
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.10)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const profileAwardLinkStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const newPlayerPathStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 750,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const nextMovePathStyle: CSSProperties = {
  ...newPlayerPathStyle,
  border: '1px solid rgba(125,211,252,0.18)',
  background: 'linear-gradient(135deg, rgba(125,211,252,0.09), rgba(155,225,29,0.055))',
}

const newPlayerPathHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const newPlayerActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const newPlayerActionCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
  alignItems: 'center',
  gap: 8,
  minHeight: 46,
  padding: '8px 10px',
  borderRadius: 12,
  border: '1px solid rgba(117,184,255,0.22)',
  background: 'rgba(7,18,34,0.52)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
  minWidth: 0,
  overflowWrap: 'anywhere',
}
