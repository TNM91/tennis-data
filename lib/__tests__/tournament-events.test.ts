import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTournamentDivisionDraft, getTournamentEventRoots, getTournamentEventDivisions, getEventCourtConflicts } from '../tournament-events'
import { readTiqTournamentRegistry, upsertTiqTournamentRecord, updateTiqTournamentMatchResult, type TiqTournamentRecord } from '../tiq-tournament-registry'

describe('events with independent tournament divisions', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) } })
  })

  function event() {
    return upsertTiqTournamentRecord({ name: 'Pumpkin Playoffs', isEvent: true, eventTheme: 'pumpkin',
      format: 'round_robin', entrantType: 'teams', status: 'draft', startsOn: '2026-10-17',
      locationLabel: 'Woodsmill', directorNotes: '5:30 pm · $80/team', entrants: [], isPublic: false,
      registrationEmail: 'leskotennis11@gmail.com' }, 'pumpkin')
  }

  it('stores an empty event and empty divisions with inherited shared details', () => {
    const parent = event()
    const draft = buildTournamentDivisionDraft(parent, "Men's 4.0 Doubles")
    const division = upsertTiqTournamentRecord(draft, 'division-40')
    expect(readTiqTournamentRegistry().find(row => row.id === division.id)).toMatchObject({
      eventId: parent.id, isEvent: false, startsOn: parent.startsOn, eventTheme: 'pumpkin',
      locationLabel: 'Woodsmill', entrants: [], registrationEmail: parent.registrationEmail,
    })
    expect(getTournamentEventRoots(readTiqTournamentRegistry()).map(row => row.id)).toEqual([parent.id])
  })

  it('keeps same-named teams and same match IDs isolated between divisions', () => {
    const parent = event()
    for (const [id, name] of [['40', "Men's 4.0 Doubles"], ['45', "Men's 4.5 Doubles"]]) {
      upsertTiqTournamentRecord({ ...buildTournamentDivisionDraft(parent, name), entrants: ['Team A', 'Team B'] }, id)
    }
    updateTiqTournamentMatchResult({ tournamentId: '40', matchId: 'r1-m1', winner: 'Team A', score: '6-3 6-4' })
    const rows = readTiqTournamentRegistry()
    expect(rows.find(row => row.id === '40')?.results['r1-m1']?.winner).toBe('Team A')
    expect(rows.find(row => row.id === '45')?.results).toEqual({})
    expect(rows.find(row => row.id === parent.id)?.results).toEqual({})
    expect(getTournamentEventDivisions(rows, parent.id).map(row => row.id)).toEqual(['40', '45'])
  })

  it('propagates shared event changes without replacing division fields or scores', () => {
    const parent = event()
    upsertTiqTournamentRecord({ ...buildTournamentDivisionDraft(parent, '4.0'), entrants: ['A', 'B'], directorNotes: 'Play one set.' }, '40')
    updateTiqTournamentMatchResult({ tournamentId: '40', matchId: 'r1-m1', winner: 'A', score: '6-4' })
    upsertTiqTournamentRecord({ ...parent, locationLabel: 'Court center', startsOn: '2026-10-18', isPublic: true, eventDetails: { feePerTeam: 80, directorName: 'Michael Lesko' } }, parent.id)
    const division = readTiqTournamentRegistry().find(row => row.id === '40')!
    expect(division).toMatchObject({ locationLabel: 'Court center', startsOn: '2026-10-18', isPublic: true, directorNotes: 'Play one set.' })
    expect(division.results['r1-m1'].winner).toBe('A')
    expect(division.entrants).toEqual(['A', 'B'])
    expect(division.eventDetails).toEqual({ feePerTeam: 80, directorName: 'Michael Lesko' })
  })

  it('keeps legacy tournaments and divisions with an unavailable parent visible', () => {
    const parent = event()
    const orphan = { ...parent, id: 'orphan', isEvent: false, eventId: 'private-event' }
    expect(getTournamentEventRoots([orphan]).map(row => row.id)).toEqual(['orphan'])
    expect(() => buildTournamentDivisionDraft(orphan, 'Another division')).toThrow('Choose an event')
  })

  it('flags shared court assignments across divisions but ignores incomplete schedules', () => {
    const parent = event()
    const make = (name: string, court: string): TiqTournamentRecord => ({ ...parent, name, schedule: {
      'r1-m1': { date: '2026-10-17', time: '17:30', court, updatedAt: '' },
      incomplete: { date: '', time: '', court: '1', updatedAt: '' },
    } })
    expect(getEventCourtConflicts([make('4.0', 'Court 1'), make('4.5', ' court 1 ')])).toEqual([
      { slot: '2026-10-17 17:30 · court 1', names: ['4.0', '4.5'] },
    ])
    expect(getEventCourtConflicts([make('4.0', 'Court 1'), make('4.5', 'Court 2')])).toEqual([])
  })
})
