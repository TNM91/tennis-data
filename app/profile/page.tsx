'use client'

import Link from 'next/link'
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import QuickMessageComposer from '@/app/components/quick-message-composer'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'
import { cleanText, formatRating } from '@/lib/captain-formatters'
import { buildScopedTeamEntityId } from '@/lib/entity-ids'
import { getTiqRating, getUstaRating } from '@/lib/player-rating-display'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import { uploadProfilePhoto } from '@/lib/profile-photo-service'
import { MEMBERSHIP_TIERS } from '@/lib/product-story'
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
  const { role, entitlements, userId, authResolved } = useAuth()
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
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')
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

  async function handleProfilePhotoUpload(file: File | null) {
    if (!file) return

    setPhotoUploading(true)
    setPhotoMessage('Uploading profile photo...')
    setError('')

    const result = await uploadProfilePhoto(file)
    if (result.warning) {
      setPhotoMessage(result.warning)
    } else {
      setProfile((current) => ({
        linked_player_id: current?.linked_player_id || null,
        linked_player_name: current?.linked_player_name || null,
        linked_team_name: current?.linked_team_name || null,
        linked_league_name: current?.linked_league_name || null,
        linked_flight: current?.linked_flight || null,
        profile_photo_url: result.publicUrl,
      }))
      setPhotoMessage('Profile photo uploaded.')
    }

    setPhotoUploading(false)
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
  const primaryRating = linkedPlayer || selectedPlayer
  const detectedLeagueCount = new Set(
    selectedPlayerTeams
      .map((team) => [team.league, team.flight].filter(Boolean).join(' - '))
      .filter(Boolean),
  ).size
  const roleLabel = prefs.preferredRole === 'both' ? 'Singles and doubles' : prefs.preferredRole === 'singles' ? 'Singles' : 'Doubles'
  const availabilityLabel =
    prefs.availabilityDefault === 'usually-available'
      ? 'Usually available'
      : prefs.availabilityDefault === 'limited'
        ? 'Limited'
        : 'Ask weekly'
  const profileMatchupHref = profile?.linked_player_id || selectedPlayerId
    ? `/matchup?type=singles&playerA=${encodeURIComponent(profile?.linked_player_id || selectedPlayerId)}`
    : '/matchup'
  const canManageBilling = Boolean(
    userId &&
    (access.canUseAdvancedPlayerInsights || access.canUseCaptainWorkflow),
  )
  const profileDisplayName = profile?.linked_player_name || selectedPlayer?.name || 'Choose player'
  const profileInitials = profileDisplayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'TIQ'
  const toolFlowCards = [
    {
      label: 'Identity',
      value: profileComplete ? 'Linked' : 'Set once',
      note: profileDisplayName,
      icon: 'accountSecurity' as TiqFeatureIconName,
    },
    {
      label: 'My Lab',
      value: 'Personal',
      note: 'Stats, goals, next read',
      icon: 'myLab' as TiqFeatureIconName,
    },
    {
      label: 'Matchup',
      value: profileComplete || selectedPlayerId ? 'Ready' : 'Waiting',
      note: 'Starts with you',
      icon: 'matchupAnalysis' as TiqFeatureIconName,
    },
  ]
  const ratingTiles = [
    { label: 'TIQ', value: formatRating(getTiqRating(primaryRating, 'overall')) },
    { label: 'USTA', value: formatRating(getUstaRating(primaryRating, 'overall')) },
    { label: 'Singles', value: formatRating(getTiqRating(primaryRating, 'singles')) },
    { label: 'Doubles', value: formatRating(getTiqRating(primaryRating, 'doubles')) },
  ]
  const toolActionCards = [
    { label: 'My Lab', value: 'Scorecard', href: '/mylab', note: 'Stats, goals, next read', icon: 'myLab' as TiqFeatureIconName },
    {
      label: 'Matchup',
      value: profileComplete || selectedPlayerId ? 'Ready' : 'Waiting',
      href: profileMatchupHref,
      note: 'Compare from your profile',
      icon: 'matchupAnalysis' as TiqFeatureIconName,
    },
    { label: 'Captain', value: 'Context', href: '/captain', note: 'Roster and team tools', icon: 'captainDashboard' as TiqFeatureIconName },
  ]
  const playerTier = MEMBERSHIP_TIERS.player_plus
  const setupSteps = [
    {
      step: '1',
      label: 'Player identity',
      value: profileComplete ? 'Linked' : 'Next',
      text: profileComplete
        ? `${profileDisplayName} is connected to this account.`
        : 'Choose the player record that should power your TenAceIQ tools.',
      complete: profileComplete,
    },
    {
      step: '2',
      label: 'Play defaults',
      value: 'Ready',
      text: `${roleLabel}. Availability starts as ${availabilityLabel.toLowerCase()}.`,
      complete: true,
    },
    {
      step: '3',
      label: 'Player tools',
      value: access.canUseAdvancedPlayerInsights ? 'Active' : 'Unlock',
      text: access.canUseAdvancedPlayerInsights
        ? 'My Lab and Matchup can start from your profile context.'
        : playerTier.upgradeCue,
      complete: access.canUseAdvancedPlayerInsights,
    },
  ]
  const setupProgress = setupSteps.filter((step) => step.complete).length

  return (
    <section style={pageStyle}>
        <section style={heroStyle(isTablet, isMobile)}>
          <div>
            <div style={eyebrowStyle}>Manage profile</div>
            <h1 style={heroTitleStyle}>Your player identity, connected.</h1>
            <p style={heroTextStyle}>
              Pick your player once. TenAceIQ pulls your tennis context forward from there.
            </p>
            <div style={toolFlowStyle(isMobile)}>
              {toolFlowCards.map((card) => (
                <div key={card.label} style={toolFlowCardStyle(isMobile)}>
                  <TiqFeatureIcon name={card.icon} size={isMobile ? 'sm' : 'md'} variant="ghost" />
                  <div>
                    <div style={toolFlowLabelStyle}>{card.label}</div>
                    <div style={toolFlowValueStyle}>{card.value}</div>
                    {!isMobile ? <div style={toolFlowNoteStyle}>{card.note}</div> : null}
                  </div>
                </div>
              ))}
            </div>
            <div style={heroButtonRowStyle}>
              <Link href="/mylab" style={primaryButtonStyle}>Open My Lab</Link>
              <Link href={profileMatchupHref} style={secondaryButtonStyle}>Open Matchup</Link>
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
              {canManageBilling ? (
                <QuickMessageComposer
                  mode="support"
                  triggerLabel="Ask billing support"
                  category="billing"
                  subject="Question about my TenAceIQ billing"
                  body={[
                    'I have a question about my TenAceIQ billing.',
                    '',
                    'Plan or charge:',
                    'What I need help with:',
                  ].join('\n')}
                  entityType="billing"
                  entityId={userId || ''}
                />
              ) : null}
            </div>
            {billingMessage ? <div style={billingMessageStyle}>{billingMessage}</div> : null}
          </div>

          <div style={statusPanelStyle}>
            <div style={profileBadgeRowStyle}>
              <span style={profileComplete ? pillGreenStyle : pillSlateStyle}>
                {profileComplete ? 'Linked' : access.canUseAdvancedPlayerInsights ? 'Player tools active' : 'Free profile'}
              </span>
              <span style={pillSlateStyle}>{availabilityLabel}</span>
            </div>
            <div style={playerCardTopStyle}>
              <div style={avatarStyle}>
                {profile?.profile_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profile_photo_url} alt="" style={avatarImageStyle} />
                ) : (
                  profileInitials
                )}
              </div>
              <div>
                <div style={statusTitleStyle}>{profileDisplayName}</div>
                <div style={statusTextStyle}>{roleLabel}</div>
              </div>
            </div>
            <div style={photoControlStyle}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={photoUploading || !userId}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  void handleProfilePhotoUpload(file)
                  event.target.value = ''
                }}
                style={photoInputStyle}
              />
              {photoMessage ? <div style={photoMessageStyle}>{photoMessage}</div> : null}
            </div>
            <div style={miniGridStyle}>
                <Metric label="Teams" value={selectedPlayerTeams.length ? String(selectedPlayerTeams.length) : 'Detecting'} />
                <Metric label="Leagues" value={detectedLeagueCount ? String(detectedLeagueCount) : 'Detecting'} />
                <Metric label="Matchup" value={profileComplete || selectedPlayerId ? 'Ready' : 'Set'} />
              </div>
            </div>
        </section>

        <section style={setupPathStyle(isMobile)} aria-label="Profile setup path">
          <div style={setupPathHeaderStyle(isMobile)}>
            <div>
              <p style={sectionKickerStyle}>Player setup</p>
              <h2 style={setupPathTitleStyle}>Finish the path from account to My Lab.</h2>
              <p style={setupPathTextStyle}>
                Link the right player, keep your play defaults current, then use the profile as your launch point.
              </p>
            </div>
            <div style={setupProgressStyle}>
              <strong>{setupProgress}/3</strong>
              <span>ready</span>
            </div>
          </div>
          <div style={setupStepGridStyle(isMobile)}>
            {setupSteps.map((step) => (
              <div key={step.label} style={setupStepCardStyle(step.complete)}>
                <div style={setupStepTopStyle}>
                  <span style={setupStepNumberStyle(step.complete)}>{step.step}</span>
                  <span style={step.complete ? pillGreenStyle : pillSlateStyle}>{step.value}</span>
                </div>
                <strong style={setupStepLabelStyle}>{step.label}</strong>
                <p style={setupStepTextStyle}>{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {loading ? (
          <div style={surfaceStyle}>Loading profile...</div>
        ) : (
          <section style={contentGridStyle(isTablet)}>
            <div style={surfaceStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKickerStyle}>Identity</p>
                  <h2 style={sectionTitleStyle}>Set your player once</h2>
                  <p style={sectionTextStyle}>Teams and leagues are detected from match history as your tennis footprint grows.</p>
                </div>
                <span style={profileComplete ? pillGreenStyle : pillSlateStyle}>
                  {profileComplete ? 'Linked' : 'Not linked'}
                </span>
              </div>

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
                  >
                    <option value="">Select your player record</option>
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
                  <strong style={autoContextTitleStyle}>Your tennis context updates automatically.</strong>
                  <p style={autoContextTextStyle}>
                    Link the player record. TenAceIQ uses match history to find teams, leagues, ratings, and matchup starting points.
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
                <button type="button" onClick={saveProfile} disabled={saving || !userId} style={primaryButtonStyle}>
                  {saving ? 'Saving...' : 'Save player identity'}
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
              <div style={sectionKickerStyle}>Personalized tools</div>
              <h2 style={sectionTitleStyle}>What this powers</h2>
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
              </div>
            </aside>
          </section>
        )}
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
  padding: '14px 24px 26px',
  minWidth: 0,
}

const heroStyle = (isTablet: boolean, isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.25fr) minmax(min(100%, 320px), 0.75fr)',
  gap: isMobile ? 18 : 24,
  padding: isMobile ? '20px 18px' : '30px 28px',
  borderRadius: isMobile ? 24 : 30,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
  minWidth: 0,
})

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  maxWidth: '100%',
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--home-eyebrow-color)',
  fontWeight: 900,
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 10,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 1,
  fontSize: 'clamp(2rem, 4vw, 3.4rem)',
  overflowWrap: 'anywhere',
}

