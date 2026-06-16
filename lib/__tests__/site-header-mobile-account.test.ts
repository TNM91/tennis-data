import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/site-header.tsx'), 'utf8')

describe('site header mobile account drawer', () => {
  it('keeps the account tools in a stable mobile grid', () => {
    expect(source).toContain('const mobilePanelTopStyle')
    expect(source).toContain("display: 'grid'")
    expect(source).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    expect(source).toContain('const mobileAccountToolsStyle')
    expect(source).toContain("gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)'")
    expect(source).toContain("width: '100%'")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).not.toContain("'minmax(0, 1fr) auto'")
    expect(source).not.toContain("'auto minmax(0, 1fr) auto'")
  })

  it('keeps account utility labels wrap-safe in the drawer', () => {
    expect(source).toContain('mobilePlainItemTextStyle')
    expect(source).toContain('function MobileItemLabel')
    expect(source).toContain('<MobileItemLabel label="Admin dashboard" />')
    expect(source).toContain('<MobileItemLabel label="Logout" />')
    expect(source).toContain('<MobileItemLabel label="Sign in" description="Open your saved tennis workspace." />')
    expect(source).toContain('<MobileItemLabel label="Start Free" description="Explore public tennis context before upgrading." />')
    expect(source).toContain('const mobileItemCopyStyle')
    expect(source).toContain('const mobileItemDescriptionStyle')
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).not.toContain('mobileMessageLinkWrapStyle')
  })

  it('leaves Messages and Alerts to the portal toolbar instead of duplicating them in the header', () => {
    expect(source).not.toContain('messages#alerts')
    expect(source).not.toContain('countUnreadInternalNotifications')
    expect(source).not.toContain('unreadAlerts')
  })

  it('keeps desktop header labels bounded and wrap-safe', () => {
    expect(source).toContain('const utilityLinkStyle')
    expect(source).toContain('const accountPillStyle')
    expect(source).toContain('const utilityButtonStyle')
    expect(source).toContain('const primaryCtaStyle')
    expect(source).toContain("maxWidth: '100%'")
    expect(source).toContain("overflow: 'hidden'")
    expect(source).toContain("whiteSpace: 'normal' as const")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("textOverflow: 'ellipsis'")
    expect(source).not.toContain("whiteSpace: 'nowrap' as const")
  })

  it('does not label a signed-in unresolved account as Free before role loads', () => {
    expect(source).toContain('const authenticated = Boolean(userId) || role !== \'public\'')
    expect(source).toContain("const resolvedRole = authResolved || !userId ? role : 'member'")
    expect(source).toContain("? 'Account'")
    expect(source).toContain('buildProductAccessState(resolvedRole, entitlements)')
  })

  it('labels Coach and Full-Court accounts distinctly', () => {
    expect(source).toContain("access.currentPlanId === 'full_court'")
    expect(source).toContain("'Full-Court'")
    expect(source).toContain("access.currentPlanId === 'coach'")
    expect(source).toContain("'Coach'")
  })
})
