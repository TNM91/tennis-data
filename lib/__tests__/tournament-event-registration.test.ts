import { describe, expect, it } from 'vitest'
import { registrationReadiness, untrackedRegistrations, validateRegistration, type EventRegistration, type RegistrationDraft } from '../tournament-event-registration'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'
const draft: RegistrationDraft = { tournament_id: '40', player_one: 'Morgan', player_two: 'Lee', status: 'confirmed', fee_cents: 8000, paid_cents: 8000, note: '' }
const row: EventRegistration = { ...draft, id: 'id', event_id: 'event', entrant_name: 'Morgan / Lee', updated_at: 'now' }
const division = { entrantType: 'teams' as const, entrants: ['Morgan / Lee'] }
describe('event registration readiness', () => {
  it('requires pairing, full payment, and an actual confirmed draw place', () => {
    expect(registrationReadiness(row, division).ready).toBe(true)
    expect(registrationReadiness({ ...row, player_two: '' }, division).ready).toBe(false)
    expect(registrationReadiness({ ...row, paid_cents: 4000 }, division).ready).toBe(false)
    expect(registrationReadiness({ ...row, status: 'waitlisted' }, division).ready).toBe(false)
    expect(registrationReadiness(row, { ...division, entrants: [] }).ready).toBe(false)
  })
  it('allows free entry and singles without manufacturing a partner', () => {
    expect(registrationReadiness({ ...row, player_two: '', fee_cents: 0, paid_cents: 0 }, { ...division, entrantType: 'players' }).ready).toBe(true)
    expect(validateRegistration({ ...draft, player_two: '' }, { entrantType: 'players' })).toBe('')
    expect(validateRegistration(draft, { entrantType: 'players' })).toContain('one player')
  })
  it('keeps a partnerless entry pending or waitlisted until pairing is complete', () => {
    expect(validateRegistration({ ...draft, player_two: '' }, division)).toContain('partner')
    expect(validateRegistration({ ...draft, player_two: '', status: 'pending' }, division)).toBe('')
    expect(validateRegistration({ ...draft, player_two: '', status: 'waitlisted' }, division)).toBe('')
  })
  it('rejects duplicate partners and invalid or excessive payments', () => {
    expect(validateRegistration({ ...draft, player_two: 'morgan' }, division)).toContain('different')
    for (const paid_cents of [-1, NaN, 0.5, 8001]) expect(validateRegistration({ ...draft, paid_cents }, division)).not.toBe('')
  })
  it('preserves existing draw entries without inventing paid status or duplicate roster rows', () => {
    const divisions = [{ ...division, id: '40', eventDetails: { feePerPlayer: 40 } }] as TiqTournamentRecord[]
    const legacy = untrackedRegistrations('event', divisions, [])
    expect(legacy[0]).toMatchObject({ player_one: 'Morgan', player_two: 'Lee', paid_cents: 0, fee_cents: 8000, status: 'confirmed' })
    expect(untrackedRegistrations('event', divisions, [row])).toEqual([])
  })
})
