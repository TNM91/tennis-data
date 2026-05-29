import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/tier-pathway.tsx'), 'utf8')

describe('tier pathway naming', () => {
  it('uses public workspace names in the default pathway intro', () => {
    expect(source).toContain('Player, Team Hub, or League Office')
    expect(source).not.toContain('TIQ League Coordinator when that next layer')
  })
})
