import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const siteShellSource = read('app/components/site-shell.tsx')
const portalToolBarSource = read('app/components/portal-tool-bar.tsx')

describe('consistent portal shell layout', () => {
  it('uses one shared top portal instead of a split desktop rail', () => {
    expect(siteShellSource).toContain('railLayout={false}')
    expect(siteShellSource).toContain('<PortalToolBar suppressed={compactSiteMenuOpen} />')
    expect(siteShellSource).toContain('<SiteFooter railLayout={false} railWidth={0} />')
    expect(siteShellSource).not.toContain('data-portal-rail="true"')
    expect(siteShellSource).not.toContain('data-portal-content-scroll="true"')
    expect(siteShellSource).not.toContain("position: 'fixed'")
  })

  it('keeps the seven-lane catalog ordered and mobile-safe', () => {
    expect(portalToolBarSource).toContain("const portalLaneOrder: PortalLaneId[] = ['find', 'you', 'compete', 'team', 'coach', 'league', 'club']")
    expect(portalToolBarSource).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(portalToolBarSource).toContain("overflow: 'hidden'")
    expect(portalToolBarSource).toContain('minHeight: 56')
    expect(portalToolBarSource).toContain('...orderedPortalLanes.map((lane): PortalShortcut => ({')
  })
})
