import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const matchupSource = readFileSync(join(process.cwd(), 'app/matchup/page.tsx'), 'utf8')

describe('matchup readability surfaces', () => {
  it('keeps head-to-head score text theme-aware and ASCII-safe', () => {
    expect(matchupSource).toContain('const headToHeadScoreText: CSSProperties')
    expect(matchupSource).toContain("<span style={headToHeadScoreText}>{m.score || '-'}</span>")
    expect(matchupSource).toContain("if (value === null) return '-'")
    expect(matchupSource).toContain("Favorite: <strong>{projection.favoriteLabel}</strong> | Underdog:")
    expect(matchupSource).not.toContain("color: '#f8fbff'")
    expect(matchupSource).not.toContain("m.score || '—'")
    expect(matchupSource).not.toContain("return '—'")
  })
})
