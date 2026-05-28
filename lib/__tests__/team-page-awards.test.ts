import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('team page awards', () => {
  it('renders a team trophy case from league awards', () => {
    const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

    expect(source).toContain('loadRecentTiqAwards')
    expect(source).toContain('teamAwards')
    expect(source).toContain('id="team-awards"')
    expect(source).toContain('Trophy case')
    expect(source).toContain('teamAwardCardStyle')
    expect(source).toContain('/awards/')
    expect(source).toContain('!award.recipientPlayerId')
    expect(source).toContain('rgba(155,225,29,0.22)')
    expect(source).toContain('var(--brand-lime)')
  })
})
