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
    expect(source).toContain("gridTemplateColumns: 'minmax(0, 1fr) auto'")
    expect(source).toContain("width: '100%'")
  })

  it('keeps profile and message labels wrap-safe in the drawer', () => {
    expect(source).toContain('Manage profile')
    expect(source).toContain('mobilePlainItemTextStyle')
    expect(source).toContain('mobileMessageLinkWrapStyle')
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("flexWrap: 'wrap' as const")
  })
})
