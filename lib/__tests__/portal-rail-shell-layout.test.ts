import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const siteShellSource = readFileSync(join(process.cwd(), 'app/components/site-shell.tsx'), 'utf8')
const globalsSource = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
const shellSmokeSource = readFileSync(join(process.cwd(), 'scripts/site-shell-layout-smoke.mjs'), 'utf8')

describe('portal rail shell layout', () => {
  it('keeps the desktop portal rail fixed and scrollable without a visible nested scrollbar', () => {
    expect(siteShellSource).toContain('data-portal-rail="true"')
    expect(siteShellSource).toContain("position: 'fixed'")
    expect(siteShellSource).toContain("overflow: 'auto'")
    expect(siteShellSource).toContain("maxHeight: 'calc(100dvh - var(--header-height) - 20px)'")
    expect(siteShellSource).not.toContain("scrollbarGutter: 'stable'")

    expect(globalsSource).toContain("[data-portal-rail='true']")
    expect(globalsSource).toContain('scrollbar-width: none')
    expect(globalsSource).toContain('-ms-overflow-style: none')
    expect(globalsSource).toContain("[data-portal-rail='true']::-webkit-scrollbar")
    expect(globalsSource).toContain('width: 0')
    expect(globalsSource).toContain('height: 0')
    expect(shellSmokeSource).toContain('railScrollbarWidth')
    expect(shellSmokeSource).toContain("type: 'rail-scrollbar-visible'")
  })
})
