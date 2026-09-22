export type CaptainLineupDraftSummary = {
  competitionLayer: string
  teamName: string
  leagueName: string
  flight: string
  matchDate: string
  opponentTeam: string
  assignedPlayers: number
  requiredPlayers: number
  completedCourts: number
  totalCourts: number
  status: 'working' | 'final'
  deliveryStatus: 'not_sent' | 'sent'
  deliveredAt: string
  updatedAt: string
}

type CaptainLineupDraftSummaryRow = {
  competition_layer?: unknown
  team_name?: unknown
  league_name?: unknown
  flight?: unknown
  match_date?: unknown
  opponent_team?: unknown
  slots_json?: unknown
  status?: unknown
  delivery_status?: unknown
  delivered_at?: unknown
  updated_at?: unknown
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTeamText(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function countCourtProgress(slots: unknown) {
  if (!Array.isArray(slots)) {
    return { assignedPlayers: 0, requiredPlayers: 0, completedCourts: 0, totalCourts: 0 }
  }

  return slots.reduce((progress, rawSlot) => {
    if (!rawSlot || typeof rawSlot !== 'object') return progress
    const players = Array.isArray((rawSlot as { players?: unknown }).players)
      ? (rawSlot as { players: unknown[] }).players
      : []
    if (!players.length) return progress

    const assigned = players.filter((rawPlayer) => {
      if (!rawPlayer || typeof rawPlayer !== 'object') return false
      const player = rawPlayer as { playerId?: unknown; playerName?: unknown }
      return Boolean(cleanText(player.playerId) || cleanText(player.playerName))
    }).length

    return {
      assignedPlayers: progress.assignedPlayers + assigned,
      requiredPlayers: progress.requiredPlayers + players.length,
      completedCourts: progress.completedCourts + (assigned === players.length ? 1 : 0),
      totalCourts: progress.totalCourts + 1,
    }
  }, { assignedPlayers: 0, requiredPlayers: 0, completedCourts: 0, totalCourts: 0 })
}

export function summarizeCaptainLineupDraft(
  row: CaptainLineupDraftSummaryRow,
): CaptainLineupDraftSummary | null {
  const teamName = cleanText(row.team_name)
  const progress = countCourtProgress(row.slots_json)
  if (!teamName || progress.assignedPlayers === 0) return null

  const complete = progress.requiredPlayers > 0 && progress.assignedPlayers === progress.requiredPlayers
  return {
    competitionLayer: cleanText(row.competition_layer) || 'usta',
    teamName,
    leagueName: cleanText(row.league_name),
    flight: cleanText(row.flight),
    matchDate: cleanText(row.match_date).slice(0, 10),
    opponentTeam: cleanText(row.opponent_team),
    ...progress,
    status: row.status === 'final' && complete ? 'final' : 'working',
    deliveryStatus: row.delivery_status === 'sent' && complete ? 'sent' : 'not_sent',
    deliveredAt: cleanText(row.delivered_at),
    updatedAt: cleanText(row.updated_at),
  }
}

export function isCaptainLineupSummaryCurrent(summary: CaptainLineupDraftSummary, today: string) {
  return !summary.matchDate || !/^\d{4}-\d{2}-\d{2}$/.test(today) || summary.matchDate >= today
}

export function selectCaptainLineupSummaryForTeam(input: {
  summaries: CaptainLineupDraftSummary[]
  teamName: string
  leagueName?: string | null
  flight?: string | null
  nextMatch?: { date: string; opponent: string } | null
}) {
  const matching = input.summaries.filter((summary) => {
    if (normalizeTeamText(summary.teamName) !== normalizeTeamText(input.teamName)) return false
    if (input.leagueName && summary.leagueName && normalizeTeamText(summary.leagueName) !== normalizeTeamText(input.leagueName)) return false
    if (input.flight && summary.flight && normalizeTeamText(summary.flight) !== normalizeTeamText(input.flight)) return false
    return true
  })

  return matching.sort((left, right) => {
    const leftExact = Boolean(input.nextMatch && left.matchDate === input.nextMatch.date && normalizeTeamText(left.opponentTeam) === normalizeTeamText(input.nextMatch.opponent))
    const rightExact = Boolean(input.nextMatch && right.matchDate === input.nextMatch.date && normalizeTeamText(right.opponentTeam) === normalizeTeamText(input.nextMatch.opponent))
    if (leftExact !== rightExact) return leftExact ? -1 : 1
    if (left.matchDate !== right.matchDate) return (left.matchDate || '9999-12-31').localeCompare(right.matchDate || '9999-12-31')
    return right.updatedAt.localeCompare(left.updatedAt)
  })[0] || null
}
