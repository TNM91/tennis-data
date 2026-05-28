import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildTiqAwardCertificateText,
  buildTiqLeagueAwardCandidates,
  buildTiqTournamentAwardCandidates,
  getTiqAwardBadgeCode,
  getTiqAwardBadgeLabel,
  getTiqAwardPlacementLabel,
  loadTiqAwardsForPlayer,
  loadTiqAwardById,
  loadRecentTiqAwards,
  normalizeTiqAwardPlacement,
  readTiqAwardById,
  readTiqAwardsForPlayerId,
  saveTiqAwardRecordForUser,
  upsertTiqAwardRecord,
  type TiqAwardRecord,
} from '../tiq-awards-registry'

describe('TIQ awards registry helpers', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
    }
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', { localStorage: storage })
  })

  it('normalizes award placement labels and badge codes', () => {
    expect(normalizeTiqAwardPlacement('second')).toBe('second')
    expect(normalizeTiqAwardPlacement('unknown')).toBe('first')
    expect(getTiqAwardPlacementLabel('first')).toBe('1st Place')
    expect(getTiqAwardBadgeLabel('second')).toBe('Finalist')
    expect(getTiqAwardBadgeCode('third')).toBe('3RD')
  })

  it('builds award candidates from a completed single-elimination final', () => {
    expect(buildTiqTournamentAwardCandidates({
      id: 'spring-open',
      name: 'Spring Open',
      format: 'single_elimination',
      entrantType: 'players',
      status: 'scheduled',
      startsOn: '',
      locationLabel: '',
      directorNotes: '',
      entrants: ['Avery Stone', 'Blake Carter'],
      results: {
        'r1-m1': { winner: 'Avery Stone', score: '6-4 6-4', updatedAt: 'now' },
      },
      schedule: {},
      contacts: {},
      entrantPlayerIds: {},
      isPublic: true,
      createdAt: 'now',
      updatedAt: 'now',
    })).toMatchObject([
      { placement: 'first', recipientName: 'Avery Stone' },
      { placement: 'second', recipientName: 'Blake Carter' },
      { placement: 'third', recipientName: '' },
    ])
  })

  it('offers semifinal finishers as third-place award choices', () => {
    const candidates = buildTiqTournamentAwardCandidates({
      id: 'city-cup',
      name: 'City Cup',
      format: 'single_elimination',
      entrantType: 'players',
      status: 'scheduled',
      startsOn: '',
      locationLabel: '',
      directorNotes: '',
      entrants: ['Avery Stone', 'Blake Carter', 'Casey Nguyen', 'Drew Patel'],
      results: {
        'r1-m1': { winner: 'Avery Stone', score: '6-1 6-1', updatedAt: 'now' },
        'r1-m2': { winner: 'Blake Carter', score: '6-2 6-2', updatedAt: 'now' },
        'r2-m1': { winner: 'Avery Stone', score: '6-4 6-4', updatedAt: 'now' },
      },
      schedule: {},
      contacts: {},
      entrantPlayerIds: {},
      isPublic: true,
      createdAt: 'now',
      updatedAt: 'now',
    })

    expect(candidates.find((candidate) => candidate.placement === 'third')).toMatchObject({
      recipientName: '',
      recipientOptions: ['Drew Patel', 'Casey Nguyen'],
    })
  })

  it('builds printable certificate copy with TenAceIQ motto', () => {
    const award: TiqAwardRecord = {
      id: 'award-1',
      sourceType: 'tournament',
      sourceId: 'spring-open',
      sourceName: 'Spring Open',
      recipientName: 'Avery Stone',
      recipientPlayerId: 'player-avery',
      placement: 'first',
      title: '1st Place',
      subtitle: 'City Park',
      badgeLabel: 'Champion',
      badgeCode: '1ST',
      coordinatorName: '',
      notes: '',
      issuedAt: 'now',
      createdAt: 'now',
      updatedAt: 'now',
    }

    expect(buildTiqAwardCertificateText(award)).toContain('More Tennis. Less Chaos.')
    expect(buildTiqAwardCertificateText(award)).toContain('Avery Stone')
  })

  it('builds league award candidates from ranked finishers', () => {
    expect(buildTiqLeagueAwardCandidates([
      { recipientName: 'Avery Stone', recipientPlayerId: 'player-avery', detail: '8-1' },
      { recipientName: 'Blake Carter', detail: '7-2' },
      { recipientName: 'Casey Nguyen', detail: '6-3' },
    ])).toMatchObject([
      { placement: 'first', recipientName: 'Avery Stone', recipientPlayerId: 'player-avery', helperText: '8-1' },
      { placement: 'second', recipientName: 'Blake Carter', helperText: '7-2' },
      { placement: 'third', recipientName: 'Casey Nguyen', helperText: '6-3' },
    ])
  })

  it('stores awards against linked TIQ player ids', () => {
    localStorage.clear()
    const award = upsertTiqAwardRecord({
      sourceType: 'tournament',
      sourceId: 'spring-open',
      sourceName: 'Spring Open',
      recipientName: 'Avery Stone',
      recipientPlayerId: 'player-avery',
      placement: 'first',
      title: '1st Place',
      subtitle: 'City Park',
      coordinatorName: '',
      notes: '',
    })

    expect(award?.recipientPlayerId).toBe('player-avery')
    expect(readTiqAwardById(award?.id || '')).toMatchObject({ recipientName: 'Avery Stone' })
    expect(readTiqAwardsForPlayerId('player-avery')).toMatchObject([
      { recipientName: 'Avery Stone', badgeCode: '1ST' },
    ])
  })

  it('keeps cloud award storage public and creator-managed', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260525000400_create_tiq_awards.sql'),
      'utf8',
    )

    expect(migration).toContain('create table if not exists public.tiq_awards')
    expect(migration).toContain('recipient_player_id text')
    expect(migration).toContain('TIQ awards are publicly readable')
    expect(migration).toContain('Creators can update TIQ awards')
  })

  it('exposes cloud-aware award helpers', async () => {
    expect(typeof saveTiqAwardRecordForUser).toBe('function')
    expect(typeof loadTiqAwardsForPlayer).toBe('function')
    expect(typeof loadTiqAwardById).toBe('function')
    expect(typeof loadRecentTiqAwards).toBe('function')
  })
})
