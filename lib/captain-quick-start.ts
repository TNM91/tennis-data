import { buildCaptainScopedHref } from './captain-memory'
import type { TeamConnection } from './team-profile-links'
import { buildTeamProfileHref } from './team-routes'

export const CAPTAIN_QUICK_START_HREF = '/compete/teams#captain-setup'
export type CaptainQuickStartEvidence = {
  teammateConnected: boolean
  lineupSaved: boolean
  lineupSent: boolean
  match: { date: string; opponent: string; scenarioId?: string }
}

export function hasCompleteSavedLineup(value: unknown): boolean {
  if (!Array.isArray(value) || !value.length) return false
  const ids = new Set<string>()
  return value.every((slot) => {
    if (!slot || !Array.isArray(slot.players)) return false
    const expectedPlayers = slot.slotType === 'singles' ? 1 : slot.slotType === 'doubles' ? 2 : 0
    if (!expectedPlayers || slot.players.length !== expectedPlayers) return false
    return slot.players.every((player: { playerId?: unknown; playerName?: unknown }) => {
      const id = typeof player?.playerId === 'string' ? player.playerId.trim() : ''
      const name = typeof player?.playerName === 'string' ? player.playerName.trim() : ''
      if (!id || !name || ids.has(id)) return false
      ids.add(id)
      return true
    })
  })
}

export function getCaptainQuickStartSteps(connection?: TeamConnection, evidence?: CaptainQuickStartEvidence | null) {
  const linked = connection?.status === 'accepted' && !connection.archivedAt
  const added = Boolean(connection && !connection.archivedAt && ['accepted', 'pending'].includes(connection.status))
  const scope = linked ? {
    team: connection.teamName, league: connection.leagueName, flight: connection.flight,
    competitionLayer: connection.sourceType === 'tiq_entry' ? 'tiq' : 'usta',
    ...evidence?.match,
  } : {}
  const captainHref = (path: string) => linked ? buildCaptainScopedHref(path, scope) : '/team-connections'
  return [
    { id: 'add', title: 'Add your team', complete: added, detail: added ? 'Your team is in TiQ. Open its roster and schedule, or review your team link next.' : 'Import a TennisLink Team Summary, or enter a team in a TIQ league.', action: added ? 'Open roster & schedule' : 'Import Team Summary', href: added && connection ? buildTeamProfileHref(connection.teamName, { layer: connection.sourceType === 'tiq_entry' ? 'tiq' : 'usta', league: connection.leagueName, flight: connection.flight }) : '/data-assist?intent=upload-source&type=team_summary&context=Add%20my%20team&returnTo=%2Fcompete%2Fteams%23captain-setup#upload' },
    { id: 'link', title: 'Confirm your team link', complete: Boolean(linked), detail: 'Choose Link team for your own team. Uploading an opponent does not make it yours.', action: 'Review team links', href: '/team-connections' },
    { id: 'invite', title: 'Invite players to connect', complete: Boolean(linked && evidence?.teammateConnected), detail: 'Open Team Chat, choose Share room, and send the invite. Complete when another player connects.', action: 'Open Team Chat', href: captainHref('/team-room') },
    { id: 'lineup', title: 'Build your first lineup', complete: Boolean(linked && evidence?.lineupSaved), detail: 'Choose your match, fill every court, then save a lineup version. Your device draft still autosaves.', action: 'Build lineup', href: captainHref('/captain/lineup-builder') },
    { id: 'share', title: 'Share the lineup & print', complete: Boolean(linked && evidence?.lineupSent), detail: 'Confirm your players and send the final lineup to Team Chat. Then share its image or print the scorecard whenever you need it.', action: evidence?.lineupSent ? 'Open share / print' : 'Review & send lineup', href: evidence?.lineupSent && linked ? `${captainHref('/captain/matchup-sheet')}&confirmed=1` : captainHref('/captain/lineup-builder') },
  ]
}
