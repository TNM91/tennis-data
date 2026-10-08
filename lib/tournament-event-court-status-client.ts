'use client'
import { supabase } from './supabase'
import { courtSlot, type CourtStatus, type EventCourtStatus } from './tournament-event-court-status'
import type { EventDeskMatch } from './tournament-event-desk'
export async function loadEventCourtStatuses(eventId: string) {
 const result = await supabase.from('tiq_event_court_statuses').select('event_id,tournament_id,match_id,status,side_a,side_b,slot,updated_at').eq('event_id', eventId)
 if (result.error) throw new Error('Court status unavailable. Refresh before calling a match.')
 return (result.data || []) as EventCourtStatus[]
}
export async function saveEventCourtStatus(eventId: string, match: EventDeskMatch, status: CourtStatus, version?: string) {
 const result = await supabase.rpc('save_tiq_event_court_status', { target_event: eventId, target_division: match.divisionId, target_match: match.matchId, next_status: status, player_a: match.sideA, player_b: match.sideB, expected_slot: courtSlot(match), expected_version: version || null })
 if (result.error || !result.data) {
  const messages = ['Court status changed. Refresh before saving.', 'Court assignment changed. Refresh before calling.', 'Check in both entrants before calling the match.', 'Call this match before marking it on court.', 'A court or entrant is already called or on court. Finish or undo that call first.', 'Choose an unfinished match with confirmed players.']
  throw new Error(messages.find(message => result.error?.message.includes(message)) || 'Court status could not be saved. Refresh and try again.')
 }
 return result.data as EventCourtStatus
}
