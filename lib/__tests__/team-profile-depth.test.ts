import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

describe('team profile depth controls', () => {
  it('keeps the team history preview concise and grouped on phones', () => {
    expect(source).toContain('<h2 style={sectionTitle}>Match history</h2>')
    expect(source).toContain('Open the full history only when you need it.')
    expect(source).toContain('mobileMatchGroupCardsStyle')
    expect(source).toContain("borderBottom: '1px solid rgba(125, 211, 252, 0.12)'")
  })

  it('starts mobile roster browsing as a four-player lineup snapshot', () => {
    expect(source).toContain('const mobileRosterPreviewLimit = isMobile ? 4 : 12')
    expect(source).toContain("{showFullRoster ? 'Return to lineup snapshot' : `Explore all ${filteredRoster.length} players`}")
    expect(source).toContain('const showRosterTools = !isMobile || showFullRoster')
  })

  it('makes full mobile roster browsing searchable without duplicating roster data', () => {
    expect(source).toContain("const [rosterSearch, setRosterSearch] = useState('')")
    expect(source).toContain('placeholder="Search this roster"')
    expect(source).toContain('if (searchTerm && !player.name.toLowerCase().includes(searchTerm)) return false')
  })
})
