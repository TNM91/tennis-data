type MatchScope = { team: string; league: string; flight: string; date: string }
type Invite = { player_id: string | null; player_name: string }
type Response = Invite & { match_date: string; status: string; notes: string | null; responded_at: string | null }
type Availability = {
  team_name: string; league_name: string | null; flight: string | null; match_date: string
  player_id: string; status: string | null; notes: string | null
}

// Player reply links and captain-recorded confirmations both update lineup_availability.
// Use that match record for current status, while retaining names and reply timestamps.
export function mergeCaptainMatchResponses(scope: MatchScope, invites: Invite[], replies: Response[], availability: Availability[]): Response[] {
  const result = new Map<string, Response>()
  for (const reply of replies) {
    if (reply.match_date.slice(0, 10) !== scope.date.slice(0, 10)) continue
    const key = reply.player_id || reply.player_name.trim().toLowerCase()
    if (!result.has(key)) result.set(key, reply)
  }
  for (const row of availability) {
    if (row.team_name !== scope.team || row.match_date.slice(0, 10) !== scope.date.slice(0, 10)
      || (row.league_name && row.league_name !== scope.league) || (row.flight && row.flight !== scope.flight)) continue
    const invite = invites.find((player) => player.player_id === row.player_id)
    const previous = result.get(row.player_id)
    const name = invite?.player_name || previous?.player_name
    if (!name) continue
    const status = row.status?.trim().toLowerCase()
    const normalized = ['available', 'confirmed', 'yes', 'in'].includes(status || '') ? 'available'
      : ['unavailable', 'out', 'no', 'declined'].includes(status || '') ? 'unavailable'
        : ['limited', 'maybe'].includes(status || '') ? 'maybe' : null
    if (!normalized) continue
    // Remove a name-only reply when the invite supplies its stable player ID.
    result.delete(name.trim().toLowerCase())
    result.set(row.player_id, {
      player_id: row.player_id, player_name: name, match_date: row.match_date,
      status: normalized, notes: row.notes, responded_at: previous?.responded_at || null,
    })
  }
  return [...result.values()]
}
