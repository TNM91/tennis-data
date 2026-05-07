'use client'

import type { CompetitionLayer, LeagueFormat } from '@/lib/competition-layers'
import type { LeagueCard } from '@/lib/league-summary'
import {
  DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS,
  DEFAULT_TIQ_LEAGUE_MAX_WEEKS,
  normalizeTiqLeagueMaxMatchEvents,
  normalizeTiqLeagueMaxWeeks,
  normalizeTiqLeagueSeasonStatus,
  type TiqLeagueSeasonStatus,
} from '@/lib/tiq-league-limits'
import {
  normalizeTiqIndividualCompetitionFormat,
  type TiqIndividualCompetitionFormat,
} from '@/lib/tiq-individual-format'
import { getDynamicPointsRulesSummary } from '@/lib/tiq-scoring'

export const TIQ_LEAGUE_REGISTRY_STORAGE_KEY = 'tenaceiq_tiq_league_registry'

export type TiqLeagueScoringSystem = 'standard' | 'dynamic_points'
export type TiqLeagueSchedulingMode = 'coordinator_fixed' | 'player_arranged'
export type TiqLeagueVisibility = 'public' | 'private'

export type TiqLeagueRecord = {
  id: string
  competitionLayer: CompetitionLayer
  leagueFormat: LeagueFormat
  individualCompetitionFormat: TiqIndividualCompetitionFormat
  scoringSystem: TiqLeagueScoringSystem
  leagueName: string
  seasonLabel: string
  seasonStatus: TiqLeagueSeasonStatus
  startsOn: string
  endsOn: string
  maxWeeks: number
  maxMatchEvents: number
  isPublic: boolean
  schedulingMode: TiqLeagueSchedulingMode
  defaultMatchDay: string
  defaultMatchTime: string
  scheduleTimeZone: string
  defaultFacility: string
  schedulingNotes: string
  flight: string
  locationLabel: string
  photoUrl: string
  captainTeamName: string
  notes: string
  teams: string[]
  players: string[]
  createdAt: string
  updatedAt: string
}

export type TiqLeagueDraft = {
  leagueFormat: LeagueFormat
  individualCompetitionFormat: TiqIndividualCompetitionFormat
  scoringSystem: TiqLeagueScoringSystem
  leagueName: string
  seasonLabel: string
  seasonStatus: TiqLeagueSeasonStatus
  startsOn: string
  endsOn: string
  maxWeeks: number
  maxMatchEvents: number
  isPublic: boolean
  schedulingMode: TiqLeagueSchedulingMode
  defaultMatchDay: string
  defaultMatchTime: string
  scheduleTimeZone: string
  defaultFacility: string
  schedulingNotes: string
  flight: string
  locationLabel: string
  photoUrl: string
  captainTeamName: string
  notes: string
  teams: string[]
  players: string[]
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

export function normalizeTiqLeagueScheduleTimeZone(value: string | null | undefined) {
  return cleanText(value) || 'America/Chicago'
}

function normalizeList(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean),
    ),
  )
}

export function normalizeTiqLeagueScoringSystem(
  value: string | null | undefined,
): TiqLeagueScoringSystem {
  return value === 'dynamic_points' ? 'dynamic_points' : 'standard'
}

export function normalizeTiqLeagueSchedulingMode(
  value: string | null | undefined,
): TiqLeagueSchedulingMode {
  return value === 'player_arranged' ? 'player_arranged' : 'coordinator_fixed'
}

export function normalizeTiqLeagueVisibility(
  value: string | boolean | null | undefined,
): TiqLeagueVisibility {
  if (value === false || value === 'private') return 'private'
  return 'public'
}

export function getTiqLeagueVisibilityLabel(isPublic: boolean) {
  return isPublic ? 'Public page' : 'Private league'
}

export function getTiqLeagueVisibilityDescription(isPublic: boolean) {
  if (isPublic) {
    return 'Public leagues are discoverable and shareable, but join requests still require coordinator approval.'
  }

  return 'Private leagues are hidden from public browse pages. Coordinators manage requests and active participants from this workspace.'
}

export function getTiqLeagueSchedulingModeLabel(mode: TiqLeagueSchedulingMode) {
  if (mode === 'player_arranged') return 'Players schedule'
  return 'Coordinator schedule'
}

