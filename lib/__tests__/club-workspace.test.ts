import { describe, expect, it } from 'vitest'
import {
  buildClubCompetitionLaunchHref,
  canRunClubPrograms,
  createClubSlug,
  isClubManager,
  mapClubGroupRow,
  normalizeClubColor,
  normalizeClubRoles,
  type Club,
  type ClubCompetitionTemplate,
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

  it('maps public program types and defaults safely', () => {
    expect(mapClubGroupRow({ id: 'g1', club_id: 'c1', name: 'Green ball', group_type: 'camp' }).groupType).toBe('camp')
    expect(mapClubGroupRow({ id: 'g2', club_id: 'c1', name: 'Unknown', group_type: 'other' }).groupType).toBe('clinic')
  })
})
