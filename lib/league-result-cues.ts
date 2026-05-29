export type ResultCueItem = {
  label: string
  complete: boolean
  detail: string
}

export type TeamResultCueInput = {
  leagueCount: number
  selectedLeagueName?: string | null
  teamCount: number
  matchCount: number
  completeMatchCount: number
  completedLineCount: number
  totalLineCount: number
  scoreReviewCount?: number
}

export type IndividualResultCueInput = {
  leagueCount: number
  selectedLeagueName?: string | null
  playerCount: number
  resultCount: number
  nextPairingLabel?: string | null
}

export function pluralizeCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function buildTeamResultCue(input: TeamResultCueInput) {
  const leagueName = input.selectedLeagueName?.trim() || ''
  const hasTeamLeagueSetup = input.leagueCount > 0
  const incompleteMatchCount = Math.max(input.matchCount - input.completeMatchCount, 0)
  const scoreReviewCount = input.scoreReviewCount ?? 0

  return {
    title: hasTeamLeagueSetup
      ? leagueName
        ? `${leagueName} is selected.`
        : 'Choose a team league or review all matches.'
      : 'Create a team league before recording team results.',
    detail: hasTeamLeagueSetup
      ? scoreReviewCount > 0
        ? `${pluralizeCount(scoreReviewCount, 'dynamic score')} ${scoreReviewCount === 1 ? 'needs' : 'need'} review.`
        : incompleteMatchCount > 0
          ? `${pluralizeCount(incompleteMatchCount, 'match', 'matches')} still need line completion.`
          : input.matchCount > 0
            ? 'Recorded team matches have complete line coverage.'
            : 'Open New match to start the first team result.'
      : 'Team results are scoped to team-format TIQ leagues only.',
    items: [
      {
        label: 'Team league',
        complete: hasTeamLeagueSetup,
        detail: leagueName || (hasTeamLeagueSetup ? pluralizeCount(input.leagueCount, 'team league') : 'Create a team league first'),
      },
      {
        label: 'Teams',
        complete: input.teamCount > 1,
        detail: input.teamCount > 0 ? `${pluralizeCount(input.teamCount, 'team')} in scope` : 'Add teams in League Office setup',
      },
      {
        label: 'Matches',
        complete: input.matchCount > 0,
        detail: input.matchCount > 0 ? `${pluralizeCount(input.matchCount, 'team match', 'team matches')} recorded` : 'Create the first team match',
      },
      {
        label: 'Lines',
        complete: input.matchCount > 0 && incompleteMatchCount === 0,
        detail: input.matchCount > 0 ? `${input.completedLineCount}/${input.totalLineCount} lines complete` : 'Add lines after creating a match',
      },
    ] satisfies ResultCueItem[],
  }
}

export function buildIndividualResultCue(input: IndividualResultCueInput) {
  const leagueName = input.selectedLeagueName?.trim() || ''
  const hasIndividualLeagueSetup = input.leagueCount > 0
  const nextPairing = input.nextPairingLabel?.trim() || ''

  return {
    title: hasIndividualLeagueSetup
      ? leagueName
        ? `${leagueName} is selected.`
        : 'Choose an individual league to start.'
      : 'Create an individual league before logging player results.',
    detail: hasIndividualLeagueSetup
      ? input.playerCount > 1
        ? nextPairing
          ? `Next useful result: ${nextPairing}.`
          : 'Player result entry is ready for the selected league.'
        : 'Add at least two players before result entry becomes useful.'
      : 'Individual results are scoped to individual-format TIQ leagues only.',
    items: [
      {
        label: 'Individual league',
        complete: Boolean(leagueName),
        detail: leagueName || (hasIndividualLeagueSetup ? 'Choose a league to log player results' : 'Create an individual league first'),
      },
      {
        label: 'Players',
        complete: input.playerCount > 1,
        detail: input.playerCount > 0 ? `${pluralizeCount(input.playerCount, 'player')} in scope` : 'Add players in League Office setup',
      },
      {
        label: 'Results',
        complete: input.resultCount > 0,
        detail: input.resultCount > 0 ? `${pluralizeCount(input.resultCount, 'result')} recorded` : 'Log the first player result',
      },
      {
        label: 'Next pairing',
        complete: Boolean(nextPairing),
        detail: nextPairing || 'Needs at least two eligible players',
      },
    ] satisfies ResultCueItem[],
  }
}
