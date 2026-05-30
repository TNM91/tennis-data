import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/site-footer.tsx'), 'utf8')

describe('site footer contrast', () => {
  it('keeps footer CTAs and journey markers shell-aware', () => {
    expect(source).toContain('const footerNavLinkStyle')
    expect(source).toContain('const footerMetaLinkStyle')
    expect(source).toContain('const backToTopStyle')
    expect(source).toContain("color: 'var(--footer-link)'")
    expect(source).toContain("color: 'var(--footer-meta)'")
    expect(source).toContain("color: 'var(--foreground-strong)'")
    expect(source).toContain("background: 'transparent'")
    expect(source).not.toContain("background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',\n  color: 'var(--text-dark)'")
    expect(source).not.toContain("background: 'linear-gradient(135deg, var(--brand-green), var(--brand-green-3))',\n  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',\n  color: 'var(--text-dark)'")
  })
})
