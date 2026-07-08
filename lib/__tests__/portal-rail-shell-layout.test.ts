import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const siteShellSource = readFileSync(join(process.cwd(), 'app/components/site-shell.tsx'), 'utf8')
const portalToolBarSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')
const siteFooterSource = readFileSync(join(process.cwd(), 'app/components/site-footer.tsx'), 'utf8')
const globalsSource = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
const shellSmokeSource = readFileSync(join(process.cwd(), 'scripts/site-shell-layout-smoke.mjs'), 'utf8')

describe('portal rail shell layout', () => {
  it('keeps the desktop portal rail fixed and scrollable without a visible nested scrollbar', () => {
    expect(siteShellSource).toContain('data-portal-rail="true"')
    expect(siteShellSource).toContain('data-portal-content-scroll="true"')
    expect(siteShellSource).toContain("position: 'fixed'")
    expect(siteShellSource).toContain("height: 'calc(100dvh - var(--header-height) - 20px)'")
    expect(siteShellSource).toContain("overflow: 'auto'")
    expect(siteShellSource).toContain("maxHeight: 'calc(100dvh - var(--header-height) - 20px)'")
    expect(siteShellSource).toContain("height: 'calc(100dvh - var(--header-height))'")
    expect(siteShellSource).toContain("overflow: 'hidden'")
    expect(siteShellSource).toContain('const portalRailScrollStyle')
    expect(siteShellSource).toContain("overflowY: 'auto'")
    expect(siteShellSource).toContain("overscrollBehavior: 'contain'")
    expect(siteShellSource).toContain('<SiteFooter railLayout railWidth={0} />')
    expect(siteShellSource).not.toContain("scrollbarGutter: 'stable'")
    expect(siteShellSource.indexOf("height: 'calc(100dvh - var(--header-height) - 20px)'")).toBeLessThan(
      siteShellSource.indexOf("maxHeight: 'calc(100dvh - var(--header-height) - 20px)'"),
    )

    expect(portalToolBarSource).toContain("gridTemplateRows: 'auto auto auto'")
    expect(portalToolBarSource).toContain("minHeight: '100%'")
    expect(portalToolBarSource).toContain('data-portal-rail-sections={lane.id}')
    expect(portalToolBarSource).toContain('function PortalRailTaskLink')
    expect(portalToolBarSource).toContain('const laneActive = lane.id === activeLane.id')
    expect(portalToolBarSource).toContain('active={isPortalTaskActive(currentPortalPath, task.href)}')
    expect(portalToolBarSource).toContain('railPortalTaskListStyle')
    expect(portalToolBarSource).toContain('getRailPortalTaskActiveStyle')
    expect(portalToolBarSource).not.toContain('railPortalStatusStyle')

    expect(globalsSource).toContain("[data-portal-rail='true']")
    expect(globalsSource).toContain('scrollbar-width: none')
    expect(globalsSource).toContain('-ms-overflow-style: none')
    expect(globalsSource).toContain("[data-portal-rail='true']::-webkit-scrollbar")
    expect(globalsSource).toContain('width: 0')
    expect(globalsSource).toContain('height: 0')
    expect(shellSmokeSource).toContain('railScrollbarWidth')
    expect(shellSmokeSource).toContain("type: 'rail-scrollbar-visible'")
    expect(shellSmokeSource).toContain('viewportHeight')
    expect(shellSmokeSource).toContain("type: 'rail-does-not-fill-viewport'")
    expect(shellSmokeSource).toContain("type: 'rail-footer-too-tall'")
    expect(shellSmokeSource).toContain("type: 'portal-content-scroll-missing'")
    expect(shellSmokeSource).toContain("type: 'portal-content-did-not-scroll'")
    expect(shellSmokeSource).toContain("type: 'portal-window-scrolled-with-content'")
    expect(shellSmokeSource).toContain("type: 'portal-header-moved-during-content-scroll'")
    expect(shellSmokeSource).toContain("type: 'portal-rail-moved-during-content-scroll'")
    expect(siteFooterSource).toContain("const railFooterOffset = railWidth > 0 ? railWidth + 32 : 0")
    expect(siteFooterSource).toContain('function scrollShellToTop()')
  })
})
