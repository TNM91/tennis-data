'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import { buildTeamRoomHref } from '@/lib/team-room'
import {
  getTeamConnectionRolesLabel,
  isCaptainTeamConnection,
  type TeamConnection,
} from '@/lib/team-profile-links'
import {
  fetchTeamConnections,
  updateTeamConnection,
  type TeamInviteOffers,
} from '@/lib/team-profile-links-client'

const HIDDEN_ROUTE_PREFIXES = ['/login', '/join', '/forget-password', '/reset-password', '/upgrade', '/team-connections']

export default function TeamConnectionInvite() {
  const pathname = usePathname() || '/'
  const { authResolved, entitlements, role, session, userId } = useAuth()
  const [pending, setPending] = useState<TeamConnection[]>([])
  const [accepted, setAccepted] = useState<TeamConnection | null>(null)
  const [offers, setOffers] = useState<TeamInviteOffers>({
    captain: { available: false, label: '' },
    player: { available: false, label: '' },
  })
  const [loadingAction, setLoadingAction] = useState(false)
  const [message, setMessage] = useState('')
  const access = useMemo(() => buildProductAccessState(userId ? role : 'public', entitlements), [entitlements, role, userId])
  const accessToken = session?.access_token || ''

  useEffect(() => {
    if (!authResolved || !userId || !accessToken || HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      setPending([])
      return
    }

    let active = true
    void fetchTeamConnections(accessToken)
      .then((result) => {
        if (!active) return
        setPending(result.pending)
        setOffers(result.offers)
      })
      .catch(() => {
        if (active) setPending([])
      })

    return () => {
      active = false
    }
  }, [accessToken, authResolved, pathname, userId])

  const invitation = pending[0] || null
  if (!invitation && !accepted) return null

  async function act(action: 'accept' | 'decline') {
    if (!invitation || !accessToken || loadingAction) return
    setLoadingAction(true)
    setMessage('')
    try {
      const connection = await updateTeamConnection({
        accessToken,
        connectionId: invitation.id,
        action,
      })
      setPending((current) => current.filter((item) => item.id !== invitation.id))
      if (action === 'accept' && connection) {
        setAccepted(connection)
        const refreshed = await fetchTeamConnections(accessToken).catch(() => null)
        if (refreshed) setOffers(refreshed.offers)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Team connection could not be updated.')
    } finally {
      setLoadingAction(false)
    }
  }

  const activeConnection = accepted || invitation
  const roleLabel = getTeamConnectionRolesLabel(activeConnection.roles)
  const isCaptainConnection = isCaptainTeamConnection(activeConnection.roles)
  const tierHref = isCaptainConnection
    ? '/upgrade?plan=captain&next=%2Fcaptain&source=team_connection'
    : '/upgrade?plan=player_plus&next=%2Fmylab&source=team_connection'
  const hasRecommendedAccess = isCaptainConnection ? access.canUseCaptainWorkflow : access.canUseAdvancedPlayerInsights
  const captainHref = buildCaptainScopedHref('/captain', {
    competitionLayer: activeConnection.sourceType === 'tiq_entry' ? 'tiq' : 'usta',
    team: activeConnection.teamName,
    league: activeConnection.leagueName,
    flight: activeConnection.flight,
  })
  const alreadyAtDestination = isCaptainConnection ? pathname.startsWith('/captain') : pathname.startsWith('/mylab')
  const teamRoomHref = buildTeamRoomHref({
    teamName: activeConnection.teamName,
    leagueName: activeConnection.leagueName,
    flight: activeConnection.flight,
  })
  const openHref = isCaptainConnection
    ? alreadyAtDestination ? teamRoomHref : `${captainHref}#captain-team-scope`
    : '/mylab'
  const openLabel = alreadyAtDestination
    ? isCaptainConnection ? 'Open Team Chat' : 'Continue with team'
    : isCaptainConnection ? 'Open Captain' : 'Open My Lab'
  const tierLabel = isCaptainConnection
    ? offers.captain.available && offers.captain.label
      ? offers.captain.label
      : 'Try Captain'
    : offers.player.available && offers.player.label
      ? offers.player.label
      : 'Try Player'

  return (
    <section style={bannerWrapStyle} aria-label={accepted ? 'Team connected' : 'Team connection invitation'}>
      <div style={bannerStyle} className={`team-connection-invite-banner${accepted ? ' is-accepted' : ''}`}>
        <div style={copyStyle}>
          <span style={eyebrowStyle}>{accepted ? 'Team connected' : activeConnection.isRoleUpdate ? 'Team role update' : 'Team invitation'}</span>
          <strong style={titleStyle}>
            {accepted
              ? `${activeConnection.teamName} is linked to your profile.`
              : activeConnection.isRoleUpdate
                ? `We found another role for you on ${activeConnection.teamName}.`
                : `You were added to ${activeConnection.teamName} as ${roleLabel}.`}
          </strong>
          <span style={bodyStyle} className="team-connection-invite-body">
            {accepted
              ? hasRecommendedAccess
                ? `Your ${roleLabel} tools now open with this team context.`
                : `The team link is free. Unlock the ${isCaptainConnection ? 'Captain' : 'Player'} tools when you want the connected workflow.`
              : activeConnection.isRoleUpdate
                ? `${formatTeamContext(activeConnection)} Link your roles as ${roleLabel}? Your existing team link stays in place.`
                : `${formatTeamContext(activeConnection)} Link this team to your profile? You can unlink it later.`}
          </span>
          {message ? <span style={errorStyle}>{message}</span> : null}
        </div>

        <div style={actionsStyle} className="team-connection-invite-actions">
          {accepted ? (
            <>
              <Link
                href={hasRecommendedAccess ? openHref : tierHref}
                onClick={() => setAccepted(null)}
                style={primaryLinkStyle}
              >
                {hasRecommendedAccess ? openLabel : tierLabel}
              </Link>
              <button type="button" onClick={() => setAccepted(null)} style={textButtonStyle}>Done</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => void act('accept')} disabled={loadingAction} style={primaryButtonStyle}>
                {loadingAction ? 'Linking' : activeConnection.isRoleUpdate ? 'Link both roles' : 'Link team'}
              </button>
              <button type="button" onClick={() => void act('decline')} disabled={loadingAction} style={secondaryButtonStyle}>
                {activeConnection.isRoleUpdate ? 'Not this role' : 'Not mine'}
              </button>
              <Link href="/team-connections" style={textLinkStyle}>Review all</Link>
            </>
          )}
        </div>
      </div>
      <style jsx>{`
        @media (max-width: 720px) {
          .team-connection-invite-banner.is-accepted {
            gap: 10px !important;
            padding: 12px !important;
            border-radius: 16px !important;
          }
          .team-connection-invite-banner.is-accepted .team-connection-invite-body {
            display: none !important;
          }
          .team-connection-invite-banner {
            align-items: stretch !important;
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .team-connection-invite-actions {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .team-connection-invite-banner:not(.is-accepted) .team-connection-invite-actions > :last-child {
            grid-column: 1 / -1;
            text-align: center !important;
          }
        }
      `}</style>
    </section>
  )
}

