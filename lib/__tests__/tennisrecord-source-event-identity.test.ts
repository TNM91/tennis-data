import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { tennisRecordEventReviews, tennisRecordSourceEventId } from '../tennisrecord/source-event-identity'
import { canonicalTennisRecordFingerprint } from '../tennisrecord/reconcile'
import type { TennisRecordMatch } from '../tennisrecord/types'

const url = 'https://www.tennisrecord.com/adult/matchresults.aspx?year=2025&mid=365802'
const other = url.replace('365802', '365804')
type Row = { id: string; fingerprint: string; source_url: string | null }
function client(rows: Row[], options: { observations?: Row[]; failAt?: number; missing?: boolean } = {}) {
  const calls: { table: string; offset: number }[] = []
  return { calls, db: { from(table: string) {
    let ids: string[] = []
    const q = {
      select() { return q }, in(_key: string, values: string[]) { ids = values; return q },
      eq(key: string, value: string) { expect([key, value]).toEqual(['source', 'tennisrecord']); return q }, order() { return q },
      async range(start: number, end: number) {
        calls.push({ table, offset: start })
        const data = (table === 'tennisrecord_staged_matches' ? rows : options.observations || []).filter(r => ids.includes(r.fingerprint)).slice(start, end + 1)
        return { data: options.missing ? null : data, error: start === options.failAt ? { message: 'read failed' } : null }
      },
    }; return q
  } } as unknown as SupabaseClient }
}

describe('source event URL identity', () => {
  it.each([url, 'http://tennisrecord.com/adult/matchresults.aspx?mid=0365802&year=2025', 'https://www.tennisrecord.com/ADULT/MATCHRESULTS.ASPX?MID=365802&YEAR=2025#court', url.replace('&', '&amp;') + '&utm_source=test'])('normalizes equivalent locators: %s', value => {
    expect(tennisRecordSourceEventId(value)).toBe('tennisrecord:2025:365802')
  })
  it.each(['', 'invalid', url.replace('www.tennisrecord.com', 'evil.example'), url.replace('https:', 'ftp:'), url.replace('mid=365802', 'mid=0'), url.replace('mid=365802', 'mid=1.5'), url.replace('year=2025', 'year=25'), url + '&mid=2', url + '&YEAR=2026', url.replace('matchresults.aspx', 'profile.aspx'), url.replace('www.', 'user@www.'), url.replace('.com/', '.com:1234/'), url.replace('&mid=365802', '')])('requires unambiguous source identity: %s', value => {
    expect(tennisRecordSourceEventId(value)).toBeNull()
  })
  it('keeps different years and very large IDs distinct without number rounding', () => {
    expect(tennisRecordSourceEventId(url.replace('2025', '2026'))).not.toBe(tennisRecordSourceEventId(url))
    expect(tennisRecordSourceEventId(url.replace('365802', '9007199254740993'))).toBe('tennisrecord:2025:9007199254740993')
  })
})

