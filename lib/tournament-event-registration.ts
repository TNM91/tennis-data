import type { TiqTournamentRecord } from './tiq-tournament-registry'

export type RegistrationStatus = 'pending' | 'confirmed' | 'waitlisted' | 'withdrawn'
export type EventRegistration = {
  id: string
  event_id: string
  tournament_id: string
  player_one: string
  player_two: string
  entrant_name: string
  status: RegistrationStatus
  fee_cents: number
  paid_cents: number
  note: string
  updated_at: string
}
export type RegistrationDraft = Omit<EventRegistration, 'id' | 'event_id' | 'entrant_name' | 'updated_at'> & {
  id?: string
  expected_updated_at?: string
  original_entrant?: string
}
export function registrationName(one: string, two: string) {
  return [one.trim(), two.trim()].filter(Boolean).join(' / ')
}
export function registrationReadiness(row: EventRegistration, division: Pick<TiqTournamentRecord, 'entrantType' | 'entrants'>) {
  const paired = division.entrantType === 'players' || Boolean(row.player_two.trim())
  const paid = row.paid_cents >= row.fee_cents
  const confirmed = row.status === 'confirmed' && division.entrants.includes(row.entrant_name)
  return { paired, paid, confirmed, ready: paired && paid && confirmed }
}
export function validateRegistration(draft: RegistrationDraft, division: Pick<TiqTournamentRecord, 'entrantType'>) {
  if (!draft.player_one.trim() || draft.player_one.trim().length > 90 || draft.player_two.trim().length > 90) return 'Enter player names of 90 characters or fewer.'
  if (draft.player_two.trim() && draft.player_one.trim().toLowerCase() === draft.player_two.trim().toLowerCase()) return 'Choose two different players.'
  if (division.entrantType === 'players' && draft.player_two.trim()) return 'Singles entries have one player.'
  if (draft.status === 'confirmed' && division.entrantType === 'teams' && !draft.player_two.trim()) return 'Add a partner before confirming this team.'
  if (![draft.fee_cents, draft.paid_cents].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 10000000)) return 'Enter valid fee and payment amounts.'
  if (draft.paid_cents > draft.fee_cents) return 'Payment cannot exceed the recorded entry fee.'
  if (!['pending', 'confirmed', 'waitlisted', 'withdrawn'].includes(draft.status)) return 'Choose a registration status.'
  return ''
}
export function untrackedRegistrations(eventId: string, divisions: TiqTournamentRecord[], rows: EventRegistration[]) {
  return divisions.flatMap(division => division.entrants.filter(name => !rows.some(row => row.tournament_id === division.id && row.entrant_name === name)).map(name => {
    const parts = name.split(/\s+\/\s+/)
    return { id: `existing:${division.id}:${name}`, event_id: eventId, tournament_id: division.id,
      player_one: parts.length === 2 ? parts[0] : name, player_two: parts.length === 2 ? parts[1] : '',
      entrant_name: name, status: 'confirmed' as const, fee_cents: Math.round((division.entrantType === 'teams' ? division.eventDetails?.feePerTeam ?? (division.eventDetails?.feePerPlayer ?? 0) * 2 : division.eventDetails?.feePerPlayer ?? 0) * 100),
      paid_cents: 0, note: '', updated_at: '' }
  }))
}
