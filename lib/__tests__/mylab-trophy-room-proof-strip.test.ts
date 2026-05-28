import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('My Lab trophy room proof strip', () => {
  it('separates earned awards from best-mark records', () => {
    const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

    expect(source).toContain('Trophy room proof')
    expect(source).toContain('trophyProofGridStyle')
    expect(source).toContain('trophyProofItemStyle')
    expect(source).toContain('trophyProofDotStyle')
    expect(source).toContain('<strong>Honors</strong>')
    expect(source).toContain('<strong>Certificates</strong>')
    expect(source).toContain('<strong>Best marks</strong>')
    expect(source).toContain('trophyRoomCards.length - earnedAwardCards.length')
  })
})
