import { describe, expect, it } from 'vitest'
import { buildLeagueWeeklyCourts } from '../league-weekly-format'
import { getAffectedWeeklyPlayers, getWeeklyLaunchReadiness, getWeeklyPlayerStatus, replaceWeeklyPlayer } from '../league-weekly-operations'

const courts = buildLeagueWeeklyCourts(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], { courtCount: 2 })
const input = { name: 'Thursday doubles', facility: 'Court site, 123 Main St', players: ['A'], startTimes: ['08:00', '08:30'], courtCount: 2, playOn: '2026-10-08', deadline: '2026-10-07T12:00:00Z', seasonStatus: 'active', startsOn: '2026-09-01', endsOn: '2026-12-01' }
describe('weekly launch and player statuses', () => {
  it('checks site, players, waves, season date, and future deadline independently', () => {
    expect(getWeeklyLaunchReadiness(input, Date.parse('2026-10-01T00:00Z')).every(item => item.ready)).toBe(true)
    const failed = getWeeklyLaunchReadiness({ ...input, facility: '', players: [], startTimes: [], seasonStatus: 'completed', deadline: null }, Date.parse('2026-10-01T00:00Z'))
    expect(failed.filter(item => !item.ready).map(item => item.key)).toEqual(['site', 'players', 'waves', 'date', 'deadline'])
    expect(getWeeklyLaunchReadiness({ ...input, playOn: '2027-01-01' }).find(item => item.key === 'date')?.ready).toBe(false)
  })
  it('distinguishes a saved in reply, confirmed court, waitlist, and withdrawal request', () => {
    const base = { playerName: 'A', status: 'collecting', roster: [], assignments: [], responseStatus: 'in' }
    expect(getWeeklyPlayerStatus(base).label).toContain('awaiting confirmation')
    expect(getWeeklyPlayerStatus({ ...base, status: 'published' }).label).toBe('Waitlisted')
    expect(getWeeklyPlayerStatus({ ...base, status: 'published', assignments: courts }).label).toBe('Confirmed to play')
    expect(getWeeklyPlayerStatus({ ...base, withdrawalPending: true, assignments: courts }).label).toBe('Withdrawal requested')
    expect(getWeeklyPlayerStatus({ ...base, responseStatus: 'out' }).label).toBe('You’re out')
    expect(getWeeklyPlayerStatus({ ...base, responseStatus: null }).label).toBe('No reply yet')
  })
  it('compares the reply deadline with the court start in the league time zone', () => {
    const now = Date.parse('2026-10-01T00:00Z')
    expect(getWeeklyLaunchReadiness({ ...input, deadline: '2026-10-08T12:00:00Z', timeZone: 'America/Chicago' }, now).find(item => item.key === 'deadline')?.ready).toBe(true)
    expect(getWeeklyLaunchReadiness({ ...input, deadline: '2026-10-08T14:00:00Z', timeZone: 'America/Chicago' }, now).find(item => item.key === 'deadline')?.ready).toBe(false)
  })
})
describe('substitutes and affected courts', () => {
  it('replaces all three rotations without mutating the original plan or another court', () => {
    const replaced = replaceWeeklyPlayer(courts, 'A', 'Sub')
    expect(replaced[0].players).toEqual(['Sub', 'B', 'C', 'D'])
    expect(replaced[0].sets.every(set => [...set.sideA, ...set.sideB].includes('Sub'))).toBe(true)
    expect(replaced[1]).toEqual(courts[1])
    expect(courts[0].players).toContain('A')
    expect(getAffectedWeeklyPlayers(courts, replaced).sort()).toEqual(['A', 'B', 'C', 'D', 'Sub'])
    expect(getAffectedWeeklyPlayers(courts, courts)).toEqual([])
  })
  it('rejects missing players, already assigned substitutes, and self replacement', () => {
    expect(() => replaceWeeklyPlayer(courts, 'A', 'E')).toThrow('already')
    expect(() => replaceWeeklyPlayer(courts, 'Nobody', 'Sub')).toThrow('published court')
    expect(() => replaceWeeklyPlayer(courts, 'A', 'A')).toThrow('different')
  })
  it('includes only the court affected by a time change', () => {
    const changed = courts.map((court, index) => index === 0 ? { ...court, startTime: '09:00' } : court)
    expect(getAffectedWeeklyPlayers(courts, changed)).toEqual(['A', 'B', 'C', 'D'])
  })
})
