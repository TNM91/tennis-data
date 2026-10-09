import { describe, expect, it } from 'vitest'
import { LEVEL_UP_HISTORY_UNAVAILABLE, readLevelUpSessionHistory } from '../level-up/read-session-history'

describe('Level Up account history responses', () => {
  it('accepts available history, including an empty account', async () => {
    const sessions = [{ id: 'saved-proof' }]
    await expect(readLevelUpSessionHistory(Response.json({ ok: true, sessions }))).resolves.toEqual(sessions)
    await expect(readLevelUpSessionHistory(Response.json({ ok: true, sessions: [] }))).resolves.toEqual([])
  })
  it('does not mistake HTTP errors for an empty account', async () => {
    await expect(readLevelUpSessionHistory(Response.json({ ok: false }, { status: 503 }))).rejects.toThrow(LEVEL_UP_HISTORY_UNAVAILABLE)
  })
  it('rejects unsuccessful or malformed payloads instead of claiming history loaded', async () => {
    for (const payload of [{ ok: false, sessions: [] }, { ok: true }, { ok: true, sessions: null }, null]) {
      await expect(readLevelUpSessionHistory(Response.json(payload))).rejects.toThrow(LEVEL_UP_HISTORY_UNAVAILABLE)
    }
  })
})