describe('fail-closed legacy event guard', () => {
  it('reproduces the legacy collision without changing existing fingerprint semantics', () => {
    const court = { playedOn: '2025-09-27', leagueName: 'League', flight: '', homeTeam: 'Home', awayTeam: 'Away', discipline: 'singles', courtNumber: 1, participants: [{ side: 'A', seat: 1, name: 'Player One' }, { side: 'B', seat: 1, name: 'Player Two' }] } as TennisRecordMatch
    expect(canonicalTennisRecordFingerprint({ ...court, sourceUrl: url } as TennisRecordMatch)).toBe(canonicalTennisRecordFingerprint({ ...court, sourceUrl: other } as TennisRecordMatch))
    expect(tennisRecordSourceEventId(url)).not.toBe(tennisRecordSourceEventId(other))
  })
  it('accepts first-time events and repeated same-event refreshes', async () => {
    for (const rows of [[], [{ id: 'old', fingerprint: 'fp', source_url: url }]]) {
      expect((await tennisRecordEventReviews(client(rows).db, [{ fingerprint: 'fp', sourceUrl: url }])).size).toBe(0)
    }
  })
  it('blocks a rematch despite identical player, date, court or score fingerprint', async () => {
    const f = client([{ id: 'old', fingerprint: 'fp', source_url: url }])
    expect((await tennisRecordEventReviews(f.db, [{ fingerprint: 'fp', sourceUrl: other }])).get('fp')).toContain('Different source events')
  })
  it('does not let a new same-source refresh hide an older colliding event', async () => {
    const f = client([{ id: 'old', fingerprint: 'fp', source_url: other }, { id: 'new', fingerprint: 'fp', source_url: url }])
    expect((await tennisRecordEventReviews(f.db, [{ fingerprint: 'fp', sourceUrl: url }])).has('fp')).toBe(true)
  })
  it('checks observations as well as staging, including associated legacy aliases', async () => {
    const f = client([], { observations: [{ id: 'legacy', fingerprint: 'alias', source_url: other }] })
    expect((await tennisRecordEventReviews(f.db, [{ fingerprint: 'fp', sourceUrl: url }], ['alias'])).has('fp')).toBe(true)
  })
  it('does not combine separate fingerprints from unrelated courts', async () => {
    expect((await tennisRecordEventReviews(client([{ id: 'old', fingerprint: 'fp2', source_url: other }]).db, [{ fingerprint: 'fp', sourceUrl: url }, { fingerprint: 'fp2', sourceUrl: other }])).size).toBe(0)
  })
  it('holds missing incoming, retained, and associated evidence', async () => {
    expect((await tennisRecordEventReviews(client([]).db, [{ fingerprint: 'fp', sourceUrl: '' }])).has('fp')).toBe(true)
    expect((await tennisRecordEventReviews(client([{ id: 'old', fingerprint: 'fp', source_url: null }]).db, [{ fingerprint: 'fp', sourceUrl: url }])).has('fp')).toBe(true)
    expect((await tennisRecordEventReviews(client([]).db, [{ fingerprint: 'fp', sourceUrl: url }], ['fp'])).has('fp')).toBe(true)
    expect((await tennisRecordEventReviews(client([{ id: 'own', fingerprint: 'fp', source_url: url }]).db, [{ fingerprint: 'fp', sourceUrl: url }], ['fp', 'missing-alias'])).has('fp')).toBe(true)
  })
  it('detects collisions in one incoming batch before any staging writes', async () => {
    expect((await tennisRecordEventReviews(client([]).db, [{ fingerprint: 'fp', sourceUrl: url }, { fingerprint: 'fp', sourceUrl: other }])).has('fp')).toBe(true)
  })
  it('finds a conflicting original beyond the first 200 evidence rows', async () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({ id: String(i), fingerprint: 'fp', source_url: i === 200 ? other : url }))
    const f = client(rows)
    expect((await tennisRecordEventReviews(f.db, [{ fingerprint: 'fp', sourceUrl: url }])).has('fp')).toBe(true)
    expect(f.calls).toContainEqual({ table: 'tennisrecord_staged_matches', offset: 200 })
    await expect(tennisRecordEventReviews(client(rows, { failAt: 200 }).db, [{ fingerprint: 'fp', sourceUrl: url }])).rejects.toThrow('read failed')
  })
  it('never treats missing or failed reads as an empty safe inventory', async () => {
    await expect(tennisRecordEventReviews(client([], { missing: true }).db, [{ fingerprint: 'fp', sourceUrl: url }])).rejects.toThrow('missing evidence')
    await expect(tennisRecordEventReviews(client([], { failAt: 0 }).db, [{ fingerprint: 'fp', sourceUrl: url }])).rejects.toThrow('read failed')
  })
  it('does no database work for pages without match courts', async () => {
    const f = client([])
    expect((await tennisRecordEventReviews(f.db, [])).size).toBe(0)
    expect(f.calls).toEqual([])
  })
})
