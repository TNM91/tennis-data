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
    expect(source).toContain("fitCaptainLineupSlotsToFormat(teamSlots, selectedFormatLeagueName, selectedFormatFlight, 'team', effectiveMatchFormatId)")
    expect(source).toContain('const formatSafeSlots = fitCaptainLineupSlotsToFormat(')
    expect(source).toContain("document.getElementById('captain-lineup-applied-next')?.scrollIntoView")
    expect(source).not.toContain("document.getElementById('captain-lineup-courts')?.scrollIntoView")
  })

  it('hands an applied lineup directly to availability confirmation', () => {
    expect(source).toContain('id="captain-lineup-applied-next"')
    expect(source).toContain('<strong>Next: confirm availability</strong>')
    expect(source).toContain('Prepare a message for each player in this potential lineup.')
    expect(source).toContain("{preparingConfirmation ? 'Preparing texts...' : 'Confirm availability'}")
    expect(source).toContain('<GhostLink href="#captain-lineup-courts">Review lineup</GhostLink>')
  })

  it('keeps waiting players available for projected lineup building by default', () => {
    expect(source).toContain('const [availabilityOnly, setAvailabilityOnly] = useState(false)')
    expect(source).toContain('Add more eligible players or turn off Availability only.')
  })
})
