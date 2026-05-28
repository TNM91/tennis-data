import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament award recap alerts', () => {
  it('turns issued awards into a linked recap alert draft', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('buildTournamentAwardRecapBody')
    expect(source).toContain("setAlertKind('recap')")
    expect(source).toContain('Draft recap alert')
    expect(source).toContain('Certificates and trophy cases are live')
    expect(source).toContain("window.location.hash = 'tournament-alerts'")
  })
})
