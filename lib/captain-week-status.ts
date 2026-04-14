'use client'

export type CaptainWeekStatus =
  | 'draft-lineup'
  | 'ready-to-send'
  | 'finalized'

export type CaptainWeekStatusScope = {
  team?: string | null
  league?: string | null
  flight?: string | null
  eventDate?: string | null
  opponentTeam?: string | null
}

type StoredCaptainWeekStatus = CaptainWeekStatusScope & {
  key: string
  status: CaptainWeekStatus
  updatedAt: string
}

const CAPTAIN_WEEK_STATUS_STORAGE_KEY = 'tenaceiq_captain_week_status'

function safePart(value: string | null | undefined) {
  return (value || '').trim().toLowerCase() || '—'
}

export function buildCaptainWeekStatusKey(scope: CaptainWeekStatusScope) {
  return [
    safePart(scope.team),
    safePart(scope.league),
    safePart(scope.flight),
    safePart(scope.eventDate),
    safePart(scope.opponentTeam),
  ].join('|')
}

function readAllCaptainWeekStatuses() {
  if (typeof window === 'undefined') return [] as StoredCaptainWeekStatus[]
  try {
    const raw = window.localStorage.getItem(CAPTAIN_WEEK_STATUS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredCaptainWeekStatus[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAllCaptainWeekStatuses(rows: StoredCaptainWeekStatus[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CAPTAIN_WEEK_STATUS_STORAGE_KEY, JSON.stringify(rows))
}

export function readCaptainWeekStatus(scope: CaptainWeekStatusScope) {
  const key = buildCaptainWeekStatusKey(scope)
  return readAllCaptainWeekStatuses().find((row) => row.key === key) || null
}

export function upsertCaptainWeekStatus(scope: CaptainWeekStatusScope, status: CaptainWeekStatus) {
  if (typeof window === 'undefined') return null

  const key = buildCaptainWeekStatusKey(scope)
  const rows = readAllCaptainWeekStatuses().filter((row) => row.key !== key)
  const nextRow: StoredCaptainWeekStatus = {
    ...scope,
    key,
    status,
    updatedAt: new Date().toISOString(),
  }
  rows.unshift(nextRow)
  writeAllCaptainWeekStatuses(rows.slice(0, 100))
  return nextRow
}

export function getCaptainWeekStatusMeta(status: CaptainWeekStatus) {
  if (status === 'ready-to-send') {
    return {
      label: 'Ready to send',
      detail: 'Lineup and messaging are ready for the team-facing update.',
    }
  }

  if (status === 'finalized') {
    return {
      label: 'Finalized',
      detail: 'The current week is locked and ready for match-day execution.',
    }
  }

  return {
    label: 'Draft lineup',
    detail: 'The week is still in build mode while lineup and comms are being refined.',
  }
}
