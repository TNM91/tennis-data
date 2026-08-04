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

export function buildCaptainReplyNotification(input: {
  playerName: string
  status: string
  teamName: string
  leagueName?: string
  flight?: string
  matchDate: string
  opponentTeam?: string
}) {
  const status = normalizeReplyStatus(input.status) || 'maybe'
  const statusLabel = getStatusLabel(status)
  const query = new URLSearchParams({
    notice: CAPTAIN_AVAILABILITY_REPLY_NOTICE,
    team: cleanText(input.teamName),
    league: cleanText(input.leagueName),
    flight: cleanText(input.flight),
    date: cleanText(input.matchDate).slice(0, 10),
    opponent: cleanText(input.opponentTeam),
    player: cleanText(input.playerName),
    status,
  })

  return {
    title: `${cleanText(input.playerName) || 'Player'} replied ${statusLabel}`,
    body: `${cleanText(input.matchDate).slice(0, 10)}${cleanText(input.opponentTeam) ? ` vs ${cleanText(input.opponentTeam)}` : ''}. Review availability before setting the lineup.`,
    href: `/captain?${query.toString()}#captain-reply-alert`,
  }
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
