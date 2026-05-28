import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('player trophy case proof strip', () => {
  it('summarizes honors before listing certificate cards', () => {
    const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

    expect(source).toContain('Trophy case proof')
    expect(source).toContain('trophyProofGridStyle')
    expect(source).toContain('trophyProofItemStyle')
    expect(source).toContain('readinessDotReadyStyle')
    expect(source).toContain("playerAwards.filter((award) => award.sourceType === 'tournament').length")
    expect(source).toContain('<strong>Certificates</strong>')
    expect(source).toContain('<em>Ready</em>')
  })
})
