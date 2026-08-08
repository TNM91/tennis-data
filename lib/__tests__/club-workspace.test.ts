import { describe, expect, it } from 'vitest'
import {
  buildClubCompetitionLaunchHref,
  buildClubToolHref,
  canRunClubPrograms,
  createClubSlug,
  getClubSetupSteps,
  getClubInviteLanding,
  hasClubTeamProgram,
  isClubManager,
  mapClubGroupRow,
  normalizeClubInviteEmails,
  normalizeClubColor,
  normalizeClubRoles,
  type Club,
  type ClubCompetitionTemplate,
  type ClubMembership,
  type ClubWorkspaceData,
} from '../club-workspace'

describe('club workspace', () => {
  it('creates stable public club slugs', () => {
    expect(createClubSlug('  Forest Hills Tennis & Swim Club  ')).toBe('forest-hills-tennis-swim-club')
  })

  it('keeps multi-role club access without accepting unknown roles', () => {
    expect(normalizeClubRoles(['coach', 'player', 'coach', 'billing'])).toEqual(['coach', 'player'])
    expect(isClubManager(['director', 'player'])).toBe(true)
    expect(canRunClubPrograms(['coach', 'player'])).toBe(true)
    expect(canRunClubPrograms(['player'])).toBe(false)
  })

  it('keeps club colors safe', () => {
    expect(normalizeClubColor('#12A4ef')).toBe('#12a4ef')
    expect(normalizeClubColor('lime')).toBe('#9dea16')
  })

  it('launches club competition defaults in the existing desks', () => {
    const club = {
      id: 'club-1',
      slug: 'forest-hills',
      name: 'Forest Hills',
      locationLabel: 'Court Center',
      timeZone: 'America/Chicago',
    } satisfies Pick<Club, 'id' | 'slug' | 'name' | 'locationLabel' | 'timeZone'>
    const template = {
      id: 'template-1',
      clubId: 'club-1',
      name: 'Friday Night Ladder',
      competitionType: 'league',
      entrantType: 'players',
      formatId: 'ladder',
      divisionLabel: '3.5+',
      defaultFacility: '',
      scheduleNotes: '',
      isPublic: true,
      updatedAt: '',
    } satisfies ClubCompetitionTemplate

    const href = buildClubCompetitionLaunchHref(club, template)
    expect(href).toContain('/league-coordinator?')
    expect(href).toContain('clubId=club-1')
    expect(href).toContain('format=ladder')
    expect(href).toContain('facility=Court+Center')
    expect(href).toContain('#league-setup-form')
  })

  it('carries club context into connected tools', () => {
    const href = buildClubToolHref('/coach', {
      id: 'club-1',
      slug: 'forest-hills',
      name: 'Forest Hills Tennis Club',
    })
    expect(href).toBe('/coach?clubId=club-1&clubName=Forest+Hills+Tennis+Club&club=forest-hills')
  })

  it('only promotes Team Hub when the club has an active team program', () => {
    expect(hasClubTeamProgram({ groups: [{ groupType: 'team', isActive: true }] as ClubWorkspaceData['groups'] })).toBe(true)
    expect(hasClubTeamProgram({ groups: [{ groupType: 'clinic', isActive: true }] as ClubWorkspaceData['groups'] })).toBe(false)
    expect(hasClubTeamProgram({ groups: [{ groupType: 'team', isActive: false }] as ClubWorkspaceData['groups'] })).toBe(false)
  })

  it('maps public program types and defaults safely', () => {
    expect(mapClubGroupRow({ id: 'g1', club_id: 'c1', name: 'Green ball', group_type: 'camp' }).groupType).toBe('camp')
    expect(mapClubGroupRow({ id: 'g2', club_id: 'c1', name: 'Unknown', group_type: 'other' }).groupType).toBe('clinic')
    const rolled = mapClubGroupRow({ id: 'g3', club_id: 'c1', name: 'Green ball', group_type: 'clinic', rollover_source_group_id: 'g1' }, ['m1'], ['m2'])
    expect(rolled.sourceGroupId).toBe('g1')
    expect(rolled.memberIds).toEqual(['m1'])
    expect(rolled.reviewMemberIds).toEqual(['m2'])
    const archived = mapClubGroupRow({ id: 'g4', club_id: 'c1', name: 'Spring team', group_type: 'team', is_active: false, closed_at: '2026-08-08T01:00:00Z' })
    expect(archived.isActive).toBe(false)
    expect(archived.closedAt).toBe('2026-08-08T01:00:00Z')
  })

  it('advances the club setup guide from the next unfinished job', () => {
    const club = {
      id: 'club-1',
      ownerUserId: 'user-1',
      name: 'Forest Hills',
      slug: 'forest-hills',
      description: 'Tennis for every level.',
      logoUrl: '',
      heroImageUrl: '',
      primaryColor: '#9dea16',
      locationLabel: 'Court Center',
      contactEmail: '',
      timeZone: 'America/Chicago',
      isPublic: true,
      onboardingCompletedAt: '',
      createdAt: '',
      updatedAt: '',
    } satisfies Club
    const owner: ClubMembership = {
      id: 'membership-1',
      clubId: club.id,
      userId: 'user-1',
      roles: ['owner'],
      status: 'active' as const,
      displayName: 'Club owner',
      email: '',
      phone: '',
      joinedAt: '',
      updatedAt: '',
    }
    const steps = getClubSetupSteps({
      club,
      currentMembership: owner,
      memberships: [owner],
      invites: [
        { id: 'invite-staff', clubId: club.id, email: 'coach@club.test', roles: ['coach'], target: { type: 'club', id: '', name: '' }, inviteToken: 'staff-token', status: 'pending', expiresAt: '', createdAt: '' },
      ],
      groups: [{ id: 'group-1', isActive: true }] as ClubWorkspaceData['groups'],
      templates: [{ id: 'template-1' }] as ClubWorkspaceData['templates'],
      competitions: [],
    })

    expect(steps.map((step) => [step.id, step.completed])).toEqual([
      ['club', true],
      ['staff', true],
      ['players', false],
      ['programs', true],
      ['access', false],
    ])
    expect(steps.find((step) => !step.completed)?.actionLabel).toBe('Invite player')
  })

  it('normalizes pasted invitation emails without duplicates', () => {
    expect(normalizeClubInviteEmails('One@Club.test, two@club.test\nONE@club.test; three@club.test')).toEqual([
      'one@club.test',
      'two@club.test',
      'three@club.test',
    ])
    expect(normalizeClubInviteEmails(['player@club.test', null, 'coach@club.test'])).toEqual(['player@club.test', 'coach@club.test'])
  })

  it('opens each invited role in the most useful club-linked workspace', () => {
    const club = { id: 'club-1', slug: 'forest-hills', name: 'Forest Hills' }

    expect(getClubInviteLanding(club, ['director']).href).toContain('/clubs?')
    expect(getClubInviteLanding(club, ['coach', 'player'])).toMatchObject({ title: 'Coach Hub', actionLabel: 'Open Coach Hub' })
    expect(getClubInviteLanding(club, ['captain', 'player']).href).toContain('/captain?')
    expect(getClubInviteLanding(club, ['coordinator']).href).toContain('/league-coordinator?')
    expect(getClubInviteLanding(club, ['player']).href).toContain('/mylab?')
    expect(getClubInviteLanding(club, ['guardian'])).toMatchObject({ title: 'Club programs' })
  })

  it('opens a scoped invitation in its exact program or competition', () => {
    const club = { id: 'club-1', slug: 'forest-hills', name: 'Forest Hills' }

    expect(getClubInviteLanding(club, ['player'], { type: 'group', id: 'clinic-1', name: 'Orange Ball', groupType: 'clinic' })).toMatchObject({
      title: 'Orange Ball',
      actionLabel: 'Open clinic',
    })
    expect(getClubInviteLanding(club, ['captain', 'player'], { type: 'group', id: 'team-1', name: '3.5 Women', groupType: 'team' }).href).toContain('groupId=team-1')
    expect(getClubInviteLanding(club, ['player'], { type: 'league', id: 'ladder-1', name: 'Friday Ladder' }).href).toContain('/explore/leagues/tiq/ladder-1?')
    expect(getClubInviteLanding(club, ['coordinator'], { type: 'tournament', id: 'open-1', name: 'Club Open' }).href).toContain('/league-coordinator/tournaments?')
  })

  it('does not hide guided setup until access has been shared', () => {
    const workspace = {
      club: { description: 'Connected tennis.', locationLabel: 'Court Center', onboardingCompletedAt: '' },
      currentMembership: { id: 'owner' },
      memberships: [
        { id: 'owner', status: 'active', roles: ['owner'] },
        { id: 'coach', status: 'active', roles: ['coach'] },
        { id: 'player', status: 'active', roles: ['player'] },
      ],
      invites: [],
      groups: [{ id: 'clinic-1', isActive: true }],
      templates: [],
      competitions: [],
    } as unknown as ClubWorkspaceData

    expect(getClubSetupSteps(workspace).at(-1)).toMatchObject({ id: 'access', completed: false })
    workspace.club.onboardingCompletedAt = '2026-08-07T18:30:00Z'
    expect(getClubSetupSteps(workspace).every((step) => step.completed)).toBe(true)
  })
})
