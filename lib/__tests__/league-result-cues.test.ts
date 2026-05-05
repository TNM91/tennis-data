import { describe, expect, it } from 'vitest'

import { buildIndividualResultCue, buildTeamResultCue } from '../league-result-cues'

describe('league result cues', () => {
  it('guides team leagues toward setup first', () => {
    const cue = buildTeamResultCue({
      leagueCount: 0,
      teamCount: 0,
      matchCount: 0,
      completeMatchCount: 0,
      completedLineCount: 0,
      totalLineCount: 0,
    })

    expect(cue.title).toBe('Create a team league before recording team results.')
    expect(cue.items[0]).toMatchObject({ label: 'Team league', complete: false })
  })

  it('prioritizes dynamic score review over line completion for team leagues', () => {
    const cue = buildTeamResultCue({
      leagueCount: 1,
      selectedLeagueName: 'Tuesday Teams',
      teamCount: 4,
      matchCount: 3,
      completeMatchCount: 1,
      completedLineCount: 8,
      totalLineCount: 12,
      scoreReviewCount: 2,
    })

    expect(cue.title).toBe('Tuesday Teams is selected.')
    expect(cue.detail).toBe('2 dynamic scores need review.')
  })

  it('shows complete line coverage once team matches are finished', () => {
    const cue = buildTeamResultCue({
      leagueCount: 1,
      selectedLeagueName: 'Tuesday Teams',
      teamCount: 4,
      matchCount: 2,
      completeMatchCount: 2,
      completedLineCount: 10,
      totalLineCount: 10,
    })

    expect(cue.detail).toBe('Recorded team matches have complete line coverage.')
    expect(cue.items.find((item) => item.label === 'Lines')).toMatchObject({
      complete: true,
      detail: '10/10 lines complete',
    })
  })

  it('guides individual leagues toward first useful pairing', () => {
    const cue = buildIndividualResultCue({
      leagueCount: 1,
      selectedLeagueName: 'Ladder Night',
      playerCount: 8,
      resultCount: 3,
      nextPairingLabel: 'Avery Stone vs Jordan Lee',
    })

    expect(cue.title).toBe('Ladder Night is selected.')
    expect(cue.detail).toBe('Next useful result: Avery Stone vs Jordan Lee.')
    expect(cue.items.find((item) => item.label === 'Next pairing')).toMatchObject({
      complete: true,
      detail: 'Avery Stone vs Jordan Lee',
    })
  })
})
