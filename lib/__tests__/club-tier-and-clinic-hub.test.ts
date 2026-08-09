import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getClubCompetitionReadiness, getClubCompetitionRosterHandoff, getClubCompetitionTeamHandoff, getClubProgramLaunchAction, getClubProgramReadinessAction, getLinkableClubCompetitions, needsClubProgramLaunch, type ClubGroupType } from '../club-workspace'
import { CLUB_PLAN_STORY } from '../product-story'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('Club tier and Clinic Hub integration', () => {
  it('brings every Club schedule into one action-first view', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')

    expect(club).toContain("{ id: 'calendar', label: 'Schedule' }")
    expect(club).toContain('Clinics, team matches, leagues, and tournaments in one place.')
    expect(club).toContain('Court booking stays in your club system.')
    expect(clubRoute).toContain("type: 'clinic'")
    expect(clubRoute).toContain("type: 'team_match'")
    expect(clubRoute).toContain("type: 'league_match'")
    expect(clubRoute).toContain("type: 'tournament_match'")
    expect(clubRoute).toContain('calendarEvents.sort')
  })

  it('turns the Club home into a role-aware daily pulse', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const styles = source('app/components/club-workspace.module.css')

    expect(club).toContain('Club pulse')
    expect(club).toContain('Schedule checks')
    expect(club).toContain('Results to add')
    expect(club).toContain('Roster follow-ups')
    expect(club).toContain('getVisibleClubCalendarEvents')
    expect(club).not.toContain('Connected club value')
    expect(club).toContain('Share weekly brief')
    expect(club).toContain('navigator.share')
    expect(club).toContain('navigator.clipboard.writeText(text)')
    expect(club).toContain('Post to chat')
    expect(club).toContain("action: 'send'")
    expect(club).toContain("kind: 'announcement'")
    expect(club).toContain('Open chat')
    expect(club).toContain('Announcements')
    expect(club).toContain('Send and reuse clear updates.')
    expect(club).toContain('Promise.allSettled')
    expect(club).toContain('Publish to ${selectedTargets.length || 0}')
    expect(club).toContain('setSelectedIds(failed.map')
    expect(club).toContain('History')
    expect(club).toContain('Use again')
    expect(club).toContain('onLoadHistory')
    expect(club).toContain('onRecordHistory')
    expect(clubRoute).toContain('resultLookback')
    expect(clubRoute).toContain('needsResult: date < today')
    expect(clubRoute).toContain("from('team_profile_links')")
    expect(clubRoute).toContain('teamChatScopeByGroupId')
    expect(styles).toContain('.clubPulseStats { grid-template-columns: repeat(2, minmax(0, 1fr)); }')
    expect(styles).toContain('.clubPulsePost { grid-template-columns: 1fr; }')
    expect(styles).toContain('.clubAnnouncementBackdrop { align-items: end; padding: 8px; }')
    expect(styles).toContain('.clubAnnouncementTargets > div:last-child { grid-template-columns: 1fr; }')
    expect(styles).toContain('.clubAnnouncementTabs')
    expect(styles).toContain('.clubAnnouncementHistory')
  })

  it('keeps a shared, immutable receipt for every Club announcement', () => {
    const route = source('app/api/clubs/[clubId]/announcements/route.ts')
    const migration = source('supabase/migrations/20260808000700_create_club_announcement_history.sql')

    expect(route).toContain("from('club_announcement_history')")
    expect(route).toContain('canRunClubPrograms')
    expect(route).toContain(".limit(40)")
    expect(route).toContain('author_name: membership.name')
    expect(migration).toContain('create table if not exists public.club_announcement_history')
    expect(migration).toContain('Club staff can read announcement history')
    expect(migration).not.toContain('for update')
    expect(migration).not.toContain('for delete')
  })

  it('defines Club as a separate offering without claiming club operations', () => {
    expect(CLUB_PLAN_STORY.starter.priceLabel).toBe('$99/month')
    expect(CLUB_PLAN_STORY.unlimited.priceLabel).toBe('$199/month')
    expect(CLUB_PLAN_STORY.boundary).toContain('does not replace court booking')
    expect(CLUB_PLAN_STORY.starter.description).toContain('registration or payment system')
  })

  it('houses Clinic Hub inside the Club lane', () => {
    const portal = source('app/components/portal-tool-bar.tsx')
    const club = source('app/components/club-workspace.tsx')
    const clinic = source('app/components/clinic-hub.tsx')
    expect(portal).toContain("id: 'club'")
    expect(portal).toContain("route: '/clubs'")
    expect(portal).toContain("title: 'Run clinics'")
    expect(club).toContain('Open Clinic Hub')
    expect(clinic).toContain('Roster + waitlist')
    expect(clinic).toContain('Recurring schedule')
    expect(clinic).toContain('Coach plan')
    expect(clinic).toContain('Attendance')
    expect(clinic).toContain('Clinic updates')
  })

  it('lets club managers share and revoke pending invitations', () => {
    const club = source('app/components/club-workspace.tsx')
    const memberRoute = source('app/api/clubs/[clubId]/members/route.ts')
    expect(club).toContain('Share invite')
    expect(club).toContain('Revoke this invitation?')
    expect(memberRoute).toContain('export async function DELETE')
    expect(memberRoute).toContain("update({ status: 'revoked' })")
    expect(memberRoute).toContain(".eq('status', 'pending')")
  })

  it('supports one bulk invitation flow for club programs and competition', () => {
    const club = source('app/components/club-workspace.tsx')
    const memberRoute = source('app/api/clubs/[clubId]/members/route.ts')
    expect(club).toContain('One email or up to 50')
    expect(club).toContain('invite links')
    expect(memberRoute).toContain('Invite up to 50 people at a time.')
    expect(memberRoute).toContain('.insert(newEmails.map')
    expect(memberRoute).toContain('already has a pending invitation here')
  })

  it('brings imported Player Roster contacts into Club People', () => {
    const club = source('app/components/club-workspace.tsx')
    const rosterRoute = source('app/api/clubs/[clubId]/roster-contacts/route.ts')
    const dataAssist = source('app/data-assist/page.tsx')
    expect(club).toContain('Use Player Roster')
    expect(club).toContain('Only new, email-ready people are selected.')
    expect(club).toContain('Upload or refresh roster')
    expect(rosterRoute).toContain("from('captain_roster_contacts')")
    expect(rosterRoute).toContain('isClubManager')
    expect(dataAssist).toContain("path === '/clubs' || path.startsWith('/clubs?')")
    expect(dataAssist).toContain('Return to Club People')
  })

  it('lets the uploader safely share one roster with other club managers', () => {
    const club = source('app/components/club-workspace.tsx')
    const rosterRoute = source('app/api/clubs/[clubId]/roster-contacts/route.ts')
    const migration = source('supabase/migrations/20260807000600_share_club_roster_contacts.sql')
    expect(club).toContain('Share with club')
    expect(club).toContain('Stop sharing')
    expect(club).toContain('Remove from club')
    expect(club).toContain('Shared by')
    expect(rosterRoute).toContain('export async function PATCH')
    expect(rosterRoute).toContain('Only the manager who imported this roster')
    expect(rosterRoute).toContain("from('club_roster_contact_shares')")
    expect(rosterRoute).toContain(".delete()")
    expect(migration).toContain('Club managers read shared roster contacts')
    expect(migration).toContain('public.can_manage_club(club_id)')
    expect(migration).toContain('Explicit, revocable permission')
  })

  it('reconciles imported contacts before creating Club invitations', () => {
    const club = source('app/components/club-workspace.tsx')
    const rosterRoute = source('app/api/clubs/[clubId]/roster-contacts/route.ts')
    const memberRoute = source('app/api/clubs/[clubId]/members/route.ts')
    const reconciliation = source('lib/club-roster-reconciliation.ts')
    expect(reconciliation).toContain('Already connected')
    expect(reconciliation).toContain('Invite pending')
    expect(club).toContain("contact.connectionStatus === 'ready' || (contact.connectionStatus === 'connected'")
    expect(rosterRoute).toContain('getClubRosterConnectionStatus')
    expect(rosterRoute).toContain(".select('id,user_id,display_name,email,phone,status')")
    expect(memberRoute).toContain('connectedEmails')
    expect(memberRoute).toContain(".gt('expires_at', new Date().toISOString())")
    expect(memberRoute).toContain('already connected or invited')
  })

  it('places connected players directly into Club programs and player competitions', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const rosterRoute = source('app/api/clubs/[clubId]/roster-contacts/route.ts')
    const migration = source('supabase/migrations/20260807000700_allow_club_staff_direct_entries.sql')
    expect(club).toContain('Add connected players to')
    expect(club).toContain('No invitation is sent.')
    expect(club).toContain('Select to add directly')
    expect(clubRoute).toContain("select('id,club_group_id,league_name,league_format,season_status,location_label,teams,players,is_public')")
    expect(clubRoute).toContain("select('id,club_group_id,name,entrant_type,status,starts_on,location_label,entrants,results,schedule,is_public')")
    expect(rosterRoute).toContain('export async function PUT')
    expect(rosterRoute).toContain("from('club_group_members').upsert")
    expect(rosterRoute).toContain("from('tiq_player_league_entries')")
    expect(rosterRoute).toContain("from('tiq_tournament_entries')")
    expect(rosterRoute).toContain('This league accepts teams.')
    expect(rosterRoute).toContain('This tournament accepts teams.')
    expect(migration).toContain('Club staff can add player league entries')
    expect(migration).toContain('Club staff can add approved tournament entries')
  })

  it('shows and safely changes each connected player destination', () => {
    const club = source('app/components/club-workspace.tsx')
    const rosterRoute = source('app/api/clubs/[clubId]/roster-contacts/route.ts')
    const migration = source('supabase/migrations/20260807000800_link_club_memberships_to_entries.sql')
    expect(club).toContain('Already in {item.name}')
    expect(club).toContain('Move player')
    expect(club).toContain('removeConnectedPlayer')
    expect(club).toContain('window.confirm(`Remove ${contact.fullName} from ${destination.name}?`)')
    expect(rosterRoute).toContain('connectedDestinations:')
    expect(rosterRoute).toContain('export async function DELETE')
    expect(rosterRoute).toContain(".in('club_membership_id', membershipIds)")
    expect(migration).toContain('add column if not exists club_membership_id')
    expect(migration).toContain('Club staff can remove player league entries')
    expect(migration).toContain('Club staff can remove tournament entries')
  })

  it('keeps the full Club roster searchable, filtered, and ready for bulk placement', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const workspace = source('lib/club-workspace.ts')
    expect(club).toContain('Name, email, phone, or role')
    expect(club).toContain("{ id: 'unassigned', label: 'Unassigned' }")
    expect(club).toContain('Unassigned first')
    expect(club).toContain('Select results')
    expect(club).toContain('Invite by email')
    expect(club).toContain("updatePeopleAssignments('add')")
    expect(club).toContain("updatePeopleAssignments('remove')")
    expect(clubRoute).toContain("select('league_id,club_membership_id,entry_status')")
    expect(clubRoute).toContain("select('tournament_id,club_membership_id,status')")
    expect(clubRoute).toContain('memberIds: memberIdsByLeague')
    expect(clubRoute).toContain('memberIds: memberIdsByTournament')
    expect(workspace).toContain('memberIds: string[]')
  })

  it('carries programs into a new season without erasing prior-season history', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const groupRoute = source('app/api/clubs/[clubId]/groups/route.ts')
    const migration = source('supabase/migrations/20260807000900_add_club_program_rollover_lineage.sql')
    const draftMigration = source('supabase/migrations/20260808000600_allow_empty_competition_drafts.sql')
    expect(club).toContain('Start next season')
    expect(club).toContain('Bring current players over for review')
    expect(club).toContain('Review returning players')
    expect(club).toContain('The current season stays intact.')
    expect(groupRoute).toContain('export async function PUT')
    expect(groupRoute).toContain("status: 'waitlist'")
    expect(groupRoute).toContain('Carry programs forward from one season at a time.')
    expect(groupRoute).toContain('rollover_source_group_id: group.id')
    expect(club).toContain('a fresh competition draft')
    expect(club).toContain('fresh competition drafts')
    expect(club).toContain('entries, dates, schedules, and results start fresh')
    expect(groupRoute).toContain('copyCompetitionSetup')
    expect(groupRoute).toContain('teams: []')
    expect(groupRoute).toContain('entrants: []')
    expect(groupRoute).toContain('competitionCount')
    expect(clubRoute).toContain("row.status === 'waitlist'")
    expect(migration).toContain('rollover_source_group_id')
    expect(migration).toContain('club_groups_rollover_once_per_season_idx')
    expect(draftMigration).toContain("season_status = 'draft'")
    expect(draftMigration).toContain("status = 'draft' or cardinality(entrants) >= 2")
  })

  it('closes finished Club seasons into read-only history without deleting rosters', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const groupRoute = source('app/api/clubs/[clubId]/groups/route.ts')
    const migration = source('supabase/migrations/20260807001000_add_club_program_archive.sql')
    expect(club).toContain('Manage seasons')
    expect(club).toContain('Season history')
    expect(club).toContain('View archived roster')
    expect(club).toContain("onSeasonAction('close-season'")
    expect(club).toContain("onSeasonAction('reopen-season'")
    expect(groupRoute).toContain("action === 'close-season' || action === 'reopen-season'")
    expect(groupRoute).toContain('closed_at: new Date().toISOString()')
    expect(groupRoute).toContain(".eq('is_active', true).maybeSingle()")
    expect(clubRoute).not.toContain(".eq('club_id', club.id).eq('is_active', true)")
    expect(migration).toContain('closed_at timestamptz')
    expect(migration).toContain('is_active')
    expect(migration).toContain('public.is_club_member(club_id)')
  })

  it('collects returning-player decisions through private free renewal links', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const managerRoute = source('app/api/clubs/[clubId]/groups/[groupId]/renewals/route.ts')
    const responseRoute = source('app/api/clubs/renewals/[token]/route.ts')
    const responseClient = source('app/components/club-renewal-response.tsx')
    const migration = source('supabase/migrations/20260807001100_add_club_program_renewals.sql')
    expect(club).toContain('Request player decisions')
    expect(club).toContain('Copy waiting reminders')
    expect(club).toContain('Refresh responses')
    expect(club).toContain('/clubs/renew/')
    expect(club).toContain('Yes adds the player; no removes them from this season.')
    expect(managerRoute).toContain(".eq('status', 'waitlist')")
    expect(managerRoute).toContain('responseToken')
    expect(responseRoute).toContain('respond_club_group_renewal')
    expect(responseClient).toContain('Yes, I am returning')
    expect(responseClient).toContain('No, not this season')
    expect(clubRoute).toContain("from('club_group_renewals')")
    expect(clubRoute).toContain('renewalPendingCount')
    expect(migration).toContain('response_token uuid not null default gen_random_uuid() unique')
    expect(migration).toContain("status in ('pending', 'confirmed', 'declined')")
    expect(migration).toContain("case when target_status = 'confirmed' then 'active' else 'inactive' end")
  })

  it('puts unanswered Club renewals on Home with one-touch reminders', () => {
    const club = source('app/components/club-workspace.tsx')
    const managerRoute = source('app/api/clubs/[clubId]/groups/[groupId]/renewals/route.ts')
    expect(club).toContain("group.isActive && group.renewalPendingCount > 0")
    expect(club).toContain('Copy pending reminders')
    expect(club).toContain('Review responses')
    expect(club).toContain(".filter((renewal) => renewal.status === 'pending')")
    expect(club).toContain("messages.join('\\n\\n')")
    expect(managerRoute).toContain("import { randomUUID } from 'node:crypto'")
    expect(managerRoute).toContain("cleanClubText(renewal.status) === 'pending'")
    expect(managerRoute).toContain('Expired renewal links could not be refreshed.')
  })

  it('replaces completed renewal reminders with a protected roster finalization flow', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const managerRoute = source('app/api/clubs/[clubId]/groups/[groupId]/renewals/route.ts')
    const responseRoute = source('app/api/clubs/renewals/[token]/route.ts')
    const responseClient = source('app/components/club-renewal-response.tsx')
    const migration = source('supabase/migrations/20260808000100_add_club_renewal_finalization.sql')
    expect(club).toContain('Review and finalize')
    expect(club).toContain('Final roster check')
    expect(club).toContain('Finalize roster')
    expect(club).toContain('Roster finalized')
    expect(club).toContain('Renewal decisions are closed.')
    expect(clubRoute).toContain('renewals_finalized_at')
    expect(managerRoute).toContain('export async function PATCH')
    expect(managerRoute).toContain('There are no renewal responses to finalize.')
    expect(managerRoute).toContain(".is('renewals_finalized_at', null)")
    expect(responseRoute).toContain('finalized: Boolean(row.finalized_at)')
    expect(responseClient).toContain('Roster finalized.')
    expect(migration).toContain('renewals_finalized_at timestamptz')
    expect(migration).toContain('club_group.renewals_finalized_at is null')
    expect(migration).toContain('This renewal decision is closed or unavailable.')
  })

  it('promotes real post-renewal openings into the connected Club people flow', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const managerRoute = source('app/api/clubs/[clubId]/groups/[groupId]/renewals/route.ts')
    const migration = source('supabase/migrations/20260808000200_add_club_renewal_fill_tracking.sql')
    expect(club).toContain('Fill open spots')
    expect(club).toContain('No replacements needed')
    expect(club).toContain('Add Club members, use Player Roster contacts, or invite someone new.')
    expect(club).toContain("openPeople(`group:${groupId}`, true)")
    expect(club).toContain('group.renewalTargetRosterSize - group.memberIds.length')
    expect(clubRoute).toContain('renewal_target_roster_size')
    expect(clubRoute).toContain('renewal_fill_completed_at')
    expect(managerRoute).toContain("action === 'complete-fill'")
    expect(managerRoute).toContain('targetRosterSize')
    expect(managerRoute).toContain(".eq('status', 'active')")
    expect(migration).toContain('renewal_target_roster_size integer')
    expect(migration).toContain('renewal_fill_completed_at timestamptz')
    expect(migration).toContain('club_group_renewals')
  })

  it('promotes a roster-ready program into its one connected launch action', () => {
    const club = source('app/components/club-workspace.tsx')
    const clinic = source('app/components/clinic-hub.tsx')
    const clinicPage = source('app/clubs/clinics/[groupId]/page.tsx')
    const groupRoute = source('app/api/clubs/[clubId]/groups/route.ts')
    const migration = source('supabase/migrations/20260808000300_add_club_program_launch_handoff.sql')
    const clubIdentity = { id: 'club-1', name: 'Vetta Racquet Sports', slug: 'vetta' }
    const actionFor = (groupType: ClubGroupType) => getClubProgramLaunchAction({ id: `${groupType}-1`, name: 'Fall program', groupType }, clubIdentity)

    expect(actionFor('clinic').label).toBe('Add clinic schedule')
    expect(actionFor('clinic').href).toContain('tab=schedule')
    expect(actionFor('team').href).toContain('/captain?')
    expect(actionFor('camp').syncCoachRoster).toBe(true)
    expect(actionFor('development_group').href).toContain('/coach?')
    expect(actionFor('league_division').href).toContain('/league-coordinator?')
    expect(actionFor('tournament_field').href).toContain('/league-coordinator/tournaments?')
    expect(club).toContain('Ready to launch')
    expect(club).toContain("action: 'mark-launched'")
    expect(club).toContain('workspace.groups.filter(needsClubProgramLaunch)')
    expect(clinic).toContain('buildClinicReturnPath')
    expect(clinicPage).toContain('initialTab={initialTab}')
    expect(groupRoute).toContain("action === 'mark-launched'")
    expect(migration).toContain('launch_handoff_completed_at timestamptz')
  })

  it('keeps clinic launch work open until the real schedule exists', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const workspace = source('lib/club-workspace.ts')
    expect(clubRoute).toContain("from('club_clinic_sessions')")
    expect(clubRoute).toContain(".neq('status', 'canceled')")
    expect(clubRoute).toContain('clinicSessionCount: clinicSchedule.count')
    expect(clubRoute).toContain('nextClinicSessionAt: clinicSchedule.nextAt')
    expect(workspace).toContain('clinicSessionCount: number')
    expect(workspace).toContain('nextClinicSessionAt: string')
    const clinicState = { isActive: true, memberIds: ['player-1'], reviewMemberIds: [], groupType: 'clinic' as const, clinicSessionCount: 0, launchHandoffCompletedAt: '2026-08-08T10:00:00.000Z' }
    expect(needsClubProgramLaunch(clinicState)).toBe(true)
    expect(needsClubProgramLaunch({ ...clinicState, clinicSessionCount: 8 })).toBe(false)
    expect(needsClubProgramLaunch({ ...clinicState, reviewMemberIds: ['player-1'] })).toBe(false)
    expect(club).toContain('workspace.groups.filter(needsClubProgramLaunch)')
    expect(club).toContain('still needs its first date.')
    expect(club).toContain('Schedule ready')
    expect(club).toContain('Schedule not added')
    expect(club).toContain('Next session')
  })

  it('keeps team setup open until the Player Roster and schedule exist', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const clubIdentity = { id: 'club-1', name: 'Vetta Racquet Sports', slug: 'vetta' }
    const teamState = {
      id: 'team-1',
      name: 'Vetta 4.0',
      groupType: 'team' as const,
      isActive: true,
      memberIds: ['player-1'],
      reviewMemberIds: [],
      launchHandoffCompletedAt: '2026-08-08T10:00:00.000Z',
      teamRosterCount: 0,
      teamMatchCount: 0,
    }

    expect(getClubProgramReadinessAction(teamState, clubIdentity).label).toBe('Add Player Roster')
    expect(getClubProgramReadinessAction({ ...teamState, teamRosterCount: 12 }, clubIdentity).label).toBe('Add team schedule')
    expect(getClubProgramReadinessAction({ ...teamState, teamRosterCount: 12, teamMatchCount: 8 }, clubIdentity).label).toBe('Open Team Hub')
    expect(needsClubProgramLaunch(teamState)).toBe(true)
    expect(needsClubProgramLaunch({ ...teamState, teamRosterCount: 12 })).toBe(true)
    expect(needsClubProgramLaunch({ ...teamState, teamRosterCount: 12, teamMatchCount: 8 })).toBe(false)
    expect(clubRoute).toContain("from('team_roster_members')")
    expect(clubRoute).toContain("from('matches')")
    expect(clubRoute).toContain(".is('line_number', null)")
    expect(clubRoute).toContain('teamRosterCount: teamReadiness.rosterCount')
    expect(clubRoute).toContain('nextTeamMatchAt: teamReadiness.nextAt')
    expect(club).toContain('Player Roster not connected')
    expect(club).toContain('Team ready')
    expect(club).toContain('Next match')
  })

  it('keeps coach programs open until players have plans and a next session', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const coachPage = source('app/coach/page.tsx')
    const coachSyncRoute = source('app/api/clubs/[clubId]/coach-sync/route.ts')
    const clubIdentity = { id: 'club-1', name: 'Vetta Racquet Sports', slug: 'vetta' }
    const coachState = {
      id: 'development-1',
      name: 'High Performance 14U',
      groupType: 'development_group' as const,
      isActive: true,
      memberIds: ['player-1', 'player-2'],
      reviewMemberIds: [],
      launchHandoffCompletedAt: '2026-08-08T10:00:00.000Z',
      coachExpectedPlayerCount: 2,
      coachLinkedPlayerCount: 0,
      coachPlannedPlayerCount: 0,
      nextCoachSessionAt: '',
      coachActionPlayerLinkId: 'club-club-1-membership-1',
    }

    const connectAction = getClubProgramReadinessAction(coachState, clubIdentity)
    expect(connectAction.label).toBe('Connect Coach roster')
    expect(connectAction.syncCoachRoster).toBe(true)
    expect(connectAction.href).toContain('firstAssignment=1')
    expect(connectAction.href).toContain('studentLinkId=club-club-1-membership-1')
    expect(getClubProgramReadinessAction({ ...coachState, coachLinkedPlayerCount: 2 }, clubIdentity).label).toBe('Add player plans')
    expect(getClubProgramReadinessAction({ ...coachState, coachLinkedPlayerCount: 2, coachPlannedPlayerCount: 2 }, clubIdentity).label).toBe('Schedule next session')
    expect(getClubProgramReadinessAction({ ...coachState, coachLinkedPlayerCount: 2, coachPlannedPlayerCount: 2, nextCoachSessionAt: '2026-08-15T15:00:00.000Z' }, clubIdentity).label).toBe('Open Coach Hub')
    expect(needsClubProgramLaunch(coachState)).toBe(true)
    expect(needsClubProgramLaunch({ ...coachState, coachLinkedPlayerCount: 2, coachPlannedPlayerCount: 2, nextCoachSessionAt: '2026-08-15T15:00:00.000Z' })).toBe(false)
    expect(clubRoute).toContain("from('coach_player_links')")
    expect(clubRoute).toContain("from('coach_assignments')")
    expect(clubRoute).toContain('coachExpectedPlayerCount: coachReadiness.expectedCount')
    expect(clubRoute).toContain('nextCoachSessionAt: coachReadiness.nextAt')
    expect(coachPage).toContain('clubGroupId: requestedClubGroupId')
    expect(coachSyncRoute).toContain('buildClubCoachStudentLinkId')
    expect(club).toContain('Coach plan ready')
    expect(club).toContain('Next session not added')
  })

  it('keeps Club competition work open until entries and a schedule or draw exist', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')

    expect(getClubCompetitionReadiness({ type: 'league', entryCount: 1, scheduleCount: 0, nextEventAt: '' }).actionLabel).toBe('Add entries')
    expect(getClubCompetitionReadiness({ type: 'league', entryCount: 8, scheduleCount: 0, nextEventAt: '' }).actionLabel).toBe('Build schedule')
    expect(getClubCompetitionReadiness({ type: 'tournament', entryCount: 16, scheduleCount: 0, nextEventAt: '' }).actionLabel).toBe('Build draw')
    expect(getClubCompetitionReadiness({ type: 'tournament', entryCount: 16, scheduleCount: 15, nextEventAt: '2026-08-15T09:00:00' }).ready).toBe(true)
    expect(clubRoute).toContain("from('tiq_team_league_entries')")
    expect(clubRoute).toContain("from('tiq_league_schedule_items')")
    expect(clubRoute).toContain('entryCount: Math.max')
    expect(clubRoute).toContain('scheduleCount: Math.max')
    expect(club).toContain('Finish competition')
    expect(club).toContain('competitionNeedsWork')
    expect(club).toContain('See what is ready and finish the one missing step.')
  })

  it('keeps each Club competition program linked to the exact league or tournament it creates', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const leagueOffice = source('app/components/league-coordinator-workspace.tsx')
    const tournamentDesk = source('app/components/tournament-builder-workspace.tsx')
    const leagueRegistry = source('lib/tiq-league-registry.ts')
    const tournamentRegistry = source('lib/tiq-tournament-registry.ts')
    const migration = source('supabase/migrations/20260808000400_link_club_programs_to_competitions.sql')
    const clubIdentity = { id: 'club-1', name: 'Vetta Racquet Sports', slug: 'vetta' }
    const linkedLeague = {
      id: 'league-group-1',
      name: 'Friday League',
      groupType: 'league_division' as const,
      linkedCompetitionId: 'friday-league-2026',
      competitionEntryCount: 8,
      competitionScheduleCount: 0,
    }

    expect(getClubProgramReadinessAction(linkedLeague, clubIdentity).label).toBe('Build league schedule')
    expect(getClubProgramReadinessAction(linkedLeague, clubIdentity).href).toContain('leagueId=friday-league-2026')
    expect(getClubProgramReadinessAction({ ...linkedLeague, competitionScheduleCount: 10 }, clubIdentity).label).toBe('Open league')
    expect(needsClubProgramLaunch({ ...linkedLeague, isActive: true, memberIds: [], reviewMemberIds: [], launchHandoffCompletedAt: '' })).toBe(true)
    expect(needsClubProgramLaunch({ ...linkedLeague, competitionScheduleCount: 10, isActive: true, memberIds: [], reviewMemberIds: [], launchHandoffCompletedAt: '' })).toBe(false)
    expect(leagueOffice).toContain("searchParams.get('groupId')")
    expect(leagueOffice).toContain('clubGroupId: requestedClubGroupId')
    expect(tournamentDesk).toContain("requestParams.get('groupId')")
    expect(tournamentDesk).toContain('clubGroupId,')
    expect(leagueRegistry).toContain('clubGroupId?: string')
    expect(tournamentRegistry).toContain('club_group_id: cleanText(record.clubGroupId) || null')
    expect(clubRoute).toContain('competitionByGroupId')
    expect(clubRoute).toContain('linkedCompetitionId: linkedCompetition?.id')
    expect(club).toContain('Competition not connected')
    expect(club).toContain('Competition ready')
    expect(migration).toContain('club_group_id uuid references public.club_groups(id)')
    expect(migration).toContain('tiq_leagues_club_group_unique')
    expect(migration).toContain('tiq_tournaments_club_group_unique')
  })

  it('connects older Club programs to compatible existing competitions', () => {
    const club = source('app/components/club-workspace.tsx')
    const linkRoute = source('app/api/clubs/[clubId]/groups/[groupId]/competition/route.ts')
    const competitions = [
      { id: 'league-1', clubGroupId: '', name: 'Friday League', type: 'league' as const, entrantType: 'teams' as const, memberIds: [], status: 'draft', isPublic: true, href: '/league-coordinator', entryCount: 8, scheduleCount: 0, nextEventAt: '' },
      { id: 'league-2', clubGroupId: 'group-2', name: 'Linked League', type: 'league' as const, entrantType: 'players' as const, memberIds: [], status: 'draft', isPublic: true, href: '/league-coordinator', entryCount: 4, scheduleCount: 0, nextEventAt: '' },
      { id: 'tournament-1', clubGroupId: '', name: 'Club Open', type: 'tournament' as const, entrantType: 'players' as const, memberIds: [], status: 'draft', isPublic: true, href: '/league-coordinator/tournaments', entryCount: 16, scheduleCount: 0, nextEventAt: '' },
    ]

    expect(getLinkableClubCompetitions({ groupType: 'league_division', linkedCompetitionId: '' }, competitions).map((item) => item.id)).toEqual(['league-1'])
    expect(getLinkableClubCompetitions({ groupType: 'tournament_field', linkedCompetitionId: '' }, competitions).map((item) => item.id)).toEqual(['tournament-1'])
    expect(getLinkableClubCompetitions({ groupType: 'team', linkedCompetitionId: '' }, competitions)).toEqual([])
    expect(getLinkableClubCompetitions({ groupType: 'league_division', linkedCompetitionId: 'league-1' }, competitions)).toEqual([])
    expect(club).toContain('Connect existing')
    expect(club).toContain('/competition`')
    expect(linkRoute).toContain("groupType === 'league_division'")
    expect(linkRoute).toContain(".eq('club_id', clubId)")
    expect(linkRoute).toContain('club_group_id: groupId')
    expect(linkRoute).toContain('already connected to another Club program')
  })

  it('hands connected Club players into linked player competitions without duplicate entries', () => {
    const club = source('app/components/club-workspace.tsx')
    const rosterRoute = source('app/api/clubs/[clubId]/roster-contacts/route.ts')
    const competition = { id: 'league-1', clubGroupId: 'group-1', name: 'Friday League', type: 'league' as const, entrantType: 'players' as const, memberIds: ['member-1'], status: 'draft', isPublic: true, href: '/league-coordinator', entryCount: 1, scheduleCount: 0, nextEventAt: '' }
    const memberships = [
      { id: 'member-1', clubId: 'club-1', userId: 'user-1', roles: ['player' as const], status: 'active' as const, displayName: 'One', email: '', phone: '', joinedAt: '', updatedAt: '' },
      { id: 'member-2', clubId: 'club-1', userId: 'user-2', roles: ['player' as const], status: 'active' as const, displayName: 'Two', email: '', phone: '', joinedAt: '', updatedAt: '' },
      { id: 'member-3', clubId: 'club-1', userId: 'user-3', roles: ['player' as const], status: 'inactive' as const, displayName: 'Three', email: '', phone: '', joinedAt: '', updatedAt: '' },
    ]
    const handoff = getClubCompetitionRosterHandoff({ linkedCompetitionId: 'league-1', linkedCompetitionType: 'league', memberIds: ['member-1', 'member-2', 'member-3'] }, [competition], memberships)

    expect(handoff?.eligibleMemberIds).toEqual(['member-1', 'member-2'])
    expect(handoff?.missingMemberIds).toEqual(['member-2'])
    expect(handoff?.connectedCount).toBe(1)
    expect(getClubCompetitionRosterHandoff({ linkedCompetitionId: 'league-1', linkedCompetitionType: 'league', memberIds: ['member-1'] }, [{ ...competition, entrantType: 'teams' }], memberships)).toBeNull()
    expect(club).toContain('Add ${nextRosterHandoff.missingMemberIds.length} Club')
    expect(club).toContain('Club roster connected')
    expect(club).toContain("method: 'PUT'")
    expect(rosterRoute).toContain('existingMatches')
    expect(rosterRoute).toContain('missingEntrants')
    expect(rosterRoute).toContain('normalizeComparable(entry.player_name)')
  })

  it('lets staff choose Club teams for linked team competitions without duplicate names', () => {
    const club = source('app/components/club-workspace.tsx')
    const clubRoute = source('app/api/clubs/route.ts')
    const competitionRoute = source('app/api/clubs/[clubId]/groups/[groupId]/competition/route.ts')
    const migration = source('supabase/migrations/20260808000500_allow_club_staff_team_entries.sql')
    const competition = { id: 'league-1', clubGroupId: 'division-1', name: 'Friday League', type: 'league' as const, entrantType: 'teams' as const, memberIds: [], entryNames: ['Existing Team'], status: 'draft', isPublic: true, href: '/league-coordinator', entryCount: 1, scheduleCount: 0, nextEventAt: '' }
    const groups = [
      { id: 'team-1', name: 'Existing Team', groupType: 'team' as const, seasonLabel: 'Winter 2027', sourceGroupId: '', isActive: true, memberIds: [], reviewMemberIds: [] },
      { id: 'team-2', name: 'New Team', groupType: 'team' as const, seasonLabel: 'Winter 2027', sourceGroupId: 'old-team-2', isActive: true, memberIds: ['member-1'], reviewMemberIds: [] },
      { id: 'team-3', name: 'Closed Team', groupType: 'team' as const, seasonLabel: 'Winter 2027', sourceGroupId: '', isActive: false, memberIds: [], reviewMemberIds: [] },
      { id: 'team-4', name: 'Prior Season Team', groupType: 'team' as const, seasonLabel: 'Fall 2026', sourceGroupId: '', isActive: true, memberIds: ['member-2'], reviewMemberIds: [] },
      { id: 'team-5', name: 'Waiting Team', groupType: 'team' as const, seasonLabel: 'Winter 2027', sourceGroupId: 'old-team-5', isActive: true, memberIds: [], reviewMemberIds: ['member-3'] },
    ]
    const handoff = getClubCompetitionTeamHandoff({ linkedCompetitionId: 'league-1', linkedCompetitionType: 'league', seasonLabel: 'Winter 2027' }, [competition], groups)

    expect(handoff?.eligibleTeams.map((team) => team.id)).toEqual(['team-1', 'team-2'])
    expect(handoff?.missingTeams.map((team) => team.id)).toEqual(['team-2'])
    expect(handoff?.connectedCount).toBe(1)
    expect(club).toContain('Choose Club teams')
    expect(club).toContain('Teams entering')
    expect(clubRoute).toContain('entryNames:')
    expect(competitionRoute).toContain("from('tiq_team_league_entries')")
    expect(competitionRoute).toContain('normalizeEntryName(entry.team_name)')
    expect(competitionRoute).toContain('nextEntrants')
    expect(migration).toContain('Club staff can add team league entries')
    expect(migration).toContain('Club staff can update team league entries')
  })
})
