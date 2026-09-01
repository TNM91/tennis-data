import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

describe('team roster rating display', () => {
  it('shows one USTA rating alongside TiQ discipline reads without a wide table', () => {
    expect(source).toContain('<dt style={mobileRosterMetricLabelStyle}>TiQ singles</dt>')
    expect(source).toContain('<dt style={mobileRosterMetricLabelStyle}>TiQ doubles</dt>')
    expect(source).toContain('<dt style={mobileRosterMetricLabelStyle}>USTA</dt>')
    expect(source).not.toContain('<th style={tableHeaderCell}>S USTA</th>')
    expect(source).not.toContain('<th style={tableHeaderCell}>D USTA</th>')
    expect(source).toContain('const dynamicRosterGrid: CSSProperties')
    expect(source).toContain('const ustaRating = player.overall_rating')
    expect(source).toContain('formatRating(ustaRating)')
    expect(source).not.toContain('formatRating(player.overall_usta_dynamic_rating ?? player.overall_rating)')
  })
})
