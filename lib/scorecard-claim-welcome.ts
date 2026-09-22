export type ClaimResult = {
  winner_side: string | null
  claim_player: { side: string | null }[] | null
  participants: { side: string | null; players: { name: string } | { name: string }[] | null }[] | null
}

export function describeClaimResult(match: ClaimResult) {
  const side = match.claim_player?.[0]?.side
  const outcome = side && match.winner_side ? side === match.winner_side ? 'Win' : 'Loss' : 'Result'
  const opponents = (match.participants ?? [])
    .filter((participant) => side && participant.side && participant.side !== side)
    .map((participant) => Array.isArray(participant.players) ? participant.players[0]?.name : participant.players?.name)
    .filter((name): name is string => Boolean(name))

  return { outcome, opponents }
}
