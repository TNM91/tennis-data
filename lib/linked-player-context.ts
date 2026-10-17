/** Keep the member's linked record available even when it is outside the directory batch. */
export async function includeLinkedPlayer<T extends { id: string }>(
  players: T[],
  playerId: string | null | undefined,
  loadPlayer: (id: string) => Promise<T[]>,
): Promise<T[]> {
  if (!playerId || players.some((player) => player.id === playerId)) return players
  const linked = await loadPlayer(playerId)
  return [...players, ...linked.filter((player) => player.id === playerId)]
}
