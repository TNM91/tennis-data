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
    expect(matchupSource).not.toContain('\u25b2 Hot')
    expect(matchupSource).not.toContain('\u2191 Rising')
    expect(matchupSource).not.toContain('\u25bc Cooling')
    expect(matchupSource).not.toContain('\u2193 Softening')
    expect(matchupSource).not.toContain('\u2192 Stable')
    expect(matchupSource).toContain("{label} - TIQ signal")
    expect(matchupSource).not.toContain("color: '#f8fbff'")
    expect(matchupSource).not.toContain("m.score || '—'")
    expect(matchupSource).not.toContain("return '—'")
  })
  it('keeps primary matchup setup actions shell-aware instead of dark text on gradients', () => {
    expect(matchupSource).toContain('const identitySetupButtonStyle: CSSProperties')
    expect(matchupSource).toContain('const quickStartButtonStyle: CSSProperties')
    expect(matchupSource).toContain("background: 'color-mix(in srgb, var(--brand-green) 18%, var(--shell-chip-bg) 82%)'")
    expect(matchupSource).toContain("background: 'color-mix(in srgb, var(--brand-green) 20%, var(--shell-chip-bg) 80%)'")
    expect(matchupSource).not.toContain("background: 'linear-gradient(135deg, var(--brand-green), var(--brand-lime))',\n  color: 'var(--text-dark)'")
    expect(matchupSource).not.toContain("background: 'linear-gradient(135deg, var(--brand-green), var(--brand-green-3))',\n  color: 'var(--text-dark)'")
  })
})
