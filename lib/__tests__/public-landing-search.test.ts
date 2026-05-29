import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const commandCenterSource = readFileSync(join(process.cwd(), 'app/components/public-command-center.tsx'), 'utf8')
const coachesSource = readFileSync(join(process.cwd(), 'app/coaches/page.tsx'), 'utf8')
const tournamentsSource = readFileSync(join(process.cwd(), 'app/tournaments/page.tsx'), 'utf8')

describe('public landing search', () => {
  it('lets public landing pages tune the universal search prompt', () => {
    expect(commandCenterSource).toContain('searchPlaceholder')
    expect(commandCenterSource).toContain('<UniversalSearch placeholder={searchPlaceholder} />')
  })

  it('keeps Coaches and Tournaments searchable from their hero sections', () => {
    expect(coachesSource).toContain('Search coaches, player goals')
    expect(coachesSource).not.toContain('showSearch={false}')
    expect(tournamentsSource).toContain('Search tournaments, draws')
    expect(tournamentsSource).not.toContain('showSearch={false}')
  })
})
