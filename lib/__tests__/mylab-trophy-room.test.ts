import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('My Lab trophy room', () => {
  it('syncs linked player tournament awards into the trophy room', () => {
    const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

    expect(source).toContain('loadPublishedTiqAwardsForPlayer')
    expect(source).toContain('award.recipientPlayerId === profileLink?.linked_player_id')
    expect(source).toContain('earnedAwardCards')
    expect(source).toContain('trophyRoomCards')
    expect(source).toContain('buildPlayerTrophyBadges')
    expect(source).toContain('Earned badges')
    expect(source).toContain('Next: {nextTrophyBadge.label}')
    expect(source).toContain('Tournament honors and best marks')
  })
})
