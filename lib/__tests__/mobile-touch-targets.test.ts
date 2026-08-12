import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('mobile touch targets', () => {
  it('keeps core mobile plan, auth, league, and footer actions at least 44px tall', () => {
    const pricing = source('app/pricing/page.tsx')
    const login = source('app/login/page.tsx')
    const leagues = source('app/leagues/page.tsx')
    const footer = source('app/components/site-footer.tsx')
    const myLabStyles = source('app/mylab/my-lab-command-center.module.css')

    expect(pricing).toContain('const compactPrimaryPlanButtonStyle')
    expect(pricing).toContain('minHeight: 44')
    expect(login).toContain('const mobileInlineExploreLink')
    expect(login).toContain('minHeight: 44')
    expect(leagues).toContain("height: '44px'")
    expect(footer).toContain('const mobileFooterMetaLinkStyle')
    expect(footer).toContain("minHeight: '44px'")
    expect(myLabStyles).toMatch(/\.playerLink \{[\s\S]*?min-height: 44px;/)
  })

  it('does not shrink upgrade request fields below the mobile minimum', () => {
    const upgrade = source('app/upgrade/page.tsx')

    expect(upgrade).not.toContain('minHeight: isMobile ? 38 : inputStyle.minHeight')
    expect(upgrade.match(/minHeight: isMobile \? 44 : inputStyle\.minHeight/g)).toHaveLength(3)
    expect(upgrade).toMatch(/const secondaryInlineLinkStyle:[\s\S]*?minHeight: 44/)
  })
})
