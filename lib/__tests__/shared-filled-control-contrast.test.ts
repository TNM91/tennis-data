import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const followButtonSource = readFileSync(join(process.cwd(), 'app/components/follow-button.tsx'), 'utf8')
const tierPathwaySource = readFileSync(join(process.cwd(), 'app/components/tier-pathway.tsx'), 'utf8')

describe('shared filled control contrast', () => {
  it('keeps Follow controls shell-aware when they are not already followed', () => {
    expect(followButtonSource).toContain("color: isFollowing ? (hovered ? '#fecaca' : '#f8fbff') : 'var(--foreground-strong)'")
    expect(followButtonSource).toContain("? 'color-mix(in srgb, var(--brand-green) 26%, var(--shell-chip-bg) 74%)'")
    expect(followButtonSource).toContain(": 'color-mix(in srgb, var(--brand-green) 20%, var(--shell-chip-bg) 80%)'")
    expect(followButtonSource).toContain(": 'var(--foreground-strong)'")
    expect(followButtonSource).not.toContain(": 'linear-gradient(135deg,#9be11d,#4ade80)'")
    expect(followButtonSource).not.toContain(": '#04121f'")
    expect(followButtonSource).not.toContain(": 'var(--text-dark)'")
  })

  it('keeps tier pathway CTAs shell-aware', () => {
    expect(tierPathwaySource).toContain('const ctaStyle: CSSProperties')
    expect(tierPathwaySource).toContain("background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)'")
    expect(tierPathwaySource).toContain("color: 'var(--foreground-strong)'")
    expect(tierPathwaySource).not.toContain("background: 'linear-gradient(135deg, var(--brand-lime) 0%, #c7f36b 100%)',\n  color: 'var(--text-dark)'")
  })
})
