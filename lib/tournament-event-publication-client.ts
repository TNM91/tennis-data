'use client'
import { supabase } from './supabase'
import { loadTiqTournamentEventRecords, readTiqTournamentRegistry, writeTiqTournamentRegistry, type TiqTournamentRecord } from './tiq-tournament-registry'
import { buildEventPublicationReview, eventPublicationVersion } from './tournament-event-publication'

export async function setEventPublication(event: TiqTournamentRecord, divisions: TiqTournamentRecord[], makePublic: boolean, userId: string | null | undefined) {
  if (!userId) throw new Error('Sign in to change event visibility.')
  const loaded = await loadTiqTournamentEventRecords(event.id)
  if (loaded.error) throw new Error('Event review could not refresh. Try again.')
  const current = loaded.data.find(row=>row.id===event.id && row.isEvent)
  const children = loaded.data.filter(row=>row.eventId===event.id)
  if (!current || eventPublicationVersion(current,children)!==eventPublicationVersion(event,divisions)) throw new Error('Event details changed. Refresh the event and review it again.')
  if (makePublic && !buildEventPublicationReview(current,children).ready) throw new Error('Complete the event checklist before publishing.')
  const update = await supabase.from('tiq_tournaments').update({is_public:makePublic, status:makePublic && current.status==='draft' ? 'open' : current.status, updated_by_user_id:userId,updated_at:new Date().toISOString()})
    .eq('id',event.id).eq('is_event',true).eq('updated_at',current.updatedAt).select('id').maybeSingle()
  if (update.error || !update.data) throw new Error('Event visibility could not be saved. Refresh and try again.')
  // The existing database trigger shares visibility with every division in this transaction.
  const refreshed = await loadTiqTournamentEventRecords(event.id)
  if (refreshed.error) throw new Error('Visibility was updated, but the event could not refresh. Reload the event before making another change.')
  const ids=new Set(refreshed.data.map(row=>row.id))
  writeTiqTournamentRegistry([...readTiqTournamentRegistry().filter(row=>!ids.has(row.id)),...refreshed.data])
  return refreshed.data
}
