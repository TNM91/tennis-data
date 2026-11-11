import { getNativeAuthStorage } from '../../lib/native-auth-storage'
import { fixtureId } from '../../lib/team-fixtures-contract'
import { isTeamCourtDefault, isTeamResultScorecardKey, maxTeamResultCourts, readTeamResultChange, readTeamResultPlayers,
  type TeamCourtDefault, type TeamResultChange, type TeamResultPlayer } from '../../lib/team-results-contract'

export type CourtDraft = { score: string; outcome: 'played' | TeamCourtDefault; players: string[]; plannedPlayers?: string[] }
export type ScoreDraft = {
  expected: string | null; lineupVersion?: string; won: string; lost: string; courts: CourtDraft[] | null
  assigningPlayers: boolean; confirmedPlayers: boolean; players: TeamResultPlayer[]; pending: TeamResultChange | null
}

function readDraft(key: string, value: unknown): ScoreDraft | undefined {
  const draft = value as Partial<ScoreDraft> | null
  const ids = (value: unknown, empty = false) => Array.isArray(value) && value.length <= 2 &&
    value.every(id => fixtureId(id) || (empty && id === ''))
  if (!draft || (draft.expected !== null && !fixtureId(draft.expected)) ||
      (draft.lineupVersion !== undefined && !fixtureId(draft.lineupVersion)) ||
      typeof draft.won !== 'string' || typeof draft.lost !== 'string' ||
      typeof draft.assigningPlayers !== 'boolean' || typeof draft.confirmedPlayers !== 'boolean') return
  const courts = draft.courts
  if (courts !== null && (!Array.isArray(courts) || !courts.length || courts.length > maxTeamResultCourts ||
      courts.some(court => !court || typeof court.score !== 'string' || court.score.length > 64 ||
        (court.outcome !== 'played' && !isTeamCourtDefault(court.outcome)) || !ids(court.players, true) ||
        (court.plannedPlayers !== undefined && !ids(court.plannedPlayers))))) return
  if (draft.assigningPlayers && (!courts || !draft.expected)) return
  const pending = draft.pending ? readTeamResultChange(draft.pending) : null
  if (draft.pending !== null && (!pending || pending.fixtureId !== key.split(':').at(-1) || pending.expected !== draft.expected)) return
  try {
    return { expected: draft.expected, lineupVersion: draft.lineupVersion, won: draft.won, lost: draft.lost, courts,
      assigningPlayers: draft.assigningPlayers, confirmedPlayers: draft.confirmedPlayers,
      players: readTeamResultPlayers(draft.players, true), pending }
  } catch { return }
}

export function createTeamScoreDraftSession(owner: string, storage = getNativeAuthStorage()) {
  const key = 'team-score-drafts:v1:' + owner
  const drafts = new Map<string, ScoreDraft>()
  let loaded = !storage, generation = 0, dirty = false
  let reading: Promise<void> | undefined
  let writing = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined

  function load() {
    if (loaded || !storage) return Promise.resolve()
    const version = generation
    reading ??= Promise.resolve().then(() => storage.getItem(key)).then(value => {
      if (version !== generation) return
      loaded = true
      let saved
      try { saved = value ? JSON.parse(value) : null } catch { return }
      if (saved?.owner === owner && Array.isArray(saved.drafts)) {
        for (const row of saved.drafts) {
          if (!Array.isArray(row) || typeof row[0] !== 'string' || !isTeamResultScorecardKey(row[0])) continue
          const draft = readDraft(row[0], row[1])
          if (draft) drafts.set(row[0], draft)
        }
      }
    }).catch(() => { /* Keep editing available for this app session if the store is unavailable. */ })
    return reading
  }

  function flush() {
    clearTimeout(timer)
    if (!storage || !loaded || !dirty) return writing
    dirty = false
    const value = drafts.size ? JSON.stringify({ owner, drafts: [...drafts] }) : null
    const version = generation
    writing = writing.then(async () => {
      if (version !== generation) return
      if (value) await storage.setItem(key, value)
      else await storage.removeItem(key)
    }).catch(() => { if (version === generation) dirty = true })
    return writing
  }

  function changed() {
    if (!storage || !loaded) return
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(() => { void flush() }, 300)
  }

  return {
    owner, load, flush,
    get: (key: string) => drafts.get(key),
    set(key: string, draft: ScoreDraft) { drafts.set(key, draft); changed() },
    delete(key: string) { if (drafts.delete(key)) changed() },
    clear() {
      generation++
      drafts.clear()
      loaded = true
      dirty = true
      return flush()
    },
  }
}

export type TeamScoreDraftSession = ReturnType<typeof createTeamScoreDraftSession>
