export type MatchupPlayerOptionBase = {
  id?: string | null
  name?: string | null
  active?: boolean | null
  archived_at?: string | null
  deleted_at?: string | null
  is_active?: boolean | null
  is_deleted?: boolean | null
  status?: string | null
}

export function isMatchupPlayerOptionActive(player: MatchupPlayerOptionBase) {
  const status = String(player.status || '').trim().toLowerCase()
  if (player.is_deleted === true) return false
  if (player.is_active === false || player.active === false) return false
  if (player.deleted_at || player.archived_at) return false
  if (['archived', 'deleted', 'inactive', 'removed'].includes(status)) return false
  return true
}

export function normalizeMatchupPlayerOptions<T extends MatchupPlayerOptionBase>(rows: T[]) {
  const seen = new Set<string>()

  return rows
    .filter((player) => {
      const id = String(player.id || '').trim()
      const name = String(player.name || '').trim()
      if (!isMatchupPlayerOptionActive(player)) return false
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

export async function resolveMatchupPlayerOptions<T extends MatchupPlayerOptionBase>(
  catalogue: T[],
  requiredIds: string[],
  fetchByIds: (ids: string[]) => Promise<T[]>,
) {
  const available = normalizeMatchupPlayerOptions(catalogue)
  const knownIds = new Set(available.map(player => player.id))
  const missingIds = [...new Set(requiredIds.map(id => id.trim()).filter(Boolean))].filter(id => !knownIds.has(id))
  if (!missingIds.length) return available
  const selected = await fetchByIds(missingIds)
  return normalizeMatchupPlayerOptions([...available, ...selected]).sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

export function getMatchupStaleSelectionNotice(staleCount: number) {
  if (staleCount <= 1) {
    return 'One selected player was removed or replaced, so Matchup cleared that slot. Use Data Assist after review if this player needs a refreshed record.'
  }

  return 'Some selected players were removed or replaced, so Matchup cleared those slots. Use Data Assist after review if those records need to be refreshed.'
}
