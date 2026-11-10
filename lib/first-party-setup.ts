import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProductAccessState } from './access-model-core'
import { loadEligibleCaptainRoomIds, loadReviewedTeamLinks, readReviewedTeamRooms } from './first-party-team-scopes'
import type { MembershipTierId } from './product-story'
import { buildSetupTracks, type SetupEvidence } from './setup-trophies'

function checked<T>(result: { data: T[] | null; error: unknown }) {
  if (result.error || !Array.isArray(result.data)) throw Error('Setup records unavailable')
  return result.data
}

async function captainEvidence(service: SupabaseClient, owner: string): Promise<SetupEvidence> {
  const links = await loadReviewedTeamLinks(service, owner, readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS))
  const eligible = await loadEligibleCaptainRoomIds(service, owner, links)
  if (!eligible.length) return {}
  const invites = checked(await service.from('team_room_invites').select('accepted_count').eq('created_by_user_id', owner)
    .in('conversation_id', eligible).order('accepted_count', { ascending: false }).limit(1))
  return { team: true, invite: invites.length > 0, teammate: Number(invites[0]?.accepted_count) > 0 }
}

export async function loadFirstPartySetup(db: SupabaseClient, service: SupabaseClient, owner: string, access: ProductAccessState) {
  const tiers: MembershipTierId[] = ['free']
  const reads: Promise<SetupEvidence>[] = []
  if (access.canUseAdvancedPlayerInsights) {
    tiers.push('player_plus')
    reads.push(Promise.all([
      db.from('native_personal_matches').select('id').eq('owner_user_id', owner).limit(1),
      db.from('level_up_sessions').select('id').eq('player_user_id', owner).limit(1),
    ]).then(([scorecards, practices]) => ({ scorecard: checked(scorecards).length > 0, practice: checked(practices).length > 0 })))
  }
  if (access.canUseCoachWorkflow) {
    tiers.push('coach')
    reads.push(Promise.all([
      db.from('coach_player_links').select('id').eq('coach_user_id', owner).limit(1),
      db.from('coach_assignments').select('id').eq('coach_user_id', owner).in('status', ['assigned', 'completed']).limit(1),
    ]).then(([students, assignments]) => ({ student: checked(students).length > 0, assignment: checked(assignments).length > 0 })))
  }
  if (access.canUseCaptainWorkflow) {
    tiers.push('captain')
    reads.push(captainEvidence(service, owner))
  }
  if (access.canUseLeagueTools) {
    tiers.push('league')
    reads.push(Promise.all([
      db.from('tiq_leagues').select('id').eq('created_by_user_id', owner).limit(1),
      db.from('tiq_league_schedule_items').select('id,tiq_leagues!inner(id)').eq('tiq_leagues.created_by_user_id', owner).limit(1),
    ]).then(([seasons, fixtures]) => ({ season: checked(seasons).length > 0, fixture: checked(fixtures).length > 0 })))
  }
  if (access.activePlanIds.includes('full_court')) tiers.push('full_court')
  return buildSetupTracks(tiers, Object.assign({ account: true }, ...await Promise.all(reads)))
}
