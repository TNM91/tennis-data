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
    expect(styleBlock('pageWrapStyle')).toContain(
      "width: 'min(1280px, calc(100% - clamp(20px, 5vw, 28px)))'",
    )
    expect(styleBlock('pageWrapStyle')).toContain('minWidth: 0')
    expect(source).not.toContain("calc(100% - 28px)")

    for (const styleName of [
      'planGridStyle',
      'jobChooserGridStyle',
      'jobChooserCardStyle',
      'planCardStyle',
      'workspaceGridStyle',
      'workspaceCardStyle',
      'fullCourtPassStyle',
      'fullCourtPassGridStyle',
      'fullCourtPassLinkStyle',
      'fullCourtWorkspaceFitProofStyle',
      'fullCourtWorkspaceFitHeaderStyle',
      'fullCourtWorkspaceFitGridStyle',
      'fullCourtWorkspaceFitCardStyle',
      'sectionHeaderStyle',
      'tableWrapStyle',
      'billingBandStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain('minWidth: 0')
    }
    expect(styleBlock('planGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))'")
    expect(styleBlock('jobChooserGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))'")
    expect(styleBlock('workspaceGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))'")
    expect(styleBlock('fullCourtPassStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))'")
    expect(styleBlock('fullCourtPassGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(styleBlock('fullCourtWorkspaceFitGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))'")
    expect(styleBlock('billingBandStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))'")
    expect(source).not.toContain("gridTemplateColumns: '28px 34px 1fr'")
    expect(source).not.toContain("gridTemplateColumns: '12px 1fr'")
    expect(source).not.toContain("gridTemplateColumns: '56px 1fr'")
    expect(source).not.toContain("gridTemplateColumns: '42px 1fr'")
    expect(source).not.toContain("gridTemplateColumns: '24px minmax(0, 1fr)'")
    expect(source).not.toContain("gridTemplateColumns: '54px minmax(0, 1fr)'")
  })

  it('keeps the plan fit matrix scroll contained and text-safe', () => {
    expect(styleBlock('tableWrapStyle')).toContain("overflowX: 'auto'")
    expect(styleBlock('tableWrapStyle')).toContain("overscrollBehaviorX: 'contain'")
    expect(styleBlock('tableWrapStyle')).toContain("WebkitOverflowScrolling: 'touch'")
    expect(styleBlock('tableWrapStyle')).toContain("scrollbarWidth: 'thin'")
    expect(styleBlock('tableWrapStyle')).toContain('minWidth: 0')
    expect(styleBlock('compareTableStyle')).toContain('minWidth: 820')
    for (const styleName of [
      'tableHeadStyle',
      'tableNeedStyle',
      'tableCellStyle',
      'jobChooserCardStyle',
      'workspaceCardStyle',
      'fullCourtPassLinkStyle',
      'fullCourtWorkspaceFitProofStyle',
      'fullCourtWorkspaceFitHeaderStyle',
      'fullCourtWorkspaceFitCardStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }
  })
})