export function getTiqLeagueSchedulingModeDescription(mode: TiqLeagueSchedulingMode) {
  if (mode === 'player_arranged') {
    return 'The coordinator publishes pairings. Players schedule through TenAceIQ, then record the agreed date, time, and site.'
  }

  return 'The coordinator sets the recurring match day, time, and site so the full season schedule can be published in advance.'
}

export function getTiqLeagueScoringSystemLabel(system: TiqLeagueScoringSystem) {
  if (system === 'dynamic_points') return 'Dynamic points'
  return 'Standard wins'
}

export function getTiqLeagueScoringSystemDescription(system: TiqLeagueScoringSystem) {
  if (system === 'dynamic_points') {
    return getDynamicPointsRulesSummary()
  }

  return 'Best 2 of 3 sets. The third set may be played out or entered as a 10-point match tiebreak, such as 1-0 or 10-8. Standings use match wins, losses, ties, and line wins.'
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function buildRegistryId(input: {
  leagueName: string
  seasonLabel: string
  leagueFormat: LeagueFormat
}) {
  const base = `${input.leagueName} ${input.seasonLabel} ${input.leagueFormat}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || `tiq-league-${Date.now()}`
}

function normalizeDraft(input: TiqLeagueDraft): TiqLeagueDraft {
  return {
    leagueFormat: input.leagueFormat,
    individualCompetitionFormat: normalizeTiqIndividualCompetitionFormat(input.individualCompetitionFormat),
    scoringSystem: normalizeTiqLeagueScoringSystem(input.scoringSystem),
    leagueName: cleanText(input.leagueName),
    seasonLabel: cleanText(input.seasonLabel),
    seasonStatus: normalizeTiqLeagueSeasonStatus(input.seasonStatus),
    startsOn: cleanText(input.startsOn),
    endsOn: cleanText(input.endsOn),
    maxWeeks: normalizeTiqLeagueMaxWeeks(input.maxWeeks),
    maxMatchEvents: normalizeTiqLeagueMaxMatchEvents(input.maxMatchEvents),
    isPublic: normalizeTiqLeagueVisibility(input.isPublic) === 'public',
    schedulingMode: normalizeTiqLeagueSchedulingMode(input.schedulingMode),
    defaultMatchDay: cleanText(input.defaultMatchDay),
    defaultMatchTime: cleanText(input.defaultMatchTime),
    scheduleTimeZone: normalizeTiqLeagueScheduleTimeZone(input.scheduleTimeZone),
    defaultFacility: cleanText(input.defaultFacility),
    schedulingNotes: cleanText(input.schedulingNotes),
    flight: cleanText(input.flight),
    locationLabel: cleanText(input.locationLabel),
    photoUrl: cleanText(input.photoUrl),
    captainTeamName: cleanText(input.captainTeamName),
    notes: cleanText(input.notes),
    teams: normalizeList(input.teams),
    players: normalizeList(input.players),
  }
}

export function readTiqLeagueRegistry(): TiqLeagueRecord[] {
  if (typeof window === 'undefined') return []

  const parsed = safeJsonParse<TiqLeagueRecord[]>(
    window.localStorage.getItem(TIQ_LEAGUE_REGISTRY_STORAGE_KEY),
  )

  if (!Array.isArray(parsed)) return []

  return parsed
    .filter((record) => record && typeof record === 'object')
    .map((record): TiqLeagueRecord => ({
      ...record,
      competitionLayer: 'tiq',
      leagueFormat: record.leagueFormat === 'individual' ? 'individual' : 'team',
      individualCompetitionFormat: normalizeTiqIndividualCompetitionFormat(record.individualCompetitionFormat),
      scoringSystem: normalizeTiqLeagueScoringSystem(record.scoringSystem),
      leagueName: cleanText(record.leagueName),
      seasonLabel: cleanText(record.seasonLabel),
      seasonStatus: normalizeTiqLeagueSeasonStatus(record.seasonStatus),
      startsOn: cleanText(record.startsOn),
      endsOn: cleanText(record.endsOn),
      maxWeeks: normalizeTiqLeagueMaxWeeks(record.maxWeeks ?? DEFAULT_TIQ_LEAGUE_MAX_WEEKS),
      maxMatchEvents: normalizeTiqLeagueMaxMatchEvents(
        record.maxMatchEvents ?? DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS,
      ),
      isPublic: normalizeTiqLeagueVisibility(record.isPublic) === 'public',
      schedulingMode: normalizeTiqLeagueSchedulingMode(record.schedulingMode),
      defaultMatchDay: cleanText(record.defaultMatchDay),
      defaultMatchTime: cleanText(record.defaultMatchTime),
      scheduleTimeZone: normalizeTiqLeagueScheduleTimeZone(record.scheduleTimeZone),
      defaultFacility: cleanText(record.defaultFacility),
      schedulingNotes: cleanText(record.schedulingNotes),
      flight: cleanText(record.flight),
      locationLabel: cleanText(record.locationLabel),
      photoUrl: cleanText(record.photoUrl),
      captainTeamName: cleanText(record.captainTeamName),
      notes: cleanText(record.notes),
      teams: normalizeList(Array.isArray(record.teams) ? record.teams : []),
      players: normalizeList(Array.isArray(record.players) ? record.players : []),
      createdAt: cleanText(record.createdAt),
      updatedAt: cleanText(record.updatedAt),
    }))
    .filter((record) => record.id && record.leagueName)
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return bTime - aTime
    })
}

export function writeTiqLeagueRegistry(records: TiqLeagueRecord[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TIQ_LEAGUE_REGISTRY_STORAGE_KEY, JSON.stringify(records))
}

export function upsertTiqLeagueRecord(draft: TiqLeagueDraft, existingId?: string) {
  const normalized = normalizeDraft(draft)
  const registry = readTiqLeagueRegistry()
  const now = new Date().toISOString()
  const nextId =
    cleanText(existingId) ||
    buildRegistryId({
      leagueName: normalized.leagueName,
      seasonLabel: normalized.seasonLabel,
      leagueFormat: normalized.leagueFormat,
    })

  const nextRecord: TiqLeagueRecord = {
    id: nextId,
    competitionLayer: 'tiq',
    leagueFormat: normalized.leagueFormat,
    individualCompetitionFormat: normalized.individualCompetitionFormat,
    scoringSystem: normalized.scoringSystem,
    leagueName: normalized.leagueName,
    seasonLabel: normalized.seasonLabel,
    seasonStatus: normalized.seasonStatus,
    startsOn: normalized.startsOn,
    endsOn: normalized.endsOn,
    maxWeeks: normalized.maxWeeks,
    maxMatchEvents: normalized.maxMatchEvents,
    isPublic: normalized.isPublic,
    schedulingMode: normalized.schedulingMode,
    defaultMatchDay: normalized.defaultMatchDay,
    defaultMatchTime: normalized.defaultMatchTime,
    scheduleTimeZone: normalized.scheduleTimeZone,
    defaultFacility: normalized.defaultFacility,
    schedulingNotes: normalized.schedulingNotes,
    flight: normalized.flight,
    locationLabel: normalized.locationLabel,
    photoUrl: normalized.photoUrl,
    captainTeamName: normalized.captainTeamName,
    notes: normalized.notes,
    teams: normalized.teams,
    players: normalized.players,
    createdAt: registry.find((record) => record.id === nextId)?.createdAt || now,
    updatedAt: now,
  }

  const nextRegistry = [...registry.filter((record) => record.id !== nextId), nextRecord].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime()
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime()
    return bTime - aTime
  })

  writeTiqLeagueRegistry(nextRegistry)
  return nextRecord
}

export function deleteTiqLeagueRecord(id: string) {
  const nextRegistry = readTiqLeagueRegistry().filter((record) => record.id !== id)
  writeTiqLeagueRegistry(nextRegistry)
}

export function parseRegistryListInput(value: string) {
  return normalizeList(
    value
      .split('\n')
      .flatMap((line) => line.split(','))
      .map((item) => item.trim()),
  )
}

export function buildLeagueCardsFromRegistry(records: TiqLeagueRecord[]): LeagueCard[] {
  return records.map((record) => ({
    key: `tiq-registry__${record.id}`,
    leagueId: record.id,
    leagueName: record.leagueName,
    flight: record.flight || record.seasonLabel,
    ustaSection: '',
    districtArea: record.locationLabel,
    year: record.seasonLabel.match(/\b(20\d{2})\b/)?.[1] || '',
    season: record.seasonLabel,
    gender: '',
    rating: record.flight.match(/\b([2-5](?:\.[05]))\b/)?.[1] || '',
    competitionLayer: 'tiq',
    leagueFormat: record.leagueFormat,
    matchCount: 0,
    teamCount: record.leagueFormat === 'team' ? Math.max(record.teams.length, 1) : Math.max(record.players.length, 1),
    latestMatchDate: record.updatedAt || record.createdAt || null,
  }))
}
