import { describe, expect, it } from 'vitest'
import {
  buildTiqLeagueRenewalDraft,
  canDeleteLeagueWithConfirmation,
  canManageLeagueAsOwner,
  normalizeLeagueDeleteConfirmation,
} from '../league-lifecycle'
import type { TiqLeagueRecord } from '../tiq-league-registry'

const league: TiqLeagueRecord = {
  id: 'league-1',
  createdByUserId: 'owner-1',
  competitionLayer: 'tiq',
  leagueFormat: 'individual',
  individualCompetitionFormat: 'round_robin',
  teamMatchFormatId: 'standard_2s_3d',
  scoringSystem: 'standard',
  thirdSetRule: 'either',
  competitionRules: {
    eligibilityRule: 'auto',
    competitionLevel: null,
    mixedPairRule: 'auto',
    maxPartnerRatingGap: 'auto',
    standingsRule: 'auto',
    notes: '',
  },
  leagueName: 'Thursday Doubles',
  seasonLabel: 'Fall 2026',
  seasonStatus: 'completed',
  startsOn: '2026-09-01',
  endsOn: '2026-11-17',
  maxWeeks: 12,
  maxMatchEvents: 120,
  isPublic: true,
  schedulingMode: 'coordinator_fixed',
  defaultMatchDay: 'Thursday',
  defaultMatchTime: '08:00',
  scheduleTimeZone: 'America/Chicago',
  defaultFacility: 'Riverside',
  schedulingNotes: 'Courts 1-4',
  flight: '3.5',
  locationLabel: 'St. Louis',
  photoUrl: '',
  captainTeamName: '',
  notes: 'Doubles only',
  weeklySettings: { enabled: true, collectAvailability: true, autoGenerateCourts: true, showRankings: true, collectPlayerStories: true, leagueChatEnabled: true, emailRemindersEnabled: true, courtCount: 4, startTimes: ['08:00', '08:30'] },
  teams: [],
  players: ['Alex', 'Blair'],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
}

describe('league lifecycle', () => {
  it('requires the exact normalized league name before permanent deletion', () => {
    expect(normalizeLeagueDeleteConfirmation('  Thursday   Doubles ')).toBe('thursday doubles')
    expect(canDeleteLeagueWithConfirmation('Thursday Doubles', 'thursday doubles')).toBe(true)
    expect(canDeleteLeagueWithConfirmation('Thursday Doubles', 'Thursday')).toBe(false)
    expect(canDeleteLeagueWithConfirmation('', '')).toBe(false)
  })

  it('keeps device-local leagues manageable while protecting cloud-owned leagues', () => {
    expect(canManageLeagueAsOwner({ createdByUserId: undefined }, null)).toBe(true)
    expect(canManageLeagueAsOwner({ createdByUserId: '' }, null)).toBe(true)
    expect(canManageLeagueAsOwner(league, 'owner-1')).toBe(true)
    expect(canManageLeagueAsOwner(league, null)).toBe(false)
    expect(canManageLeagueAsOwner(league, 'delegate-1')).toBe(false)
  })

  it('renews league setup without carrying dates, status, or result identity forward', () => {
    const renewal = buildTiqLeagueRenewalDraft(league)
    expect(renewal).toMatchObject({
      leagueName: 'Thursday Doubles',
      seasonLabel: '',
      seasonStatus: 'draft',
      startsOn: '',
      endsOn: '',
      players: ['Alex', 'Blair'],
      defaultMatchDay: 'Thursday',
      defaultMatchTime: '08:00',
      weeklySettings: { enabled: true, leagueChatEnabled: true },
    })
    expect(renewal).not.toHaveProperty('id')
  })
})
