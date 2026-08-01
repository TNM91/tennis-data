export type CaptainTeamImprovementId = 'roster' | 'contacts' | 'schedule' | 'ratings' | 'scorecard'

export type CaptainTeamImprovement = {
  id: CaptainTeamImprovementId
  title: string
  state: string
  detail: string
  cta: string
}

export function buildCaptainTeamImprovements(input: {
  rosterCount: number
  missingPhoneCount: number
  missingRatingCount: number
  scheduleCount: number
  appearanceCount: number
}): CaptainTeamImprovement[] {
  const improvements: CaptainTeamImprovement[] = []

  if (input.rosterCount === 0) {
    improvements.push({
      id: 'roster',
      title: 'Add your players',
      state: 'Roster missing',
      detail: 'Upload the Player Roster to connect player names, ratings, and the contact details TennisLink includes.',
      cta: 'Upload Player Roster',
    })
  } else if (input.missingPhoneCount > 0) {
    improvements.push({
      id: 'contacts',
      title: 'Add team phone numbers',
      state: `${input.missingPhoneCount} missing`,
      detail: `Upload the Player Roster to add phone numbers for ${input.missingPhoneCount} roster player${input.missingPhoneCount === 1 ? '' : 's'}.`,
      cta: 'Add phone numbers',
    })
  }

  if (input.scheduleCount === 0) {
    improvements.push({
      id: 'schedule',
      title: 'Add match dates and opponents',
      state: 'Schedule missing',
      detail: 'Upload the TennisLink schedule so availability, lineups, and messages open with the right match.',
      cta: 'Upload Schedule',
    })
  }

  if (input.rosterCount > 0 && input.missingRatingCount > 0) {
    improvements.push({
      id: 'ratings',
      title: 'Complete player ratings',
      state: `${input.missingRatingCount} missing`,
      detail: `Refresh the Player Roster to add rating context for ${input.missingRatingCount} player${input.missingRatingCount === 1 ? '' : 's'}.`,
      cta: 'Refresh Player Roster',
    })
  }

  if (input.scheduleCount > 0 && input.rosterCount > 0 && input.appearanceCount === 0) {
    improvements.push({
      id: 'scorecard',
      title: 'Add recent match results',
      state: 'No results yet',
      detail: 'Upload a recent scorecard to add results, court history, and pairing context.',
      cta: 'Upload Scorecard',
    })
  }

  return improvements
}
