import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const methodology = readFileSync(join(process.cwd(), 'app/methodology/page.tsx'), 'utf8')
const playerProfile = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

describe('TiQ rating methodology', () => {
  it('puts a plain-English rating guide before the technical details', () => {
    expect(methodology).toContain('TiQ rating in plain English')
    expect(methodology).toContain('What makes your number move?')
    expect(methodology).toContain('Doubles uses all four players')
    expect(methodology).toContain('TennisRecord’s estimated rating never sets or moves a TiQ rating.')
  })

  it('links player profiles to the public guide', () => {
    expect(playerProfile).toContain('href="/methodology#rating-basics"')
    expect(playerProfile).toContain('How TiQ ratings work')
  })
})
