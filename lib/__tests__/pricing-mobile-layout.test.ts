import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('pricing mobile layout guards', () => {
  it('keeps pricing icon-card grids bounded and shrinkable', () => {
    expect(styleBlock('entitlementClarityCardStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 2.25rem) minmax(0, 1fr)'",
    )
    expect(styleBlock('entitlementClarityCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('unlockPathCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('unlockPathCardHeaderStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 2.75rem) minmax(0, 1fr)'",
    )
    expect(styleBlock('unlockPathCardHeaderStyle')).toContain('minWidth: 0')
  })

  it('keeps the plan fit matrix scroll contained and text-safe', () => {
    expect(styleBlock('fitMatrixShellStyle')).toContain("overflowX: 'auto'")
    expect(styleBlock('fitMatrixShellStyle')).toContain("overscrollBehaviorX: 'contain'")
    expect(styleBlock('fitMatrixShellStyle')).toContain("WebkitOverflowScrolling: 'touch'")
    expect(styleBlock('fitMatrixShellStyle')).toContain("scrollbarWidth: 'thin'")
    expect(styleBlock('fitMatrixShellStyle')).toContain('minWidth: 0')
    expect(styleBlock('unlockPathHeaderStyle')).toContain('minWidth: 0')
    expect(styleBlock('unlockPathHeaderStyle')).toContain("flexWrap: 'wrap'")

    for (const styleName of [
      'fitMatrixHeaderStyle',
      'fitMatrixGridStyle',
      'fitMatrixMobileStackStyle',
      'fitMatrixMobileCardStyle',
      'fitMatrixMobilePlanGridStyle',
      'fitMatrixMobilePlanStyle',
      'fitMatrixHeadCellStyle',
      'fitMatrixJobCellStyle',
      'fitMatrixCellStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain('minWidth: 0')
    }

    for (const styleName of [
      'fitMatrixTitleStyle',
      'fitMatrixMobilePlanNameStyle',
      'fitMatrixHeadCellStyle',
      'fitMatrixJobCellStyle',
      'fitMatrixCellStyle',
      'fitMatrixPositiveStyle',
      'fitMatrixIncludedStyle',
      'unlockPathTitleStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }
  })
})
