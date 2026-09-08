type CaptainMessagingAudienceInput = {
  lineupPlayers: number
  lineupTextsOpened: number
  rosterPlayers: number
  rosterNeedsStatus: number
  rosterAvailable: number
  matchConfirmed: number
  matchRepliesPending: number
}

export function buildCaptainMessagingAudienceCopy(input: CaptainMessagingAudienceInput) {
  const lineupPlayers = safeCount(input.lineupPlayers)
  const rosterPlayers = safeCount(input.rosterPlayers)
  const rosterNeedsStatus = Math.min(safeCount(input.rosterNeedsStatus), rosterPlayers)

  return {
    lineupProgress: `${Math.min(safeCount(input.lineupTextsOpened), lineupPlayers)} of ${lineupPlayers} selected-player texts opened`,
    lineupScope: `Lineup check: ${lineupPlayers} selected ${pluralize(lineupPlayers, 'player')}. Full roster: ${rosterPlayers} ${pluralize(rosterPlayers, 'player')}.`,
    rosterNeedsStatus: rosterNeedsStatus
      ? `${rosterNeedsStatus} of ${rosterPlayers} roster ${pluralize(rosterPlayers, 'player')} need status`
      : 'Full-roster availability complete',
    rosterPlayers: `${rosterPlayers} roster ${pluralize(rosterPlayers, 'player')}`,
    rosterAvailable: `${safeCount(input.rosterAvailable)} roster available`,
    matchConfirmed: `${safeCount(input.matchConfirmed)} player ${pluralize(input.matchConfirmed, 'confirmation')}`,
    matchRepliesPending: `${safeCount(input.matchRepliesPending)} match ${pluralize(input.matchRepliesPending, 'reply', 'replies')} pending`,
  }
}

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return safeCount(count) === 1 ? singular : plural
}
