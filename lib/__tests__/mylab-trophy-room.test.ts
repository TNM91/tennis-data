import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('My Lab trophy room', () => {
  it('syncs linked player tournament awards into the trophy room', () => {
    const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

    expect(source).toContain('loadTiqAwardsForPlayer')
    expect(source).toContain('setTiqAwards([...byId.values()])')
    expect(source).toContain('earnedAwardCards')
    expect(source).toContain('trophyRoomCards')
    expect(source).toContain('Tournament honors and best marks')
    expect(source).toContain('readTiqAwardsRegistry')
  })
})
