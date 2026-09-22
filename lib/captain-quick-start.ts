import { buildCaptainScopedHref } from './captain-memory'
import type { TeamConnection } from './team-profile-links'
import { buildTeamProfileHref } from './team-routes'

export const CAPTAIN_QUICK_START_HREF = '/compete/teams#captain-setup'
export const CAPTAIN_PILOT_FIRST_WIN_HREF = '/compete/teams?source=captain-pilot#captain-setup'
export type CaptainQuickStartEvidence = {
  teammateConnected: boolean
  availabilityRequested: boolean
  lineupSaved: boolean
  lineupSent: boolean
  match: { date: string; opponent: string; scenarioId?: string }
}

export type CaptainFirstWinPlan = {
  stage: 'connect' | 'link' | 'start' | 'replies' | 'share' | 'complete'
  completeCount: number
  title: string
  detail: string
  primary: { label: string; href: string; event: 'availability_clicked' | 'lineup_preview_clicked' | null }
  secondary?: { label: string; href: string; event: 'availability_clicked' | 'lineup_preview_clicked' | null }
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
    { id: 'share', title: 'Share the lineup & print', complete: Boolean(linked && evidence?.lineupSent), detail: 'Confirm your players, then post the final lineup in Team Chat, copy it for your group text, or use both. The lineup image and scorecard stay ready when you need them.', action: evidence?.lineupSent ? 'Open share / print' : 'Share final lineup', href: evidence?.lineupSent && linked ? `${captainHref('/captain/matchup-sheet')}&confirmed=1` : captainHref('/captain/lineup-builder') },
  ]
}

export function getCaptainFirstWinPlan(
  connection?: TeamConnection,
  evidence?: CaptainQuickStartEvidence | null,
): CaptainFirstWinPlan {
  if (!connection || connection.archivedAt) {
    return {
      stage: 'connect',
      completeCount: 0,
      title: 'Connect your team.',
      detail: 'Import a TennisLink Team Summary or enter a TiQ team. Your roster and schedule will come with it.',
      primary: {
        label: 'Import TennisLink team',
        href: `/data-assist?intent=upload-source&type=team_summary&context=Add%20my%20team&returnTo=${encodeURIComponent(CAPTAIN_PILOT_FIRST_WIN_HREF)}#upload`,
        event: null,
      },
      secondary: { label: 'Enter TiQ team', href: '/explore/leagues?layer=tiq', event: null },
    }
  }

  if (connection.status !== 'accepted') {
    return {
      stage: 'link',
      completeCount: 0,
      title: `Finish linking ${connection.teamName}.`,
      detail: 'Confirm this is your team. Opponent uploads stay separate and will not become your team.',
      primary: { label: 'Review team link', href: '/team-connections', event: null },
    }
  }

  const scope = {
    team: connection.teamName,
    league: connection.leagueName,
    flight: connection.flight,
    competitionLayer: connection.sourceType === 'tiq_entry' ? 'tiq' : 'usta',
    ...evidence?.match,
  }
  const availabilityHref = buildCaptainScopedHref('/captain/availability', scope)
  const lineupHref = buildCaptainScopedHref('/captain/lineup-builder', scope)

  if (evidence?.lineupSent) {
    return {
      stage: 'complete',
      completeCount: 3,
      title: 'Your first match plan is out.',
      detail: 'The team has the lineup. You can reopen it anytime for the image, group text, or scorecard.',
      primary: { label: 'View sent lineup', href: lineupHref, event: 'lineup_preview_clicked' },
      secondary: { label: 'Open Team Chat', href: buildCaptainScopedHref('/team-room', scope), event: null },
    }
  }

  if (evidence?.lineupSaved) {
    return {
      stage: 'share',
      completeCount: 2,
      title: 'Share your first lineup.',
      detail: 'Your courts are saved. Review the players, then post to Team Chat or copy the polished group text.',
      primary: { label: 'Review & share lineup', href: lineupHref, event: 'lineup_preview_clicked' },
      secondary: { label: 'Check availability', href: availabilityHref, event: 'availability_clicked' },
    }
  }

  if (evidence?.availabilityRequested) {
    return {
      stage: 'replies',
      completeCount: 2,
      title: 'Your availability request is out.',
      detail: 'Check replies as they arrive, or start placing the players who are ready into courts.',
      primary: { label: 'Review replies', href: availabilityHref, event: 'availability_clicked' },
      secondary: { label: 'Build lineup', href: lineupHref, event: 'lineup_preview_clicked' },
    }
  }

  return {
    stage: 'start',
    completeCount: 1,
    title: 'Start your first match week.',
    detail: 'Ask who can play, or jump straight into a lineup if you already know. Either path saves your progress.',
    primary: { label: 'Ask availability', href: availabilityHref, event: 'availability_clicked' },
    secondary: { label: 'Build lineup instead', href: lineupHref, event: 'lineup_preview_clicked' },
  }
}
