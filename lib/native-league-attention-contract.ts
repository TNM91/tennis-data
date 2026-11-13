import { lineupRecord } from './native-captain-lineup-contract'
import { courtAccountId } from './native-court-result-contract'
import { entryLeague } from './native-league-entry-contract'
import type { OfficeFixture } from './native-league-office-contract'

export type LeagueAttentionRow = {
  id: string
  fixtureDigest: string
  revision: string | null
  note: string
  since: string
  nextReminderAt: string | null
}

type ScoreReminder = { action: 'remind'; leagueId: string; matchId: string } &
  Pick<LeagueAttentionRow, 'fixtureDigest' | 'revision'>

function reminderVersion(fixtureDigest: unknown, revision: unknown) {
  if (
      typeof fixtureDigest !== 'string' || !/^[0-9a-f]{64}$/.test(fixtureDigest) ||
      revision !== null && !courtAccountId(revision)) throw Error('Choose a match to remind.')
  return { fixtureDigest, revision }
}

export function readScoreReminder(value: unknown): ScoreReminder {
  const row = lineupRecord(value)
  const { matchId } = row
  if (row.action !== 'remind' || Object.keys(row).length !== 5 || !courtAccountId(matchId)) {
    throw Error('Choose a match to remind.')
  }
  const { fixtureDigest, revision } = reminderVersion(row.fixtureDigest, row.revision)
  return { action: 'remind', leagueId: entryLeague(row.leagueId), matchId, fixtureDigest, revision }
}

export function readReminderTime(value: unknown) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value) ||
      !Number.isFinite(Date.parse(value))) throw Error('Invalid league reminder time.')
  return value
}

export function readLeagueAttention(value: unknown, fixtures: ReadonlyMap<string, OfficeFixture>): LeagueAttentionRow[] {
  if (!Array.isArray(value) || value.length > fixtures.size) throw Error('Invalid league follow-ups.')
  const seen = new Set<string>()
  return value.map(raw => {
    const { id, fixtureDigest, revision, note, since, nextReminderAt } = lineupRecord(raw)
    const fixture = courtAccountId(id) ? fixtures.get(id) : undefined
    if (!fixture || seen.has(fixture.id) || !['confirmed', 'coordinator_set', 'completed'].includes(fixture.status) ||
        typeof note !== 'string' || note.length > 500 || /\p{Cc}/u.test(note) || Boolean(note.trim()) !== (revision !== null)) {
      throw Error('Invalid league follow-up.')
    }
    seen.add(fixture.id)
    return { id: fixture.id, ...reminderVersion(fixtureDigest, revision), note,
      since: readReminderTime(since), nextReminderAt: nextReminderAt === null ? null : readReminderTime(nextReminderAt) }
  })
}

export function leagueAttentionFixture({ id, date, time, facility, a, b, status }: OfficeFixture) {
  return { id, date, time: time.slice(0, 5), facility, a, b, status }
}
