import { describe, expect, it, vi } from 'vitest'
import { resolveSchedulingProfileIds } from '../scheduling-profile-resolution'

describe('bounded scheduling recipient resolution', () => {
  it('resolves at most four independent lookups at once, retaining precedence and deduplicating recipients', async () => {
    let active = 0
    let maximum = 0
    const pending: Array<() => void> = []
    const values: string[] = []
    const lookup = (value: string) => new Promise<{ id: string }>((resolve) => {
      values.push(value)
      maximum = Math.max(maximum, ++active)
      pending.push(() => { active--; resolve({ id: value === 'Name A' ? 'profile-a' : `profile-${value}` }) })
    })
    const result = resolveSchedulingProfileIds({ profileIds: [' captain ', 'captain'], playerIds: [' a ', 'b', 'c', 'd', 'e', 'a', '', 'f'], names: ['Name A', 'Name A', 'Name B'] }, { byPlayerId: lookup, byName: lookup })
    expect(values).toEqual(['a', 'b', 'c', 'd'])
    pending.splice(0).reverse().forEach((finish) => finish())
    await vi.waitFor(() => expect(values).toHaveLength(8))
    pending.splice(0).reverse().forEach((finish) => finish())
    expect(await result).toEqual(['captain', 'profile-a', 'profile-b', 'profile-c', 'profile-d', 'profile-e', 'profile-f', 'profile-Name B'])
    expect(maximum).toBe(4)
  })
  it('preserves unlinked results and does not perform empty lookups', async () => {
    const byPlayerId = vi.fn(async () => null)
    const byName = vi.fn(async () => null)
    expect(await resolveSchedulingProfileIds({ playerIds: [' ', 'a'], names: ['', 'Unknown'] }, { byPlayerId, byName })).toEqual([])
    expect(byPlayerId).toHaveBeenCalledTimes(1)
    expect(byName).toHaveBeenCalledTimes(1)
  })
  it('surfaces a lookup failure before creating further batches', async () => {
    const lookup = vi.fn(async () => { throw new Error('Directory unavailable') })
    await expect(resolveSchedulingProfileIds({ playerIds: ['a', 'b', 'c', 'd', 'e'] }, { byPlayerId: lookup, byName: lookup })).rejects.toThrow('Directory unavailable')
    expect(lookup).toHaveBeenCalledTimes(4)
  })
})
