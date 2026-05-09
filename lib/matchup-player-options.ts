export type MatchupPlayerOptionBase = {
  id?: string | null
  name?: string | null
}

export function normalizeMatchupPlayerOptions<T extends MatchupPlayerOptionBase>(rows: T[]) {
  const seen = new Set<string>()

  return rows
    .filter((player) => {
      const id = String(player.id || '').trim()
      const name = String(player.name || '').trim()
      if (!id || !name || seen.has(id)) return false
      seen.add(id)
      return true
    })
    .map((player) => ({
      ...player,
      id: String(player.id || '').trim(),
      name: String(player.name || '').trim(),
    }))
}
