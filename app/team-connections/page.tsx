'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import {
  getTeamConnectionRolesLabel,
  getTeamConnectionSourceLabel,
  isCaptainTeamConnection,
  type TeamConnection,
} from '@/lib/team-profile-links'
import {
  fetchTeamConnections,
  updateTeamConnection,
  type TeamInviteOffers,
} from '@/lib/team-profile-links-client'
import { subscribeToTeamConnectionsChanged } from '@/lib/team-profile-links-events'
import { buildTeamRoomHref } from '@/lib/team-room'
import { buildCaptainScopedHref } from '@/lib/captain-memory'

export default function TeamConnectionsPage() {
  return (
    <SiteShell active="/mylab">
      <TeamConnectionsContent />
    </SiteShell>
  )
}

function TeamConnectionsContent() {
  const { authResolved, entitlements, role, session, userId } = useAuth()
  const [pending, setPending] = useState<TeamConnection[]>([])
  const [connections, setConnections] = useState<TeamConnection[]>([])
  const [offers, setOffers] = useState<TeamInviteOffers>({
    captain: { available: false, label: '' },
    player: { available: false, label: '' },
  })
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState('')
  const [message, setMessage] = useState('')
  const [completedConnection, setCompletedConnection] = useState<TeamConnection | null>(null)
  const [requestedScope, setRequestedScope] = useState({ teamName: '', leagueName: '', flight: '' })
  const accessToken = session?.access_token || ''
  const access = useMemo(() => buildProductAccessState(userId ? role : 'public', entitlements), [entitlements, role, userId])

  const reload = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setMessage('')
    try {
      const result = await fetchTeamConnections(accessToken, { includeOffers: true, userId, force: true })
      setPending(result.pending)
      setConnections(result.connections)
      setOffers(result.offers)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Team connections could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [accessToken, userId])

  useEffect(() => {
    if (!authResolved) return
    if (!accessToken) {
      setLoading(false)
      return
    }
    void reload()
  }, [accessToken, authResolved, reload])

  useEffect(() => subscribeToTeamConnectionsChanged(() => void reload()), [reload])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setRequestedScope({
      teamName: params.get('team')?.trim() || '',
      leagueName: params.get('league')?.trim() || '',
      flight: params.get('flight')?.trim() || '',
    })
  }, [])

  async function act(connection: TeamConnection, action: 'accept' | 'decline' | 'unlink' | 'relink' | 'restore_roles' | 'set_default') {
    if (!accessToken || workingId) return
    setWorkingId(connection.id)
    setMessage('')
    try {
      await updateTeamConnection({ accessToken, connectionId: connection.id, action })
      const linked = action === 'accept' || action === 'relink' || action === 'restore_roles'
      if (linked) {
        setCompletedConnection({ ...connection, status: 'accepted' })
      }
      await reload()
      setMessage(
        action === 'set_default'
          ? `${connection.teamName} will open first across My Lab and Captain.`
          : linked
            ? `${connection.teamName} is linked to your profile.`
          : action === 'unlink'
            ? `${connection.teamName} was unlinked. You can reconnect it here later.`
            : 'Invitation dismissed.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Team connection could not be updated.')
    } finally {
      setWorkingId('')
    }
  }

  const activeConnections = connections.filter((connection) => !connection.archivedAt)
  const archivedConnections = connections.filter((connection) => Boolean(connection.archivedAt))
  const acceptedCaptainLinks = activeConnections.filter(
    (connection) => connection.status === 'accepted' && isCaptainTeamConnection(connection.roles),
  )
  const acceptedPlayerLinks = activeConnections.filter(
    (connection) => connection.status === 'accepted' && connection.roles.includes('player'),
  )
  const requestedPendingConnection = pending.find((connection) => matchesRequestedTeamScope(connection, requestedScope)) || null
  const requestedSavedConnection = connections.find((connection) => matchesRequestedTeamScope(connection, requestedScope)) || null

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <span style={eyebrowStyle}>Profile connections</span>
        <h1 style={titleStyle}>Your teams, with your permission.</h1>
        <p style={copyStyle}>
          When another member imports or adds you to a team, review it here. Linking adds the team context to your profile; you stay in control and can unlink it later.
        </p>
      </section>

      {!authResolved || loading ? <p style={noticeStyle}>Checking team connections…</p> : null}
      {authResolved && !userId ? (
        <section style={panelStyle}>
          <strong style={panelTitleStyle}>Sign in to review teams connected to your email or player profile.</strong>
          <Link href="/login?next=%2Fteam-connections" style={primaryLinkStyle}>Sign in</Link>
        </section>
      ) : null}
      {message ? <p style={noticeStyle} role="status" aria-live="polite">{message}</p> : null}
      {completedConnection ? (
        <section style={completionStyle} className="team-connection-completion" aria-label="Team link complete">
          <div style={copyBlockStyle}>
            <span style={eyebrowStyle}>Team linked</span>
            <strong style={panelTitleStyle}>{completedConnection.teamName} is now in My Teams.</strong>
            <span style={copyStyle}>Open My Teams for the roster, schedule, and Team Chat.</span>
          </div>
          <div style={cardActionsStyle}>
            <Link href="/compete/teams" style={primaryLinkStyle}>
              Open My Teams
            </Link>
            <Link href={buildTeamConnectionWorkspaceHref(completedConnection)} style={secondaryLinkStyle}>
              {isCaptainTeamConnection(completedConnection.roles) ? 'Open Captain' : 'Open My Lab'}
            </Link>
            <button type="button" onClick={() => setCompletedConnection(null)} style={secondaryButtonStyle}>Done</button>
          </div>
        </section>
      ) : null}

      {userId && !loading && !message && requestedScope.teamName && !requestedPendingConnection && !requestedSavedConnection ? (
        <section id={!pending.length ? 'pending-team-links' : undefined} style={panelStyle} aria-label="Find your imported team link">
          <strong style={panelTitleStyle}>Connect your player to {requestedScope.teamName}.</strong>
          <p style={copyStyle}>TiQ has not matched this team to your account yet. Find and link your player profile, or use the email listed for you on the Player Roster. Then return here and check again.</p>
          <div style={cardActionsStyle}>
            <Link href="/profile#profile-identity" style={primaryLinkStyle}>Find my player</Link>
            <button type="button" onClick={() => void reload()} style={secondaryButtonStyle}>Check again</button>
          </div>
          <p style={copyStyle}>Uploaded an opponent? You do not need to link their team.</p>
        </section>
      ) : null}

      {userId && pending.length ? (
        <section id="pending-team-links" style={sectionStyle} aria-label="Pending team invitations">
          <div style={sectionHeaderStyle}>
            <span style={eyebrowStyle}>Needs your review</span>
            <h2 style={sectionTitleStyle}>Team invitations</h2>
          </div>
          {requestedPendingConnection ? <p style={noticeStyle} role="status">Review the highlighted {requestedPendingConnection.teamName} link, then choose Link team.</p> : null}
          <div style={cardGridStyle}>
            {pending.map((connection) => (
              <ConnectionCard key={connection.id} connection={connection} highlighted={connection.id === requestedPendingConnection?.id}>
                <button type="button" onClick={() => void act(connection, 'accept')} disabled={Boolean(workingId)} style={primaryButtonStyle}>
                  {workingId === connection.id ? 'Saving' : connection.isRoleUpdate ? 'Link both roles' : 'Link team'}
                </button>
                <button type="button" onClick={() => void act(connection, 'decline')} disabled={Boolean(workingId)} style={secondaryButtonStyle}>{connection.isRoleUpdate ? 'Not this role' : 'Not mine'}</button>
              </ConnectionCard>
            ))}
          </div>
        </section>
      ) : null}

      {userId ? (
        <section style={sectionStyle} aria-label="Saved team connections">
          <div style={sectionHeaderStyle}>
            <span style={eyebrowStyle}>Your profile</span>
            <h2 style={sectionTitleStyle}>Saved team links</h2>
          </div>
          {activeConnections.length ? (
            <div style={cardGridStyle}>
              {activeConnections.map((connection) => (
                <ConnectionCard key={connection.id} connection={connection}>
                  {connection.status === 'accepted' ? (
                    <>
                      <Link href={buildTeamRoomHref({
                        teamName: connection.teamName,
                        leagueName: connection.leagueName,
                        flight: connection.flight,
                      })} style={primaryLinkStyle}>
                        Open Team Room
                      </Link>
                      <Link href={buildTeamConnectionWorkspaceHref(connection)} style={primaryLinkStyle}>
                        {isCaptainTeamConnection(connection.roles) ? 'Open Captain' : 'Open My Lab'}
                      </Link>
                      {!connection.isDefault ? (
                        <button type="button" onClick={() => void act(connection, 'set_default')} disabled={Boolean(workingId)} style={secondaryButtonStyle}>
                          {workingId === connection.id ? 'Saving' : 'Make default'}
                        </button>
                      ) : null}
                      <button type="button" onClick={() => void act(connection, 'unlink')} disabled={Boolean(workingId)} style={secondaryButtonStyle}>
                        {workingId === connection.id ? 'Saving' : 'Unlink'}
                      </button>
                      {connection.declinedRoles.length ? (
                        <button type="button" onClick={() => void act(connection, 'restore_roles')} disabled={Boolean(workingId)} style={secondaryButtonStyle}>
                          {workingId === connection.id ? 'Saving' : `Add ${getTeamConnectionRolesLabel(connection.declinedRoles)}`}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <button type="button" onClick={() => void act(connection, 'relink')} disabled={Boolean(workingId)} style={primaryButtonStyle}>
                      {workingId === connection.id ? 'Saving' : 'Link again'}
                    </button>
                  )}
                </ConnectionCard>
              ))}
            </div>
          ) : !pending.length && !loading ? (
            <div style={emptyStyle}>
              <strong>No team links yet.</strong>
              <span>To find an imported team, use the same email that appears on its Player Roster, or link your player profile first.</span>
              <div style={cardActionsStyle}>
                <Link href="/profile#profile-identity" style={primaryLinkStyle}>Find my player</Link>
                <Link href="/data-assist?intent=upload-source&context=Team%20Hub#upload" style={secondaryLinkStyle}>Upload roster</Link>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {userId && archivedConnections.length ? (
        <section style={sectionStyle} aria-label="Past team seasons">
          <div style={sectionHeaderStyle}>
            <span style={eyebrowStyle}>Season history</span>
            <h2 style={sectionTitleStyle}>Past teams</h2>
          </div>
          <div style={cardGridStyle}>
            {archivedConnections.map((connection) => (
              <ConnectionCard key={connection.id} connection={connection}>
                <Link href={buildTeamRoomHref({ teamName: connection.teamName, leagueName: connection.leagueName, flight: connection.flight })} style={secondaryLinkStyle}>Open history</Link>
              </ConnectionCard>
            ))}
          </div>
        </section>
      ) : null}

      {acceptedCaptainLinks.length > 0 && !access.canUseCaptainWorkflow ? (
        <section style={offerStyle} className="team-connections-offer" aria-label="Captain tools recommendation">
          <div style={copyBlockStyle}>
            <span style={eyebrowStyle}>Captain tools</span>
            <strong style={panelTitleStyle}>Your team is linked. Put the captain workflow around it.</strong>
            <span style={copyStyle}>Manage availability, build projected lineups, confirm players, and send the match plan from one team context.</span>
          </div>
          <Link href="/upgrade?plan=captain&next=%2Fcaptain&source=team_connection" style={primaryLinkStyle}>
            {offers.captain.available && offers.captain.label ? offers.captain.label : 'Try Captain'}
          </Link>
        </section>
      ) : null}
      {!acceptedCaptainLinks.length && acceptedPlayerLinks.length > 0 && !access.canUseAdvancedPlayerInsights ? (
        <section style={offerStyle} className="team-connections-offer" aria-label="Improve recommendation">
          <div style={copyBlockStyle}>
            <span style={eyebrowStyle}>Improve</span>
            <strong style={panelTitleStyle}>Your team is linked. Make the player experience yours.</strong>
            <span style={copyStyle}>Open My Lab, prepare for matchups, and keep your tennis context connected in one place.</span>
          </div>
          <Link href="/upgrade?plan=player_plus&next=%2Fmylab&source=team_connection" style={primaryLinkStyle}>
            {offers.player.available && offers.player.label ? offers.player.label : 'Try Player'}
          </Link>
        </section>
      ) : null}
      <style jsx>{`
        @media (max-width: 680px) {
          :global(.team-connection-card),
          .team-connection-completion,
          .team-connections-offer {
            align-items: stretch !important;
            grid-template-columns: minmax(0, 1fr) !important;
          }
          :global(.team-connection-card-actions) {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          :global(.team-connection-card-actions > *) {
            width: 100% !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </main>
  )
}

function buildTeamConnectionWorkspaceHref(connection: TeamConnection) {
  if (!isCaptainTeamConnection(connection.roles)) return '/mylab'
  return buildCaptainScopedHref('/captain', {
    team: connection.teamName,
    league: connection.leagueName,
    flight: connection.flight,
  })
}

function ConnectionCard({ connection, children, highlighted = false }: { connection: TeamConnection; children: ReactNode; highlighted?: boolean }) {
  return (
    <article style={highlighted ? { ...cardStyle, ...highlightedCardStyle } : cardStyle} className="team-connection-card" data-highlighted={highlighted || undefined}>
      <div style={copyBlockStyle}>
        <span style={statusStyle}>{connection.archivedAt ? 'Season complete' : connection.isDefault ? 'Default team' : connection.isRoleUpdate ? 'Role update' : connection.status === 'pending' ? 'New' : connection.status}</span>
        <strong style={cardTitleStyle}>{connection.teamName}</strong>
        <span style={metaStyle}>{getTeamConnectionRolesLabel(connection.roles)}</span>
        <span style={copyStyle}>{[connection.leagueName, connection.flight].filter(Boolean).join(' · ') || 'Team membership'}</span>
        <span style={healthStyle}>{getTeamConnectionSourceLabel(connection.sourceType)} · Updated {formatConnectionDate(connection.updatedAt)}</span>
      </div>
      <div style={cardActionsStyle} className="team-connection-card-actions">{children}</div>
    </article>
  )
}

function matchesRequestedTeamScope(connection: TeamConnection, requestedScope: { teamName: string; leagueName: string; flight: string }) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!requestedScope.teamName || normalize(connection.teamName) !== normalize(requestedScope.teamName)) return false
  if (requestedScope.leagueName && normalize(connection.leagueName) !== normalize(requestedScope.leagueName)) return false
  return !requestedScope.flight || normalize(connection.flight) === normalize(requestedScope.flight)
}

function formatConnectionDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'recently'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

const pageStyle: CSSProperties = { position: 'relative', zIndex: 2, width: 'min(980px, calc(100% - clamp(24px, 5vw, 40px)))', margin: '0 auto', padding: 'clamp(28px, 5vw, 64px) 0 80px', color: '#fff' }
const heroStyle: CSSProperties = { display: 'grid', gap: 12, marginBottom: 26, padding: 'clamp(22px, 4vw, 34px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, background: 'rgba(7,18,38,.86)' }
const eyebrowStyle: CSSProperties = { color: '#9be11d', fontSize: 11, fontWeight: 950, letterSpacing: '.12em', textTransform: 'uppercase' }
const titleStyle: CSSProperties = { margin: 0, maxWidth: 760, fontSize: 'clamp(30px, 6vw, 54px)', lineHeight: 1, letterSpacing: '-.035em' }
const copyStyle: CSSProperties = { margin: 0, color: '#bdcce0', fontSize: 14, lineHeight: 1.55, fontWeight: 720 }
const sectionStyle: CSSProperties = { display: 'grid', gap: 14, marginTop: 28 }
const sectionHeaderStyle: CSSProperties = { display: 'grid', gap: 5 }
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 24, lineHeight: 1.1 }
const cardGridStyle: CSSProperties = { display: 'grid', gap: 12 }
const cardStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 18, minWidth: 0, padding: 18, border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, background: 'rgba(9,24,45,.9)' }
const highlightedCardStyle: CSSProperties = { borderColor: 'rgba(155,225,29,.62)', background: 'linear-gradient(135deg, rgba(155,225,29,.12), rgba(9,24,45,.94))', boxShadow: '0 0 0 2px rgba(155,225,29,.08)' }
const copyBlockStyle: CSSProperties = { display: 'grid', gap: 6, minWidth: 0 }
const cardTitleStyle: CSSProperties = { fontSize: 20, lineHeight: 1.15, overflowWrap: 'anywhere' }
const metaStyle: CSSProperties = { color: '#fff', fontSize: 13, fontWeight: 900, textTransform: 'capitalize' }
const statusStyle: CSSProperties = { width: 'fit-content', borderRadius: 999, background: 'rgba(155,225,29,.12)', color: '#bff36b', padding: '4px 8px', fontSize: 10, fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase' }
const cardActionsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 999, background: '#9be11d', color: '#071226', padding: '11px 16px', fontWeight: 950, cursor: 'pointer' }
const secondaryButtonStyle: CSSProperties = { border: '1px solid rgba(255,255,255,.18)', borderRadius: 999, background: 'rgba(255,255,255,.05)', color: '#fff', padding: '10px 15px', fontWeight: 900, cursor: 'pointer' }
const primaryLinkStyle: CSSProperties = { ...primaryButtonStyle, display: 'inline-flex', width: 'fit-content', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }
const secondaryLinkStyle: CSSProperties = { ...secondaryButtonStyle, display: 'inline-flex', width: 'fit-content', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }
const healthStyle: CSSProperties = { color: '#8298b5', fontSize: 12, fontWeight: 750 }
const noticeStyle: CSSProperties = { padding: 14, border: '1px solid rgba(155,225,29,.2)', borderRadius: 16, background: 'rgba(7,18,38,.86)', color: '#d5e2f1', fontWeight: 780 }
const emptyStyle: CSSProperties = { display: 'grid', gap: 6, padding: 20, border: '1px dashed rgba(255,255,255,.16)', borderRadius: 18, color: '#bdcce0' }
const panelStyle: CSSProperties = { display: 'grid', gap: 14, padding: 22, border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, background: 'rgba(7,18,38,.86)' }
const panelTitleStyle: CSSProperties = { color: '#fff', fontSize: 20, lineHeight: 1.2 }
const offerStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 20, marginTop: 30, padding: 22, border: '1px solid rgba(155,225,29,.3)', borderRadius: 22, background: 'linear-gradient(135deg, rgba(21,50,39,.94), rgba(8,27,48,.94))' }
const completionStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 18, padding: 20, borderRadius: 22, border: '1px solid rgba(155,225,29,.52)', background: 'linear-gradient(135deg, rgba(75,120,27,.28), rgba(9,24,45,.95))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)' }
