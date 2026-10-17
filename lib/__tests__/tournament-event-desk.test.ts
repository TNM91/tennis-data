import { describe, expect, it } from 'vitest'
import { buildEventDeskMatches, buildEventDivisionReadiness, findEventCourtOverlaps, isCompleteEventSlot } from '../tournament-event-desk'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'

function division(id = '40'): TiqTournamentRecord {
  return { id, eventId: 'pumpkin', name: `Division ${id}`, format: 'round_robin', entrantType: 'teams', status: 'draft',
    startsOn: '2026-10-17', locationLabel: '', directorNotes: '', entrants: ['Team A', 'Team B'], results: {},
    schedule: {}, contacts: {}, entrantPlayerIds: {}, isPublic: false, createdAt: '', updatedAt: '' }
}
const slot = (date = '2026-10-17', time = '17:30', court = '1') => ({ date, time, court, updatedAt: '' })

describe('event organizer readiness and court planning', () => {
  it('shows honest empty readiness without generating placeholder matches', () => {
    const empty = { ...division(), entrants: [], format: 'single_elimination' as const }
    expect(buildEventDeskMatches([empty])).toEqual([])
    expect(buildEventDivisionReadiness(empty, [])).toMatchObject({ ready: false, total: 0, next: { kind: 'entrants' } })
  })
  it('keeps identical match IDs and team names separate across divisions', () => {
    const first = { ...division(), schedule: { 'r1-m1': slot() } }
    const second = { ...division('45'), schedule: { 'r1-m1': slot('2026-10-17', '18:00', 'Court 01') } }
    const matches = buildEventDeskMatches([first, second])
    expect(new Set(matches.map(match => match.key)).size).toBe(2)
    expect(findEventCourtOverlaps(matches)).toHaveLength(1)
    expect(findEventCourtOverlaps(matches, 30)).toEqual([])
  })
  it('detects overlapping slots across midnight and ignores adjacent slots and finished matches', () => {
    const first = { ...division(), schedule: { 'r1-m1': slot('2026-10-17', '23:45') } }
    const second = { ...division('45'), schedule: { 'r1-m1': slot('2026-10-18', '00:15') } }
    expect(findEventCourtOverlaps(buildEventDeskMatches([first, second]))).toHaveLength(1)
    second.schedule['r1-m1'].time = '00:45'
    expect(findEventCourtOverlaps(buildEventDeskMatches([first, second]))).toEqual([])
    second.schedule['r1-m1'].time = '00:15'
    first.results = { 'r1-m1': { winner: 'Team A', score: '6-4', updatedAt: '' } }
    expect(findEventCourtOverlaps(buildEventDeskMatches([first, second]))).toEqual([])
  })
  it('moves the next action from teams to courts to scores to awards', () => {
    const record = division()
    let matches = buildEventDeskMatches([record])
    expect(buildEventDivisionReadiness(record, matches).next.kind).toBe('schedule')
    record.schedule = { 'r1-m1': slot() }
    matches = buildEventDeskMatches([record])
    expect(buildEventDivisionReadiness(record, matches)).toMatchObject({ ready: true, assigned: 1, next: { kind: 'scores' } })
    record.results = { 'r1-m1': { winner: 'Team A', score: '6-4', updatedAt: '' } }
    expect(buildEventDivisionReadiness(record, buildEventDeskMatches([record])).next.kind).toBe('awards')
  })
  it('treats incomplete and invalid slots as unassigned', () => {
    expect(isCompleteEventSlot(slot('2026-02-30'))).toBe(false)
    expect(isCompleteEventSlot(slot('2026-10-17', '25:00'))).toBe(false)
    expect(isCompleteEventSlot(slot('2026-10-17', '17:30', ' '))).toBe(false)
    const record = { ...division(), schedule: { 'r1-m1': slot('2026-02-30') } }
    expect(buildEventDivisionReadiness(record, buildEventDeskMatches([record]))).toMatchObject({ assigned: 0, unscheduled: 1 })
  })
})