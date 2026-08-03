import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/profile/page.tsx'), 'utf8')

describe('profile workflow return', () => {
  it('preserves linked team context and continues the setup that opened Player ID', () => {
    expect(source).toContain('linked_team_name: profile?.linked_team_name || null')
    expect(source).toContain('linked_league_name: profile?.linked_league_name || null')
    expect(source).toContain('linked_flight: profile?.linked_flight || nextPlayer?.flight || null')
    expect(source).toContain('getSafeWorkflowReturnTo')
    expect(source).toContain("currentParams.get('setup') === 'captain' ? '/captain' : ''")
    expect(source).toContain("router.replace(addWorkflowResult(returnTo, 'player-linked'))")
  })
})
