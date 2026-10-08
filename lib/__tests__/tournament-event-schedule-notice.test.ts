import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildEventScheduleNoticeMessage, normalizeEventScheduleChange, recordEventScheduleChange } from '../tournament-event-schedule-notice'
import { readTiqTournamentRegistry, writeTiqTournamentRegistry, updateTiqTournamentMatchSchedule, type TiqTournamentRecord } from '../tiq-tournament-registry'
afterEach(() => vi.unstubAllGlobals())
const old = { date: '2026-10-17', time: '17:30', court: 'Court 1', updatedAt: '2026-10-01T00:00:00Z' }
const next = { ...old, time: '18:00', court: 'Court 2', updatedAt: '2026-10-08T00:00:00Z' }
describe('event schedule change notices', () => {
  it('keeps change history through registry reloads and cleared assignments', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } })
    const division: TiqTournamentRecord = { id: 'notice-test', eventId: 'event', name: 'Doubles', format: 'round_robin', entrantType: 'teams', status: 'scheduled', startsOn: '2026-10-17', locationLabel: '', directorNotes: '', entrants: ['A', 'B'], results: {}, schedule: { 'r1-m1': old }, contacts: {}, entrantPlayerIds: {}, isPublic: false, createdAt: '', updatedAt: '' }
    writeTiqTournamentRegistry([division])
    updateTiqTournamentMatchSchedule({ tournamentId: division.id, matchId: 'r1-m1', ...next })
    expect(readTiqTournamentRegistry().find(row => row.id === division.id)?.schedule['r1-m1'].change?.previous.court).toBe('Court 1')
    updateTiqTournamentMatchSchedule({ tournamentId: division.id, matchId: 'r1-m1', date: '', time: '', court: '' })
    const cleared = readTiqTournamentRegistry().find(row => row.id === division.id)!.schedule['r1-m1']
    expect(cleared.court).toBe('')
    expect(cleared.change?.previous.court).toBe('Court 2')
  })
  it('does not describe a first assignment as a change', () => {
    expect(recordEventScheduleChange(undefined, next, 'A', 'B')).toBeUndefined()
  })
  it('records the immediately previous assignment and affected pairing', () => {
    const change = recordEventScheduleChange(old, next, 'A', 'B')!
    expect(change).toEqual({ previous: { date: old.date, time: old.time, court: old.court }, sideA: 'A', sideB: 'B', changedAt: next.updatedAt })
    expect(recordEventScheduleChange({ ...next, change }, { ...next, court: 'Court 3' }, 'A', 'B')?.previous.court).toBe('Court 2')
  })
  it('keeps the existing notice when the assignment is unchanged', () => {
    const change = recordEventScheduleChange(old, next, 'A', 'B')!
    expect(recordEventScheduleChange({ ...next, change }, { ...next, updatedAt: '2026-10-09T00:00:00Z' }, 'A', 'B')).toBe(change)
  })
  it('describes a withdrawn slot honestly', () => {
    const cleared = { date: '', time: '', court: '', updatedAt: next.updatedAt }
    const message = buildEventScheduleNoticeMessage('Pumpkin Playoffs', 'Round 1', { ...cleared, change: recordEventScheduleChange(old, cleared, 'A', 'B') }, 'Central')
    expect(message).toContain('Previously: Saturday, October 17 · 5:30 PM · Central · Court 1')
    expect(message).toContain('Now: Assignment pending')
    expect(message).toContain('A vs B')
  })
  it('rejects corrupt snapshots and strips unrelated metadata from saved notices', () => {
    expect(normalizeEventScheduleChange({ previous: old, sideA: 'A', sideB: 'B', changedAt: 'bad' })).toBeUndefined()
    const change = recordEventScheduleChange(old, next, 'A', 'B')!
    expect(normalizeEventScheduleChange({ ...change, privateNote: 'secret', previous: { ...old, phone: 'secret' } })).toEqual(change)
  })
})
