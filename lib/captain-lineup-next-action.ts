export type CaptainLineupNextAction = {
  step: 'setup' | 'finish' | 'replace' | 'ask' | 'send'
  label: string
  detail: string
}

export function getCaptainLineupNextAction({
  hasMatch, lineupComplete, openCourtLabel, selectedCount, requiredCount,
  confirmedCount, outCount, maybeCount,
}: {
  hasMatch: boolean
  lineupComplete: boolean
  openCourtLabel?: string
  selectedCount: number
  requiredCount: number
  confirmedCount: number
  outCount: number
  maybeCount: number
}): CaptainLineupNextAction {
  if (!hasMatch) return { step: 'setup', label: 'Choose match', detail: 'Choose your team, opponent, and match date.' }
  if (!lineupComplete || requiredCount <= 0 || selectedCount !== requiredCount) {
    return {
      step: 'finish', label: 'Finish courts',
      detail: openCourtLabel ? `${openCourtLabel} needs players.` : 'Choose a different player for every spot.',
    }
  }
  if (outCount > 0) return { step: 'replace', label: 'Replace out player', detail: `${outCount} selected player${outCount === 1 ? ' is' : 's are'} out.` }
  if (confirmedCount !== requiredCount || maybeCount > 0) {
    return {
      step: 'ask', label: 'Ask players',
      detail: maybeCount > 0 ? `${maybeCount} player${maybeCount === 1 ? ' is' : 's are'} still maybe.` : `${confirmedCount}/${requiredCount} confirmed. Save this lineup and ask who can play.`,
    }
  }
  return { step: 'send', label: 'Send lineup', detail: 'Every player is in. Send the lineup to Team Chat.' }
}
