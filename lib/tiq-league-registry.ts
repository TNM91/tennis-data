'use client'

import type { CompetitionLayer, LeagueFormat } from '@/lib/competition-layers'
import type { LeagueCard } from '@/lib/league-summary'
import {
  normalizeTiqIndividualCompetitionFormat,
  type TiqIndividualCompetitionFormat,
} from '@/lib/tiq-individual-format'

export const TIQ_LEAGUE_REGISTRY_STORAGE_KEY = 'tenaceiq_tiq_league_registry'

export type TiqLeagueRecord = {
  id: string
  competitionLayer: CompetitionLayer
  leagueFormat: LeagueFormat
  individualCompetitionFormat: TiqIndividualCompetitionFormat
  leagueName: string
  seasonLabel: string
  flight: string
  locationLabel: string
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
  leagueName: string
  seasonLabel: string
  flight: string
  locationLabel: string
  captainTeamName: string
  notes: string
  teams: string[]
  players: string[]
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
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
    leagueName: cleanText(input.leagueName),
    seasonLabel: cleanText(input.seasonLabel),
    flight: cleanText(input.flight),
    locationLabel: cleanText(input.locationLabel),
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
      leagueName: cleanText(record.leagueName),
      seasonLabel: cleanText(record.seasonLabel),
      flight: cleanText(record.flight),
      locationLabel: cleanText(record.locationLabel),
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
    leagueName: normalized.leagueName,
    seasonLabel: normalized.seasonLabel,
    flight: normalized.flight,
    locationLabel: normalized.locationLabel,
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
    competitionLayer: 'tiq',
    leagueFormat: record.leagueFormat,
    matchCount: 0,
    teamCount: record.leagueFormat === 'team' ? Math.max(record.teams.length, 1) : Math.max(record.players.length, 1),
    latestMatchDate: record.updatedAt || record.createdAt || null,
  }))
}
