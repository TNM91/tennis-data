import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('rankings next actions', () => {
  it('turns the rankings board into practical tennis next steps', () => {
    const source = readFileSync(join(process.cwd(), 'app/rankings/page.tsx'), 'utf8')

    expect(source).toContain('RankingNextActionRail')
    expect(source).toContain('Ranking next actions')
    expect(source).toContain('Use rankings to decide what to check next.')
    expect(source).toContain('Compare')
    expect(source).toContain('Find the player record')
    expect(source).toContain('Check league context')
    expect(source).toContain('Fix ranking data')
    expect(source).toContain('DATA_ASSIST_STORY.href')
  })
})
