import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const themeProviderSource = readFileSync(join(process.cwd(), 'app/components/theme-provider.tsx'), 'utf8')
const layoutSource = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
const manualChecklistSource = readFileSync(join(process.cwd(), 'docs/pr-123-90-minute-manual-test-checklist.md'), 'utf8')

describe('single dark-shell theme contract', () => {
  it('keeps the app wired to one dark theme provider without toggle APIs', () => {
    expect(layoutSource).toContain('<ThemeProvider>{children}</ThemeProvider>')
    expect(themeProviderSource).toContain("export type ThemeMode = 'dark'")
    expect(themeProviderSource).toContain("document.documentElement.dataset.theme = 'dark'")
    expect(themeProviderSource).toContain("document.documentElement.style.colorScheme = 'dark'")
    expect(themeProviderSource).not.toContain('setTheme')
    expect(themeProviderSource).not.toContain('toggleTheme')
    expect(themeProviderSource).not.toContain('localStorage')
    expect(themeProviderSource).not.toContain('prefers-color-scheme')
  })

  it('keeps the manual QA checklist aligned to the single-theme rollout', () => {
    expect(manualChecklistSource).toContain('Navigation And Single Theme Pass')
    expect(manualChecklistSource).toContain('single dark-shell')
    expect(manualChecklistSource).not.toContain('Switch light to dark')
    expect(manualChecklistSource).not.toContain('Switch dark to light')
    expect(manualChecklistSource).not.toContain('Theme toggle works')
  })
})