const heroTextStyle: CSSProperties = {
  margin: '14px 0 0',
  maxWidth: 620,
  color: 'var(--shell-copy-muted)',
  fontSize: '1.02rem',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const toolFlowStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  marginTop: isMobile ? 16 : 20,
  minWidth: 0,
})

const toolFlowCardStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'auto minmax(0, 1fr)',
  gap: isMobile ? 7 : 10,
  alignItems: isMobile ? 'start' : 'center',
  borderRadius: isMobile ? 16 : 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: isMobile ? '10px 9px' : 12,
  minHeight: isMobile ? 92 : 92,
  minWidth: 0,
})

const toolFlowLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const toolFlowValueStyle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const toolFlowNoteStyle: CSSProperties = {
  marginTop: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const heroButtonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 22,
  minWidth: 0,
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

const statusPanelStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-green) 12%, transparent) 0%, transparent 34%), var(--shell-panel-bg)',
  padding: 18,
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const profileBadgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  justifyContent: 'space-between',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const playerCardTopStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
}

const avatarStyle: CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 18,
  overflow: 'hidden',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, var(--brand-blue-2), var(--brand-green))',
  color: 'white',
  fontSize: 18,
  fontWeight: 950,
  boxShadow: 'var(--shadow-soft)',
}

const avatarImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'cover',
}

const photoControlStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const photoInputStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  overflowWrap: 'anywhere',
}

const photoMessageStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

const statusTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.35rem',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const statusTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
}

const miniGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 116px), 1fr))',
  gap: 10,
  minWidth: 0,
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

const setupPathStyle = (isMobile: boolean): CSSProperties => ({
  marginTop: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--brand-blue-2) 8%, transparent), transparent 56%), var(--shell-panel-bg)',
  padding: isMobile ? '16px 14px' : '18px 20px',
  display: 'grid',
  gap: 16,
  minWidth: 0,
})

const setupPathHeaderStyle = (isMobile: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: isMobile ? 'column' : 'row',
  alignItems: isMobile ? 'stretch' : 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  minWidth: 0,
})

const setupPathTitleStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: '1.35rem',
  fontWeight: 950,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const setupPathTextStyle: CSSProperties = {
  margin: '7px 0 0',
  maxWidth: 720,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const setupProgressStyle: CSSProperties = {
  minWidth: 'min(100%, 96px)',
  maxWidth: '100%',
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 26%, var(--shell-panel-border) 74%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  padding: '10px 12px',
  display: 'grid',
  justifyItems: 'center',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const setupStepGridStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
  gap: 10,
  minWidth: 0,
})

