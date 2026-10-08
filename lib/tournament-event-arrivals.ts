'use client'

import { supabase } from './supabase'

export type EventArrival = { tournament_id: string; entrant_name: string; checked_in: boolean }

export async function loadEventArrivals(divisionIds: string[]) {
  if (!divisionIds.length) return { data: [] as EventArrival[], error: null }
  const result = await supabase.from('tiq_tournament_arrivals').select('tournament_id,entrant_name,checked_in').in('tournament_id', divisionIds)
  return { data: (result.data || []) as EventArrival[], error: result.error }
}

export async function saveEventArrival(tournamentId: string, entrant: string, checkedIn: boolean) {
  const result = await supabase.from('tiq_tournament_arrivals').upsert({ tournament_id: tournamentId,
    entrant_name: entrant, checked_in: checkedIn }, { onConflict: 'tournament_id,entrant_name' })
    .select('tournament_id,entrant_name,checked_in').single()
  if (result.error || !result.data) throw new Error('Arrival could not be saved. Try again.')
  return result.data as EventArrival
}
