import { describe, expect, it } from 'vitest'
import { readSourceOutageState, recordSourceOutageFailure, sourceOutageIsCooling } from '../tennisrecord/source-outage'

const now = Date.parse('2026-09-05T17:00:00Z')
describe('bounded shared source cooldown', () => {
  it('requires three different failures, including across checkpoints', () => {
    let state = recordSourceOutageFailure({}, 'one', now)
    state = recordSourceOutageFailure(state, 'one', now)
    expect(state.level).toBe(0)
    state = recordSourceOutageFailure(state, 'two', now)
    expect(state.level).toBe(0)
    state = recordSourceOutageFailure(JSON.parse(JSON.stringify(state)), 'three', now)
    expect(state.level).toBe(1)
    expect(sourceOutageIsCooling(state, now)).toBe(true)
    expect(sourceOutageIsCooling(state, now + 15 * 60_000)).toBe(false)
  })

  it('does not accumulate isolated failures indefinitely', () => {
    let state = recordSourceOutageFailure({}, 'one', now)
    state = recordSourceOutageFailure(state, 'two', now)
    state = recordSourceOutageFailure(state, 'three', now + 16 * 60_000)
    expect(state.failedQueueIds).toEqual(['three'])
    expect(state.level).toBe(0)
  })

  it('bounds repeated outage probes at an hour and limits stored identities', () => {
    let state = readSourceOutageState({ level: 1 })
    for (let i = 0; i < 20; i++) state = recordSourceOutageFailure(state, String(i), now)
    expect(state.level).toBe(3)
    expect(state.cooldownUntil).toBe('2026-09-05T18:00:00.000Z')
    expect(state.failedQueueIds).toHaveLength(3)
  })
})
