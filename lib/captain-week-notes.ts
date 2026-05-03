'use client'

const CAPTAIN_WEEK_NOTES_STORAGE_KEY = 'tenaceiq_captain_week_notes'

export type CaptainWeekNotesScope = {
  team?: string | null
  league?: string | null
  flight?: string | null
  eventDate?: string | null
  opponentTeam?: string | null
}

export type CaptainWeekNotesEntry = {
  scopeKey: string
  team: string
  league: string
  flight: string
  eventDate: string
  opponentTeam: string
  weeklyNotes: string
  opponentNotes: string
  updatedAt: string
}

function cleanScopeValue(value?: string | null) {
  return (value || '').trim()
}

export function buildCaptainWeekNotesScopeKey(scope: CaptainWeekNotesScope) {
  return [
    cleanScopeValue(scope.team).toLowerCase(),
    cleanScopeValue(scope.league).toLowerCase(),
    cleanScopeValue(scope.flight).toLowerCase(),
    cleanScopeValue(scope.eventDate).toLowerCase(),
    cleanScopeValue(scope.opponentTeam).toLowerCase(),
  ].join('__')
}

function readCaptainWeekNotesEntries() {
  if (typeof window === 'undefined') return [] as CaptainWeekNotesEntry[]

  try {
    const raw = window.localStorage.getItem(CAPTAIN_WEEK_NOTES_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CaptainWeekNotesEntry[]) : []
  } catch {
    return []
  }
}

function writeCaptainWeekNotesEntries(entries: CaptainWeekNotesEntry[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CAPTAIN_WEEK_NOTES_STORAGE_KEY, JSON.stringify(entries))
}

export function readCaptainWeekNotes(scope: CaptainWeekNotesScope) {
  const scopeKey = buildCaptainWeekNotesScopeKey(scope)
  if (!scopeKey.replace(/_/g, '')) return null

  return readCaptainWeekNotesEntries().find((entry) => entry.scopeKey === scopeKey) ?? null
}

export function upsertCaptainWeekNotes(
  scope: CaptainWeekNotesScope,
  notes: { weeklyNotes?: string; opponentNotes?: string }
) {
  const scopeKey = buildCaptainWeekNotesScopeKey(scope)
  if (!scopeKey.replace(/_/g, '')) return null

  const nextEntry: CaptainWeekNotesEntry = {
    scopeKey,
    team: cleanScopeValue(scope.team),
    league: cleanScopeValue(scope.league),
    flight: cleanScopeValue(scope.flight),
    eventDate: cleanScopeValue(scope.eventDate),
    opponentTeam: cleanScopeValue(scope.opponentTeam),
    weeklyNotes: cleanScopeValue(notes.weeklyNotes),
    opponentNotes: cleanScopeValue(notes.opponentNotes),
    updatedAt: new Date().toISOString(),
  }

  const existing = readCaptainWeekNotesEntries().filter((entry) => entry.scopeKey !== scopeKey)
  writeCaptainWeekNotesEntries([nextEntry, ...existing].slice(0, 30))
  return nextEntry
}
