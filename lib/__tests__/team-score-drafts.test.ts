import { describe, expect, it } from 'vitest'
import { createTeamScoreDraftSession, type ScoreDraft } from '../../mobile/src/team-score-drafts'
import { teamResultScorecardKey } from '../team-results-contract'

const owner = '11111111-1111-4111-8111-111111111111'
const fixture = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const scoreKey = teamResultScorecardKey('33333333-3333-4333-8333-333333333333', fixture)
const draft: ScoreDraft = {
  expected: null, won: '', lost: '', assigningPlayers: false, confirmedPlayers: false,
  courts: [{ score: '6-3, 4-', outcome: 'played', players: [] }], players: [], pending: null,
}

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem(key: string, value: string) { data.set(key, value) },
    removeItem(key: string) { data.delete(key) },
  }
}

describe('private team score drafts', () => {
  it('restores partial courts and an exact retry payload for the same account', async () => {
    const storage = memoryStorage()
    const original = createTeamScoreDraftSession(owner, storage)
    await original.load()
    original.set(scoreKey, draft)
    await original.flush()
    const resumed = createTeamScoreDraftSession(owner, storage)
    await resumed.load()
    expect(resumed.get(scoreKey)).toEqual(draft)

    const pending = { fixtureId: fixture, expected: null, revision: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', won: 2, lost: 1 }
    resumed.set(scoreKey, { ...draft, pending })
    await resumed.flush()
    const reopened = createTeamScoreDraftSession(owner, storage)
    await reopened.load()
    expect(reopened.get(scoreKey)?.pending).toEqual(pending)
    const other = createTeamScoreDraftSession('22222222-2222-4222-8222-222222222222', storage)
    await other.load()
    expect(other.get(scoreKey)).toBeUndefined()
  })

  it('queues removal after a write already in progress', async () => {
    const storage = memoryStorage()
    let finish!: () => void, start!: () => void
    const started = new Promise<void>(resolve => { start = resolve })
    const session = createTeamScoreDraftSession(owner, { ...storage, setItem: async (key, value) => {
      start()
      await new Promise<void>(resolve => { finish = resolve })
      storage.setItem(key, value)
    } })
    await session.load()
    session.set(scoreKey, draft)
    const writing = session.flush()
    await started
    const clearing = session.clear()
    finish()
    await Promise.all([writing, clearing])
    expect(storage.data.size).toBe(0)
    expect(session.get(scoreKey)).toBeUndefined()
  })

  it('replaces unreadable JSON after a successful secure-store read', async () => {
    const storage = memoryStorage()
    const key = 'team-score-drafts:v1:' + owner
    storage.setItem(key, '{bad')
    const session = createTeamScoreDraftSession(owner, storage)
    await session.load()
    session.set(scoreKey, draft)
    await session.flush()
    expect(JSON.parse(storage.getItem(key) ?? '')).toMatchObject({ owner, drafts: [[scoreKey, draft]] })
  })
})
