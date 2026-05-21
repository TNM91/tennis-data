'use client'

import Link from 'next/link'
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'
import { cleanText, formatRating } from '@/lib/captain-formatters'
import { buildScopedTeamEntityId } from '@/lib/entity-ids'
import { getTiqRating, getUstaRating } from '@/lib/player-rating-display'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import { supabase } from '@/lib/supabase'
import { loadUserProfileLink, saveUserProfileLink, type UserProfileLink } from '@/lib/user-profile'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

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
  const [prefs, setPrefs] = useState<ProfilePrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [billingPortalOpening, setBillingPortalOpening] = useState(false)
  const [billingMessage, setBillingMessage] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
        supabase
          .from('players')
          .select(`
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
          `)
          .order('name', { ascending: true }),
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

      if (playersRes.error) throw new Error(playersRes.error.message)
      if (matchesRes.error) throw new Error(matchesRes.error.message)
      if (matchPlayersRes.error) throw new Error(matchPlayersRes.error.message)
      if (profileRes.error) {
        throw new Error(profileRes.error.message)
      }

      const nextProfile = profileRes.data
      setPlayers((playersRes.data || []) as PlayerRow[])
      setMatches((matchesRes.data || []) as MatchRow[])
      setMatchPlayers((matchPlayersRes.data || []) as MatchPlayerRow[])
      setProfile(nextProfile)
      setSelectedPlayerId(nextProfile?.linked_player_id || '')
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

    const payload: UserProfileLink & { linked_team_at: string } = {
      linked_player_id: selectedPlayer?.id || null,
      linked_player_name: selectedPlayer?.name || null,
      linked_team_name: null,
      linked_league_name: null,
      linked_flight: null,
      linked_team_at: new Date().toISOString(),
    }

    setSaving(true)
    setMessage('')
    setError('')

    try {
      const saveRes = await saveUserProfileLink(userId, payload)
      if (saveRes.error) throw saveRes.error

      writeProfilePrefs(prefs)
      setProfile({
        linked_player_id: payload.linked_player_id,
        linked_player_name: payload.linked_player_name,
        linked_team_name: payload.linked_team_name,
        linked_league_name: payload.linked_league_name,
        linked_flight: payload.linked_flight,
        profile_photo_url: profile?.profile_photo_url || null,
        message_display_name: profile?.message_display_name || payload.linked_player_name || null,
      })
      setMessage(
        saveRes.source === 'local'
          ? 'Profile saved on this device. Apply the profile-link migration for cloud sync.'
          : 'Profile saved. My Lab, Matchup, and Captain tools can use this context.',
      )
      if (selectedPlayer?.id) {
        void trackProductUsageEvent({
          eventName: 'profile_player_linked',
          surface: 'profile',
          planId: access.canUseCaptainWorkflow ? 'captain' : access.canUseAdvancedPlayerInsights ? 'player_plus' : null,
          metadata: {
            playerId: selectedPlayer.id,
            playerName: selectedPlayer.name,
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
  const profileDisplayName = profile?.linked_player_name || selectedPlayer?.name || 'Choose player'
  const ratingTiles = [
    { label: 'TIQ', value: formatRating(getTiqRating(primaryRating, 'overall')) },
    { label: 'USTA', value: formatRating(getUstaRating(primaryRating, 'overall')) },
    { label: 'Singles', value: formatRating(getTiqRating(primaryRating, 'singles')) },
    { label: 'Doubles', value: formatRating(getTiqRating(primaryRating, 'doubles')) },
  ]
  const toolActionCards = [
    { label: 'My Lab', value: 'Scorecard', href: '/mylab', note: 'Stats, goals, next read', icon: 'myLab' as TiqFeatureIconName },
    {
      label: 'Prep',
      value: profileComplete || selectedPlayerId ? 'Ready' : 'Waiting',
      href: profileMatchupHref,
      note: 'Compare from your profile',
      icon: 'matchupAnalysis' as TiqFeatureIconName,
    },
    { label: 'Team', value: 'Context', href: '/captain', note: 'Roster and team tools', icon: 'captainDashboard' as TiqFeatureIconName },
  ]
  const heroTitle = authPending
    ? 'Checking your account.'
    : profileComplete
    ? 'Your player identity is connected.'
    : signedIn
      ? 'Link your player profile.'
      : 'Sign in to link your profile.'
  const heroCopy = authPending
    ? 'Give TenAceIQ a moment to confirm whether this profile should open as signed in or public.'
    : profileComplete
    ? 'Your account knows which player record powers My Lab, Matchup, Team, and League context.'
    : signedIn
      ? 'TenAceIQ knows you are signed in. Now choose the player record that should personalize your tools.'
      : 'Sign in first, then choose the player record that should personalize your TenAceIQ tools.'

  return (
    <section style={pageStyle}>
        <section style={profileIntroStyle(isTablet, isMobile)}>
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
              <a href="#profile-identity" style={primaryButtonStyle}>Link player</a>
            ) : (
              <Link href="/login?next=%2Fprofile" style={primaryButtonStyle}>Sign in</Link>
            )}
          </div>
          {billingMessage ? <div style={billingMessageStyle}>{billingMessage}</div> : null}
        </section>

          <section style={contentGridStyle(isTablet)}>
            <div id="profile-identity" style={surfaceStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>{profileComplete ? profileDisplayName : 'Choose your player record'}</h2>
                  <p style={sectionTextStyle}>
                    {profileComplete
                      ? 'This is the player record TenAceIQ uses for your lab, matchup prep, team context, and league shortcuts.'
                      : 'Pick your public player record once. After that, the portal can start from your tennis identity.'}
                  </p>
                </div>
                <TiqFeatureIcon name={profileComplete ? 'playerRatings' : 'accountSecurity'} size="md" variant={profileComplete ? 'surface' : 'ghost'} />
              </div>
              {loading ? (
                <div style={profileLoadingNoticeStyle}>
                  Loading player records. You can start here as soon as the list appears.
                </div>
              ) : null}

              <div style={identityGridStyle(isMobile)}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Player record</span>
                  <select
                    value={selectedPlayerId}
                    onChange={(event) => {
                      setSelectedPlayerId(event.target.value)
                      setMessage('')
                      setError('')
                    }}
                    style={inputStyle}
                    disabled={loading}
                  >
                    <option value="">{loading ? 'Loading player records...' : 'Select your player record'}</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}{player.location ? ` - ${player.location}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={autoContextStripStyle(isMobile)} aria-label="Automatically detected tennis context">
                  <Metric label="Teams" value={selectedPlayerTeams.length ? String(selectedPlayerTeams.length) : 'Auto'} />
                  <Metric label="Leagues" value={detectedLeagueCount ? String(detectedLeagueCount) : 'Auto'} />
                  <Metric label="Role" value={prefs.preferredRole === 'both' ? 'Both' : prefs.preferredRole} />
                </div>
              </div>

              <div style={autoContextCalloutStyle(isMobile)}>
                <TiqFeatureIcon name="playerRatings" size="md" variant="surface" />
                <div>
                  <strong style={autoContextTitleStyle}>{profileComplete ? 'Your tennis map is connected.' : 'This becomes your tennis home base.'}</strong>
                  <p style={autoContextTextStyle}>
                    TenAceIQ uses match history to find teams, leagues, ratings, and matchup starting points without making you rebuild the same context every visit.
                  </p>
                </div>
              </div>

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
                <button type="button" onClick={saveProfile} disabled={saving || loading || !userId} style={primaryButtonStyle}>
                  {saving ? 'Saving...' : profileComplete ? 'Update player link' : 'Save player link'}
                </button>
                <Link href="/explore/players" style={secondaryButtonStyle}>Find players</Link>
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
              {error ? <div style={errorStyle}>{error}</div> : null}
            </div>

            <aside style={surfaceStyle}>
              <h2 style={sectionTitleStyle}>{profileComplete ? 'Ready to use' : 'Unlocks when linked'}</h2>
              <p style={sectionTextStyle}>
                {profileComplete
                  ? 'Jump straight into the parts of the portal that depend on knowing your player identity.'
                  : 'Once the player link is saved, these tools open with your ratings and team context already attached.'}
              </p>
              <div style={ratingTileGridStyle}>
                {ratingTiles.map((tile) => (
                  <div key={tile.label} style={ratingTileStyle}>
                    <span>{tile.label}</span>
                    <strong>{tile.value}</strong>
                  </div>
                ))}
              </div>
              <div style={toolLaunchGridStyle}>
                {toolActionCards.map((card) => (
                  <Link key={card.label} href={card.href} style={toolLaunchCardStyle}>
                    <TiqFeatureIcon name={card.icon} size="sm" variant="ghost" />
                    <span style={toolLaunchCardMainStyle}>
                      <small style={toolLaunchKickerStyle}>{card.label}</small>
                      <strong style={toolLaunchValueStyle}>{card.value}</strong>
                    </span>
                    <em style={toolLaunchNoteStyle}>{card.note}</em>
                  </Link>
                ))}
              </div>
              <div style={summaryActionRowStyle}>
                <Link href="/mylab" style={primaryButtonStyle}>Open My Lab</Link>
                <Link href={profileMatchupHref} style={secondaryButtonStyle}>Compare matchup</Link>
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
            </aside>
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
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '8px clamp(14px, 4vw, 24px) 26px',
  minWidth: 0,
}

const profileIntroStyle = (isTablet: boolean, isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
  gap: isMobile ? 12 : 18,
  alignItems: 'end',
  padding: isMobile ? '16px 14px' : '20px 22px',
  borderRadius: isMobile ? 22 : 26,
  border: '1px solid var(--shell-panel-border)',
  background:
    'radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--brand-green) 14%, transparent), transparent 28%), var(--shell-panel-bg)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflow: 'hidden',
})

const profileIntroCopyStyle: CSSProperties = {
  minWidth: 0,
}

const profileIntroActionsStyle: CSSProperties = {
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
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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

const contentGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.25fr) minmax(min(100%, 320px), 0.75fr)',
  gap: 18,
  marginTop: 18,
  minWidth: 0,
})

const surfaceStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '18px 20px',
  display: 'grid',
  gap: 16,
  minWidth: 0,
}

const profileLoadingNoticeStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-blue) 26%, var(--shell-panel-border) 74%)',
  background: 'color-mix(in srgb, var(--brand-blue) 10%, var(--shell-chip-bg) 90%)',
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

const autoContextCalloutStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, auto) minmax(0, 1fr)',
  gap: 12,
  alignItems: 'center',
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 9%, transparent), transparent 62%), var(--shell-chip-bg)',
  padding: isMobile ? 14 : 16,
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const autoContextTitleStyle: CSSProperties = {
  display: 'block',
  color: 'var(--foreground-strong)',
  fontSize: '1rem',
  fontWeight: 950,
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
}

const autoContextTextStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 13,
  display: 'grid',
  gap: 8,
  minHeight: 86,
  minWidth: 0,
}

const toolLaunchGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const toolLaunchCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
  gap: '8px 10px',
  alignItems: 'center',
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 13,
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const toolLaunchCardMainStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const toolLaunchKickerStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const toolLaunchValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.05rem',
  fontWeight: 950,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const toolLaunchNoteStyle: CSSProperties = {
  gridColumn: '1 / -1',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontStyle: 'normal',
  fontWeight: 700,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const summaryActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 16,
  minWidth: 0,
}
