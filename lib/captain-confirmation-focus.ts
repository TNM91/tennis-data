export type ConfirmationStatus = 'in' | 'out' | 'maybe' | 'unanswered'
export type ConfirmationPlayer = { id: string; name: string; status: ConfirmationStatus; note?: string; missingRoster?: boolean }
export type ConfirmationSelection = { id: string; name: string }
export type ConfirmationScope = { team: string; league: string; flight: string; date: string; opponent: string }

export function readScopedConfirmationSelections(scope: ConfirmationScope, source: {
  team: string; league?: string; flight?: string; date: string; opponent?: string; slots: unknown
} | null): ConfirmationSelection[] | null {
  if (!source || !scope.team || !scope.date || source.team !== scope.team || source.date.slice(0, 10) !== scope.date.slice(0, 10)
    || (scope.league && source.league !== scope.league) || (scope.flight && source.flight !== scope.flight)
    || (scope.opponent && source.opponent && source.opponent !== scope.opponent) || !Array.isArray(source.slots)) return null
  const selected = new Map<string, ConfirmationSelection>()
  for (const slot of source.slots) {
    if (!slot || typeof slot !== 'object' || !Array.isArray(slot.players)) continue
    for (const player of slot.players) {
      const name = typeof player === 'string' ? player.trim() : typeof player?.playerName === 'string' ? player.playerName.trim() : ''
      const id = typeof player?.playerId === 'string' ? player.playerId.trim() : ''
      if (name) selected.set(id || name.toLowerCase(), { id, name })
    }
  }
  return [...selected.values()]
}

export function buildCaptainConfirmationFocus(roster: ConfirmationPlayer[], selections: ConfirmationSelection[], shared: boolean) {
  const byId = new Map(roster.map((player) => [player.id, player]))
  const byName = new Map<string, ConfirmationPlayer | null>()
  for (const player of roster) {
    const name = player.name.trim().toLowerCase()
    byName.set(name, byName.has(name) ? null : player)
  }
  const selectedById = new Map<string, ConfirmationPlayer>()
  for (const selection of selections) {
    const player = byId.get(selection.id) ?? byName.get(selection.name.trim().toLowerCase())
      ?? { id: selection.id || `lineup:${selection.name.toLowerCase()}`, name: selection.name, status: 'unanswered' as const, missingRoster: true }
    selectedById.set(player.id, player)
  }
  const selected = [...selectedById.values()]
  const rank: Record<ConfirmationStatus, number> = { out: 0, maybe: 1, unanswered: 2, in: 3 }
  const sort = (players: ConfirmationPlayer[]) => players.toSorted((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name))
  const confirmed = selected.filter((player) => player.status === 'in')
  const attention = sort(selected.filter((player) => player.status !== 'in'))
  const others = sort(roster.filter((player) => !selectedById.has(player.id)))
  const focus = selected.length ? selected : roster
  const out = focus.filter((player) => player.status === 'out').length
  const missing = selected.some((player) => player.missingRoster)
  const waiting = focus.filter((player) => player.status === 'unanswered' || player.status === 'maybe').length
  const answered = focus.filter((player) => player.status !== 'unanswered').length
  const nextAction = missing || (selected.length > 0 && out > 0) || (focus.length > 0 && waiting === 0)
    ? 'lineup' as const : shared || answered > 0 ? 'chase' as const : 'ask' as const
  return { selected, confirmed, attention, others, waiting, answered, total: focus.length, nextAction,
    actionLabel: nextAction === 'lineup' ? 'Return to lineup' : nextAction === 'chase' ? 'Chase replies' : 'Ask players',
    actionDetail: missing ? 'Review selected players missing from the loaded roster.' : selected.length && out ? 'Replace players marked out before sending the lineup.'
      : nextAction === 'lineup' ? 'Review your courts and the latest player replies.' : waiting ? `${waiting} player${waiting === 1 ? '' : 's'} still need${waiting === 1 ? 's' : ''} a clear Yes.` : 'Share the match’s availability link.',
  }
}

export type CaptainConfirmationFocus = ReturnType<typeof buildCaptainConfirmationFocus>
