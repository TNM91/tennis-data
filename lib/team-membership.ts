'use client'

import { supabase } from './supabase'
import { loadUserProfileLink } from './user-profile'
import {
  buildTeamMemberships,
  type TeamMembership,
  type TeamRosterMembershipRow,
} from './team-membership-core'

export { buildTeamMemberships, isProfileLinkedToTeam } from './team-membership-core'
export type { TeamMembership } from './team-membership-core'

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

export async function listMyTeamMemberships(userId: string): Promise<TeamMembership[]> {
  const profileResult = await loadUserProfileLink(userId)
  const profile = profileResult.data
  const linkedPlayerId = cleanText(profile?.linked_player_id)

  let rosterRows: TeamRosterMembershipRow[] = []
  if (linkedPlayerId) {
    const { data, error } = await supabase
      .from('team_roster_members')
      .select('team_name, league_name, flight, player_id')
      .eq('player_id', linkedPlayerId)

    if (!error) rosterRows = (data || []) as TeamRosterMembershipRow[]
  }

  return buildTeamMemberships(profile, rosterRows)
}
