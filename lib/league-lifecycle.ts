import type { TiqLeagueDraft, TiqLeagueRecord } from '@/lib/tiq-league-registry'

export function normalizeLeagueDeleteConfirmation(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function canDeleteLeagueWithConfirmation(leagueName: string, confirmation: unknown) {
  const expected = normalizeLeagueDeleteConfirmation(leagueName)
  return expected.length >= 2 && normalizeLeagueDeleteConfirmation(confirmation) === expected
}

export function canManageLeagueAsOwner(league: Pick<TiqLeagueRecord, 'createdByUserId'>, userId: string | null) {
  const cloudOwnerId = String(league.createdByUserId || '').trim()
  if (!cloudOwnerId) return true
  return Boolean(userId && cloudOwnerId === userId)
}

export function buildTiqLeagueRenewalDraft(league: TiqLeagueRecord): TiqLeagueDraft {
  return {
    clubId: league.clubId,
    clubGroupId: league.clubGroupId,
    resultMode: league.resultMode,
    leagueFormat: league.leagueFormat,
    individualCompetitionFormat: league.individualCompetitionFormat,
    teamMatchFormatId: league.teamMatchFormatId,
    scoringSystem: league.scoringSystem,
    thirdSetRule: league.thirdSetRule,
    competitionRules: league.competitionRules,
    leagueName: league.leagueName,
    seasonLabel: '',
    seasonStatus: 'draft',
    startsOn: '',
    endsOn: '',
    maxWeeks: league.maxWeeks,
    maxMatchEvents: league.maxMatchEvents,
    isPublic: league.isPublic,
    schedulingMode: league.schedulingMode,
    defaultMatchDay: league.defaultMatchDay,
    defaultMatchTime: league.defaultMatchTime,
    scheduleTimeZone: league.scheduleTimeZone,
    defaultFacility: league.defaultFacility,
    schedulingNotes: league.schedulingNotes,
    flight: league.flight,
    locationLabel: league.locationLabel,
    photoUrl: league.photoUrl,
    captainTeamName: league.captainTeamName,
    notes: league.notes,
    weeklySettings: league.weeklySettings,
    teams: league.teams,
    players: league.players,
  }
}
