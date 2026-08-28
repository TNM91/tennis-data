import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

describe('team roster rating display', () => {
  it('shows one USTA rating alongside TiQ singles and doubles reads', () => {
    expect(source).toContain('<th style={tableHeaderCell}>S TiQ</th>')
    expect(source).toContain('<th style={tableHeaderCell}>D TiQ</th>')
    expect(source).toContain('<th style={tableHeaderCell}>USTA</th>')
    expect(source).not.toContain('<th style={tableHeaderCell}>S USTA</th>')
    expect(source).not.toContain('<th style={tableHeaderCell}>D USTA</th>')
    expect(source).toContain('const ustaRating = player.overall_rating')
    expect(source).toContain('formatRating(player.overall_rating)')
    expect(source).not.toContain('formatRating(player.overall_usta_dynamic_rating ?? player.overall_rating)')
  })
})