function formatTeamContext(connection: TeamConnection) {
  const details = [connection.leagueName, connection.flight].filter(Boolean).join(' · ')
  return details ? `${details}.` : ''
}

const bannerWrapStyle: CSSProperties = {
  position: 'relative',
  zIndex: 18,
  width: 'min(1180px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '12px auto 0',
}

const bannerStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 18,
  minWidth: 0,
  padding: '16px clamp(16px, 3vw, 24px)',
  border: '1px solid rgba(155, 225, 29, 0.34)',
  borderRadius: 20,
  background: 'linear-gradient(135deg, rgba(10, 28, 50, 0.98), rgba(13, 39, 43, 0.98))',
  boxShadow: '0 18px 44px rgba(0, 0, 0, 0.24)',
  color: '#ffffff',
}

const copyStyle: CSSProperties = { display: 'grid', gap: 5, minWidth: 0 }
const eyebrowStyle: CSSProperties = { color: '#9be11d', fontSize: 11, fontWeight: 950, letterSpacing: '.12em', textTransform: 'uppercase' }
const titleStyle: CSSProperties = { fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.15, overflowWrap: 'anywhere' }
const bodyStyle: CSSProperties = { color: '#c6d4e5', fontSize: 14, lineHeight: 1.45, fontWeight: 720, overflowWrap: 'anywhere' }
const errorStyle: CSSProperties = { color: '#ffbd9d', fontSize: 13, fontWeight: 800 }
const actionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 9 }
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 999, background: '#9be11d', color: '#071226', padding: '11px 16px', fontWeight: 950, cursor: 'pointer' }
const secondaryButtonStyle: CSSProperties = { border: '1px solid rgba(255,255,255,.2)', borderRadius: 999, background: 'rgba(255,255,255,.06)', color: '#fff', padding: '10px 15px', fontWeight: 900, cursor: 'pointer' }
const textButtonStyle: CSSProperties = { border: 0, background: 'transparent', color: '#c6d4e5', padding: '8px 4px', fontWeight: 850, cursor: 'pointer' }
const primaryLinkStyle: CSSProperties = { ...primaryButtonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }
const textLinkStyle: CSSProperties = { color: '#c6d4e5', padding: '8px 4px', fontSize: 13, fontWeight: 850, textDecoration: 'none' }
