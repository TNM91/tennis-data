export const PUBLIC_PLAYER_MIN_RESULTS = 3
export const PUBLIC_PLAYER_RESULT_LIMIT = 6

export type PublicPlayerIdentity = { id: string; name: string; location: string | null }
export type PublicMatchRow = {
  id: string
  match_date: string | null
  match_type: string | null
  score: string | null
  winner_side: string | null
  public_history_eligible: boolean
  league_name: string | null
}
export type PublicParticipantRow = {
  match_id: string
  player_id: string
  side: string | null
  players: PublicPlayerIdentity | PublicPlayerIdentity[] | null
}
export type PublicPlayerResult = {
  id: string
  date: string
  format: 'singles' | 'doubles'
  score: string
  result: 'W' | 'L'
  opponents: PublicPlayerIdentity[]
  partner: PublicPlayerIdentity | null
  competition: string | null
}
export type PublicPlayerEvidence = {
  player: PublicPlayerIdentity
  results: PublicPlayerResult[]
}

export function isPublicPlayerId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/** Promote only named, scored public results with a full, unambiguous lineup. */
export function buildPublicPlayerEvidence(
  matches: PublicMatchRow[],
  participants: PublicParticipantRow[],
  today = new Date().toISOString().slice(0, 10),
): PublicPlayerEvidence[] {
  const byMatch = new Map<string, PublicParticipantRow[]>()
  for (const participant of participants) {
    const rows = byMatch.get(participant.match_id) || []
    rows.push(participant)
    byMatch.set(participant.match_id, rows)
  }
  const byPlayer = new Map<string, PublicPlayerEvidence>()
  const seenMatches = new Set<string>()
  const ordered = [...matches].sort((a, b) => (b.match_date || '').localeCompare(a.match_date || '') || b.id.localeCompare(a.id))
  for (const match of ordered) {
    if (seenMatches.has(match.id)) continue
    seenMatches.add(match.id)
    const score = match.score?.trim() || ''
    const date = match.match_date?.slice(0, 10) || ''
    const format = match.match_type
    if (!match.public_history_eligible || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > today) continue
    if (format !== 'singles' && format !== 'doubles') continue
    if (match.winner_side !== 'A' && match.winner_side !== 'B') continue
    const scorePairs = [...score.matchAll(/(\d+)\s*[-–]\s*(\d+)/g)]
    if (!scorePairs.some(([, left, right]) => Math.max(Number(left), Number(right)) >= 6) || /\b(ret(?:ired)?|wo|w\/o|walkover|default|def)\b/i.test(score)) continue
    const rows = byMatch.get(match.id) || []
    const expectedSize = format === 'singles' ? 1 : 2
    if (rows.length !== expectedSize * 2 || new Set(rows.map((row) => row.player_id)).size !== rows.length) continue
    const lineup = rows.map((row) => {
      const identity = Array.isArray(row.players) ? (row.players.length === 1 ? row.players[0] : null) : row.players
      if (!identity || identity.id !== row.player_id || !isPublicPlayerId(identity.id) || !identity.name?.trim()) return null
      if (/^(player|unknown|tbd|player not linked|unknown player)$/i.test(identity.name.trim())) return null
      if (row.side !== 'A' && row.side !== 'B') return null
      return { side: row.side, player: { id: identity.id, name: identity.name.trim(), location: identity.location?.trim() || null } }
    })
    if (lineup.some((row) => row === null)) continue
    const complete = lineup.filter((row) => row !== null)
    if (complete.filter((row) => row.side === 'A').length !== expectedSize || complete.filter((row) => row.side === 'B').length !== expectedSize) continue
    for (const row of complete) {
      const evidence = byPlayer.get(row.player.id) || { player: row.player, results: [] }
      if (evidence.results.length < PUBLIC_PLAYER_RESULT_LIMIT) {
        evidence.results.push({
          id: match.id, date, format, score,
          result: row.side === match.winner_side ? 'W' : 'L',
          opponents: complete.filter((other) => other.side !== row.side).map((other) => other.player),
          partner: complete.find((other) => other.side === row.side && other.player.id !== row.player.id)?.player || null,
          competition: match.league_name?.trim() || null,
        })
      }
      byPlayer.set(row.player.id, evidence)
    }
  }
  return [...byPlayer.values()]
}

export function hasDiscoverablePlayerEvidence(evidence: PublicPlayerEvidence | null) {
  return Boolean(evidence && evidence.results.length >= PUBLIC_PLAYER_MIN_RESULTS)
}
