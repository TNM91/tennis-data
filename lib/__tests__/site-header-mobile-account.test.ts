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

  it('keeps profile and message labels wrap-safe in the drawer', () => {
    expect(source).toContain('Manage profile')
    expect(source).toContain('mobilePlainItemTextStyle')
    expect(source).toContain('mobileMessageLinkWrapStyle')
    expect(source).toContain('<span style={mobilePlainItemTextStyle}>{item.label}</span>')
    expect(source).toContain('<span style={mobilePlainItemTextStyle}>Admin dashboard</span>')
    expect(source).toContain('<span style={mobilePlainItemTextStyle}>Start Free</span>')
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("flexWrap: 'wrap' as const")
  })

  it('keeps desktop header labels bounded and wrap-safe', () => {
    expect(source).toContain('const navTextWrapStyle')
    expect(source).toContain('const navLabelStyle')
    expect(source).toContain('const utilityButtonStyle')
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
})
