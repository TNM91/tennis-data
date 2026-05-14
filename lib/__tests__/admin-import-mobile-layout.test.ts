import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/admin/import/page.tsx'), 'utf8')
const reviewPanelSource = readFileSync(join(process.cwd(), 'app/admin/import/_components/scorecard-review-panel.tsx'), 'utf8')
const sharedImportSource = readFileSync(join(process.cwd(), 'app/components/admin-import-ui.tsx'), 'utf8')

function styleBlock(styleName: string, content = source) {
  const start = content.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = content.indexOf('\nconst ', start + 1)
  return content.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Admin import mobile layout guards', () => {
  it('keeps import cards and action rows mobile-safe', () => {
    expect(styleBlock('glassCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('glassCardStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('adminImportActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('adminImportActionRowStyle')).toContain('minWidth: 0')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(source).not.toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(reviewPanelSource).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))'")
    expect(reviewPanelSource).not.toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
    expect(source).not.toContain("display: 'flex', gap: 12, marginTop: 18 }")
  })

  it('keeps import action buttons wrapped and shell-aware', () => {
    for (const styleName of ['primaryButtonStyle', 'secondaryButtonStyle']) {
      const block = styleBlock(styleName)
      expect(block).toContain('minWidth: 0')
      expect(block).toContain("maxWidth: '100%'")
      expect(block).toContain("whiteSpace: 'normal'")
      expect(block).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('primaryButtonStyle')).toContain("color: 'var(--foreground-strong)'")
    expect(styleBlock('primaryButtonStyle')).not.toContain("color: '#0a0a0a'")
  })

  it('keeps shared import preview tables within the mobile scroll shell', () => {
    expect(styleBlock('importTableWrapStyle', sharedImportSource)).toContain('minWidth: 0')
    expect(styleBlock('importTableWrapStyle', sharedImportSource)).toContain("overflowX: 'auto'")
    expect(styleBlock('importTableWrapStyle', sharedImportSource)).toContain("overscrollBehaviorX: 'contain'")
    expect(styleBlock('importTableWrapStyle', sharedImportSource)).toContain("WebkitOverflowScrolling: 'touch'")
    expect(styleBlock('invalidRowsTableStyle', sharedImportSource)).toContain("minWidth: 'min(100%, 840px)'")
    expect(styleBlock('previewRowsTableStyle', sharedImportSource)).toContain("minWidth: 'min(100%, 1080px)'")
    expect(sharedImportSource).not.toContain('style={{ minWidth: 840 }}')
    expect(sharedImportSource).not.toContain('style={{ minWidth: 1080 }}')
  })
})
