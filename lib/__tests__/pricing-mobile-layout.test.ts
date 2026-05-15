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

    expect(styleBlock('decisionStepStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 28px) minmax(0, 34px) minmax(0, 1fr)'",
    )
    expect(styleBlock('featureRowStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 12px) minmax(0, 1fr)'",
    )
    expect(styleBlock('momentCardStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 56px) minmax(0, 1fr)'",
    )
    expect(styleBlock('stepRowStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 42px) minmax(0, 1fr)'",
    )
    expect(styleBlock('unlockStepPillStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 24px) minmax(0, 1fr)'",
    )
    expect(styleBlock('identityFlowCardStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 54px) minmax(0, 1fr)'",
    )
    for (const styleName of [
      'decisionStepStyle',
      'featureRowStyle',
      'momentCardStyle',
      'stepRowStyle',
      'unlockStepPillStyle',
      'identityFlowCardStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain('minWidth: 0')
    }
    expect(source).not.toContain("gridTemplateColumns: '28px 34px 1fr'")
    expect(source).not.toContain("gridTemplateColumns: '12px 1fr'")
    expect(source).not.toContain("gridTemplateColumns: '56px 1fr'")
    expect(source).not.toContain("gridTemplateColumns: '42px 1fr'")
    expect(source).not.toContain("gridTemplateColumns: '24px minmax(0, 1fr)'")
    expect(source).not.toContain("gridTemplateColumns: '54px minmax(0, 1fr)'")
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
