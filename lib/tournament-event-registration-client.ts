'use client'
import { supabase } from './supabase'
import type { EventRegistration, RegistrationDraft } from './tournament-event-registration'

export async function loadEventRegistrations(eventId: string) {
  const result = await supabase.from('tiq_event_registrations').select('id,event_id,tournament_id,player_one,player_two,entrant_name,status,fee_cents,paid_cents,note,updated_at').eq('event_id', eventId).order('created_at')
  if (result.error) throw new Error('Registration records could not load. Refresh and try again.')
  return (result.data || []) as EventRegistration[]
}
export async function saveEventRegistration(eventId: string, draft: RegistrationDraft) {
  const result = await supabase.rpc('save_tiq_event_registration', { target_event: eventId, registration: draft })
  if (result.error) {
    const messages = ['Registration changed. Refresh before saving.', 'Clear results before changing the confirmed field.', 'This player is already registered in this division.', 'This team is already in the confirmed field.', 'Court slots are assigned. Clear the division schedule before changing its field.', 'Add a partner before confirming this team.', 'Completed division field cannot be changed.']
    throw new Error(messages.find(message => result.error.message.includes(message)) || 'Registration could not be saved. Refresh and try again.')
  }
  return result.data as EventRegistration
}
