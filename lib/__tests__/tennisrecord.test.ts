import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTennisRecordMatchPage } from '../tennisrecord/parser'
import { canonicalTennisRecordFingerprint, isAmbiguousIdentity, isTennisRecordBlock, reconcileMatchObservations } from '../tennisrecord/reconcile'

const fixture = readFileSync(join(process.cwd(), 'lib/__tests__/fixtures/tennisrecord-stl-match-84487.html'), 'utf8')

describe('TennisRecord ingestion safety', () => {
  it('parses representative singles, doubles, and set scores without treating published ratings as a rating input', () => {
    const parsed = parseTennisRecordMatchPage(fixture, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026')
    expect(parsed.matches).toHaveLength(2)
    expect(parsed.matches[0]).toMatchObject({ playedOn: '2026-04-26', discipline: 'singles', courtNumber: 1, scoreText: '6-3 6-7 1-0', winnerSide: 'A' })
    expect(parsed.matches[0].participants[0]).toMatchObject({ name: 'Charles Kern', publishedRating: 3.85 })
    expect(parsed.matches[1].participants).toHaveLength(4)
    expect(parsed.teams).toHaveLength(2)
    expect(parsed.leagues[0]).toMatchObject({ flight: '4.0', seasonYear: 2026 })
  })

  it('keeps the same canonical fingerprint when a verified local score corrects TennisRecord', () => {
    const [match] = parseTennisRecordMatchPage(fixture, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026').matches
    const corrected = { ...match, scoreText: '6-4 7-5' }
    expect(canonicalTennisRecordFingerprint(match)).toBe(canonicalTennisRecordFingerprint(corrected))
  })

  it('keeps a captain upload above newer TennisRecord data and surfaces the disagreement', () => {
    const result = reconcileMatchObservations([
      { id: 'tennisrecord', source: 'tennisrecord' as const, observedAt: '2026-08-19T12:00:00Z', scoreText: '6-4 6-3' },
      { id: 'captain', source: 'captain_upload' as const, observedAt: '2026-08-10T12:00:00Z', scoreText: '6-4 7-5', verifiedAt: '2026-08-10T12:05:00Z' },
    ])
    expect(result.winner?.id).toBe('captain')
    expect(result.conflicts).toHaveLength(1)
  })

  it('stages name-only player matches as ambiguous and detects blocks fail-closed', () => {
    expect(isAmbiguousIdentity([{ id: 'one' }], false)).toBe(true)
    expect(isAmbiguousIdentity([{ id: 'one' }], true)).toBe(false)
    expect(isTennisRecordBlock(429, '')).toBe('http_429')
    expect(isTennisRecordBlock(200, '<title>Access denied</title>')).toContain('access denied')
  })

  it('is idempotent when weekly processing sees the same source match again', () => {
    const [match] = parseTennisRecordMatchPage(fixture, 'https://www.tennisrecord.com/adult/matchresults.aspx?mid=84487&year=2026').matches
    const reprocessed = { ...match, sourceMatchKey: 'reprocessed' }
    expect(canonicalTennisRecordFingerprint(match)).toBe(canonicalTennisRecordFingerprint(reprocessed))
  })
})
