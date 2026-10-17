import { describe, expect, it } from 'vitest'
import { getTeamDirectoryMatchDates, mergeTeamDirectoryDates } from '../team-directory-dates'

const today = '2026-10-16'
describe('team directory result and schedule dates', () => {
  it('keeps future scheduled matches out of result dates', () => {
    expect(getTeamDirectoryMatchDates({ match_date: '2027-01-10', winner_side: null }, today)).toEqual({ result: false, mostRecentMatchDate: null, nextScheduledMatchDate: '2027-01-10' })
  })
  it('dates completed results separately', () => {
    expect(getTeamDirectoryMatchDates({ match_date: '2026-10-04', winner_side: 'A' }, today)).toEqual({ result: true, mostRecentMatchDate: '2026-10-04', nextScheduledMatchDate: null })
  })
  it('does not turn a future winner into a played result', () => {
    expect(getTeamDirectoryMatchDates({ match_date: '2027-01-10', winner_side: 'A' }, today).result).toBe(false)
  })
  it('does not call an unanswered past fixture a result or upcoming match', () => {
    expect(getTeamDirectoryMatchDates({ match_date: '2026-10-01', winner_side: null }, today)).toEqual({ result: false, mostRecentMatchDate: null, nextScheduledMatchDate: null })
  })
  it.each(['canceled', 'cancelled', 'postponed', 'void', 'abandoned'])('excludes %s fixtures', (status) => {
    expect(getTeamDirectoryMatchDates({ match_date: '2026-10-18', winner_side: null, status }, today).nextScheduledMatchDate).toBeNull()
  })
  it('keeps a match due today in the schedule until there is a result', () => {
    expect(getTeamDirectoryMatchDates({ match_date: today, winner_side: null }, today).nextScheduledMatchDate).toBe(today)
    expect(getTeamDirectoryMatchDates({ match_date: today, winner_side: 'B' }, today).mostRecentMatchDate).toBe(today)
  })
  it('keeps undated results in records without inventing a date', () => {
    expect(getTeamDirectoryMatchDates({ match_date: null, winner_side: 'A' }, today)).toEqual({ result: true, mostRecentMatchDate: null, nextScheduledMatchDate: null })
  })
  it.each(['2026-13-01', '2026-02-31', 'invalid'])('rejects invalid date %s', (match_date) => {
    const result = getTeamDirectoryMatchDates({ match_date, winner_side: null }, today)
    expect(result.mostRecentMatchDate).toBeNull()
    expect(result.nextScheduledMatchDate).toBeNull()
  })
  it('merges seasons using the latest result and earliest upcoming match', () => {
    const a = { mostRecentMatchDate: '2026-10-04', nextScheduledMatchDate: '2027-01-10' }
    const b = { mostRecentMatchDate: '2026-10-11', nextScheduledMatchDate: '2026-10-18' }
    expect(mergeTeamDirectoryDates(a, b)).toEqual({ mostRecentMatchDate: '2026-10-11', nextScheduledMatchDate: '2026-10-18' })
    expect(mergeTeamDirectoryDates(b, a)).toEqual(mergeTeamDirectoryDates(a, b))
  })
})
