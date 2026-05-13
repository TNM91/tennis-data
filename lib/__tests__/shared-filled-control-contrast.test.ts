import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const followButtonSource = readFileSync(join(process.cwd(), 'app/components/follow-button.tsx'), 'utf8')
const tierPathwaySource = readFileSync(join(process.cwd(), 'app/components/tier-pathway.tsx'), 'utf8')
const shellAwareControlBackground = "background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)'"
const shellAwareControlColor = "color: 'var(--foreground-strong)'"
const filledControlFiles = [
  'app/captain/page.tsx',
  'app/data-assist/page.tsx',
  'app/messages/page.tsx',
  'app/mylab/page.tsx',
  'app/players/[id]/page.tsx',
  'app/players/page.tsx',
  'app/profile/page.tsx',
  'app/rankings/page.tsx',
  'app/reset-password/page.tsx',
]
const publicAccessControlFiles = [
  'app/admin/upgrade-requests/page.tsx',
  'app/components/upgrade-prompt.tsx',
  'app/forget-password/page.tsx',
  'app/global-error.tsx',
  'app/join/page.tsx',
  'app/login/page.tsx',
  'app/pricing/page.tsx',
  'app/upgrade/page.tsx',
]

function collectTsxSources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) return collectTsxSources(fullPath)
    if (entry.endsWith('.tsx')) return [readFileSync(fullPath, 'utf8')]
    return []
  })
}

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
    expect(tierPathwaySource).toContain(shellAwareControlBackground)
    expect(tierPathwaySource).toContain(shellAwareControlColor)
    expect(tierPathwaySource).not.toContain("background: 'linear-gradient(135deg, var(--brand-lime) 0%, #c7f36b 100%)',\n  color: 'var(--text-dark)'")
  })

  it('keeps remaining high-visibility filled controls shell-aware', () => {
    for (const file of filledControlFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      expect(source, file).toContain(shellAwareControlBackground)
      expect(source, file).toContain(shellAwareControlColor)
    }
  })

  it('keeps public access and upgrade controls shell-aware', () => {
    for (const file of publicAccessControlFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      expect(source, file).toContain("color: 'var(--foreground-strong)'")
      expect(source, file).toContain('color-mix(in srgb, var(--brand-green)')
      expect(source, file).not.toContain('linear-gradient(135deg, #9be11d')
      expect(source, file).not.toContain('linear-gradient(135deg, #9BE11D')
      expect(source, file).not.toContain('#08111d')
      expect(source, file).not.toContain('#06111d')
      expect(source, file).not.toContain('#04121a')
      expect(source, file).not.toContain('#07121f')
    }
  })

  it('keeps app TSX surfaces free of old dark-text filled green controls', () => {
    const appSource = collectTsxSources(join(process.cwd(), 'app')).join('\n')
    expect(appSource).not.toContain('var(--text-dark)')
    expect(appSource).not.toContain('#04121f')
  })
})
