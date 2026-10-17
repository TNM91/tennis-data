import { describe, expect, it, vi } from 'vitest'
import { includeLinkedPlayer } from '@/lib/linked-player-context'

describe('linked player context', () => {
  it('loads the linked member outside the initial 1,000-player batch', async () => {
    const players = Array.from({ length: 1000 }, (_, index) => ({ id: `player-${index}` }))
    const load = vi.fn().mockResolvedValue([{ id: 'linked-player' }])
    const result = await includeLinkedPlayer(players, 'linked-player', load)
    expect(load).toHaveBeenCalledExactlyOnceWith('linked-player')
    expect(result).toHaveLength(1001)
    expect(result.at(-1)).toEqual({ id: 'linked-player' })
  })

  it('skips another request when the linked record is already present or absent', async () => {
    const players = [{ id: 'linked-player' }]
    const load = vi.fn()
    expect(await includeLinkedPlayer(players, 'linked-player', load)).toBe(players)
    expect(await includeLinkedPlayer(players, null, load)).toBe(players)
    expect(load).not.toHaveBeenCalled()
  })

  it('keeps unrelated records out of the targeted lookup result', async () => {
    expect(await includeLinkedPlayer([], 'linked-player', async () => [{ id: 'another-player' }])).toEqual([])
  })
})
