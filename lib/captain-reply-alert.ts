export const CAPTAIN_AVAILABILITY_REPLY_NOTICE = 'captain-availability-reply'

export type CaptainReplyNotificationLike = {
  id: string
  title: string
  body: string
  href: string
  createdAt: string
}

export type CaptainReplyAlert = {
  id: string
  href: string
  playerName: string
  status: 'available' | 'maybe' | 'unavailable'
  statusLabel: 'In' | 'Maybe' | 'Out'
  teamName: string
  leagueName: string
  flight: string
  matchDate: string
  opponentTeam: string
  createdAt: string
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeReplyStatus(value: string | null | undefined): CaptainReplyAlert['status'] | '' {
  const status = cleanText(value).toLowerCase()
  if (status === 'available' || status === 'yes' || status === 'in') return 'available'
  if (status === 'maybe' || status === 'limited') return 'maybe'
  if (status === 'unavailable' || status === 'no' || status === 'out') return 'unavailable'
  return ''
}

function getStatusLabel(status: CaptainReplyAlert['status']): CaptainReplyAlert['statusLabel'] {
  if (status === 'available') return 'In'
  if (status === 'maybe') return 'Maybe'
  return 'Out'
}

function normalizePlayerName(value: string | null | undefined) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function buildCaptainReplyNotification(input: {
  playerName: string
  status: string
  teamName: string
  leagueName?: string
  flight?: string
  matchDate: string
  opponentTeam?: string
  teamRoomMessageId?: string
  availabilityRequestId?: string
  courtLabel?: string
}) {
  const status = normalizeReplyStatus(input.status) || 'maybe'
  const statusLabel = getStatusLabel(status)
  const playerName = cleanText(input.playerName)
  const matchDate = cleanText(input.matchDate).slice(0, 10)
  const opponentTeam = cleanText(input.opponentTeam)
  const teamRoomMessageId = cleanText(input.teamRoomMessageId)
  const courtLabel = cleanText(input.courtLabel)
  const query = new URLSearchParams({
    notice: CAPTAIN_AVAILABILITY_REPLY_NOTICE,
    team: cleanText(input.teamName),
    league: cleanText(input.leagueName),
    flight: cleanText(input.flight),
    date: matchDate,
    opponent: opponentTeam,
    player: playerName,
    status,
  })
  if (teamRoomMessageId) query.set('message', teamRoomMessageId)
  if (cleanText(input.availabilityRequestId)) query.set('availabilityRequest', cleanText(input.availabilityRequestId))
  if (courtLabel) query.set('court', courtLabel)

  const destination = teamRoomMessageId
    ? `/team-room?${query.toString()}#match-card-${encodeURIComponent(teamRoomMessageId)}`
    : `/captain?${query.toString()}#captain-reply-alert`

  return {
    title: `${playerName || 'Player'} replied ${statusLabel}`,
    body: courtLabel
      ? `${courtLabel}${opponentTeam ? ` vs ${opponentTeam}` : ''}. ${status === 'available' ? 'Availability updated.' : 'Review this court.'}`
      : `${matchDate}${opponentTeam ? ` vs ${opponentTeam}` : ''}. Review availability before setting the lineup.`,
    href: destination,
  }
}

export function findCaptainReplyCourt(slots: unknown, player: { playerId?: string | null; playerName: string }) {
  if (!Array.isArray(slots)) return ''
  const playerId = cleanText(player.playerId).toLowerCase()
  const playerName = normalizePlayerName(player.playerName)

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) continue
    const row = slot as Record<string, unknown>
    const players = Array.isArray(row.players) ? row.players : []
    const matches = players.some((entry) => {
      if (typeof entry === 'string') return normalizePlayerName(entry) === playerName
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
      const rosterPlayer = entry as Record<string, unknown>
      const rosterPlayerId = cleanText(typeof rosterPlayer.playerId === 'string' ? rosterPlayer.playerId : '').toLowerCase()
      const rosterPlayerName = normalizePlayerName(
        typeof rosterPlayer.playerName === 'string'
          ? rosterPlayer.playerName
          : typeof rosterPlayer.name === 'string' ? rosterPlayer.name : ''
      )
      return Boolean((playerId && rosterPlayerId === playerId) || (playerName && rosterPlayerName === playerName))
    })
    if (matches) {
      const label = typeof row.label === 'string'
        ? row.label
        : typeof row.courtLabel === 'string' ? row.courtLabel : ''
      return cleanText(label) || `Court ${index + 1}`
    }
  }
  return ''
}

export function parseCaptainReplyAlert(notification: CaptainReplyNotificationLike): CaptainReplyAlert | null {
  let url: URL
  try {
    url = new URL(notification.href, 'https://tenaceiq.local')
  } catch {
    return null
  }

  const isCurrentNotice = url.searchParams.get('notice') === CAPTAIN_AVAILABILITY_REPLY_NOTICE
  const isLegacyNotice = notification.title === 'Availability updated'
  if (!isCurrentNotice && !isLegacyNotice) return null

  const legacyMatch = notification.body.match(/^(.+?):\s*(Yes|Maybe|No)\s+for\s+(\d{4}-\d{2}-\d{2})\.?$/i)
  const status = normalizeReplyStatus(url.searchParams.get('status') || legacyMatch?.[2])
  const playerName = cleanText(url.searchParams.get('player') || legacyMatch?.[1])
  const matchDate = cleanText(url.searchParams.get('date') || legacyMatch?.[3]).slice(0, 10)
  const teamName = cleanText(url.searchParams.get('team'))
  if (!status || !playerName || !matchDate || !teamName) return null

  return {
    id: notification.id,
    href: notification.href,
    playerName,
    status,
    statusLabel: getStatusLabel(status),
    teamName,
    leagueName: cleanText(url.searchParams.get('league')),
    flight: cleanText(url.searchParams.get('flight')),
    matchDate,
    opponentTeam: cleanText(url.searchParams.get('opponent')),
    createdAt: notification.createdAt,
  }
}

export function selectCaptainReplyAlerts(
  notifications: CaptainReplyNotificationLike[],
  scope: { teamName: string; matchDate?: string | null },
) {
  const teamName = cleanText(scope.teamName).toLowerCase()
  const matchDate = cleanText(scope.matchDate).slice(0, 10)

  return notifications
    .map(parseCaptainReplyAlert)
    .filter((alert): alert is CaptainReplyAlert => Boolean(
      alert
      && alert.teamName.toLowerCase() === teamName
      && (!matchDate || alert.matchDate === matchDate),
    ))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}