const setupStepCardStyle = (complete: boolean): CSSProperties => ({
  minHeight: 146,
  borderRadius: 18,
  border: complete
    ? '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)'
    : '1px solid var(--shell-panel-border)',
  background: complete
    ? 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)'
    : 'var(--shell-chip-bg)',
  padding: 14,
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
})

const setupStepTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const setupStepNumberStyle = (complete: boolean): CSSProperties => ({
  width: 30,
  height: 30,
  borderRadius: 12,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: complete
    ? '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)'
    : '1px solid var(--shell-panel-border)',
  background: complete
    ? 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)'
    : 'var(--shell-panel-bg)',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
})

const setupStepLabelStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1rem',
  fontWeight: 950,
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
}

const setupStepTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

const surfaceStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '18px 20px',
  display: 'grid',
  gap: 16,
  minWidth: 0,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionKickerStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
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

const pillGreenStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  padding: '7px 11px',
  fontSize: 12,
  fontWeight: 900,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const pillSlateStyle: CSSProperties = {
  ...pillGreenStyle,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'auto minmax(0, 1fr)',
  gap: 12,
  alignItems: 'center',
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 9%, transparent), transparent 62%), var(--shell-chip-bg)',
  padding: isMobile ? 14 : 16,
  minWidth: 0,
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
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '8px 10px',
  alignItems: 'center',
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 13,
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  minWidth: 0,
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
