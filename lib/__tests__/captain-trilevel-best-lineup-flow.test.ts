import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

describe('Captain Tri-Level best-lineup flow', () => {
  it('uses the selected schedule match as the format source of truth', () => {
    expect(source).toContain('const selectedFormatLeagueName = selectedMatch?.league_name || leagueName')
    expect(source).toContain('const selectedFormatFlight = selectedMatch?.flight || flight')
    expect(source).toContain('selectedMatch.league_name !== leagueName')
    expect(source).toContain('selectedMatch.flight !== flight')
  })

  it('normalizes optimizer input and output back to the active league format', () => {
    expect(source).toContain('const optimizerTeamSlots = useMemo(')
    expect(source).toContain("fitCaptainLineupSlotsToFormat(teamSlots, selectedFormatLeagueName, selectedFormatFlight, 'team')")
    expect(source).toContain('const formatSafeSlots = fitCaptainLineupSlotsToFormat(')
    expect(source).toContain("document.getElementById('captain-lineup-courts')?.scrollIntoView")
  })

  it('keeps waiting players available for projected lineup building by default', () => {
    expect(source).toContain('const [availabilityOnly, setAvailabilityOnly] = useState(false)')
    expect(source).toContain('Add more eligible players or turn off Availability only.')
  })
})
