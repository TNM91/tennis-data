import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('profile award link confirmation', () => {
  it('shows linked player honors on the profile identity page', () => {
    const source = readFileSync(join(process.cwd(), 'app/profile/page.tsx'), 'utf8')

    expect(source).toContain('loadTiqAwardsForPlayer')
    expect(source).toContain('profileAwards')
    expect(source).toContain('honor{profileAwards.length === 1')
    expect(source).toContain('profileAwardPillStyle')
    expect(source).toContain('Profile award proof')
    expect(source).toContain('profileAwardProofGridStyle')
    expect(source).toContain('profileAwardProofItemStyle')
    expect(source).toContain('profileAwardProofDotStyle')
    expect(source).toContain('Player link')
    expect(source).toContain('Confirmed')
    expect(source).toContain('Name match')
    expect(source).toContain('/awards/')
    expect(source).toContain('#profile-trophy-case')
  })
})
