import { describe, expect, it, vi } from 'vitest'
import { resolveMatchupPlayerOptions } from '../matchup-player-options'

describe('Matchup selections outside the first catalogue page', () => {
  it('loads the linked player and opponent by ID instead of treating catalogue omission as removal', async () => {
    const fetch = vi.fn(async () => [{ id: 'nathan', name: 'Nathan Meinert' }, { id: 'opponent', name: 'Sam Rally' }])
    const options = await resolveMatchupPlayerOptions([{ id: 'aaron', name: 'Aaron Ace' }], ['nathan', 'opponent', 'nathan', 'aaron'], fetch)
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(['nathan', 'opponent'])
    expect(options.map(player => player.id)).toEqual(['aaron', 'nathan', 'opponent'])
  })
  it('skips the lookup when all selected players are already available', async () => {
    const fetch = vi.fn(async () => [])
    await resolveMatchupPlayerOptions([{ id: 'nathan', name: 'Nathan Meinert' }], ['nathan', '', 'nathan'], fetch)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps truly absent or inactive players out of the selectors after a successful ID lookup', async () => {
    const options = await resolveMatchupPlayerOptions<{ id: string; name: string; is_deleted?: boolean }>([{ id: 'aaron', name: 'Aaron Ace' }], ['removed', 'missing'], async () => [{ id: 'removed', name: 'Old record', is_deleted: true }])
    expect(options.map(player => player.id)).toEqual(['aaron'])
  })
  it('does not interpret a failed lookup as proof that selected players were removed', async () => {
    await expect(resolveMatchupPlayerOptions([], ['nathan'], async () => { throw new Error('offline') })).rejects.toThrow('offline')
  })
})
