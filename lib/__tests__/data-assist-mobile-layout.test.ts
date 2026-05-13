import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/data-assist/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Data Assist mobile layout guards', () => {
  it('keeps the public upload shell from widening on small screens', () => {
    for (const styleName of [
      'pageStyle',
      'heroCopyStyle',
      'heroActionRowStyle',
      'panelStyle',
      'sectionHeaderStyle',
      'typeOptionStyle',
      'dropzoneStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('titleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('sectionTitleStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('wraps long TennisLink filenames, teams, and action labels inside cards', () => {
    for (const styleName of [
      'primaryButtonStyle',
      'smallButtonStyle',
      'copyStyle',
      'hintStyle',
      'submissionCardStyle',
      'screenshotBodyStyle',
      'bulkResultListStyle',
    ]) {
      const block = styleBlock(styleName)
      expect(block).toMatch(/minWidth: 0|overflowWrap: 'anywhere'/)
    }
  })

  it('uses mobile-safe grids for screenshots, history filters, and contributor badges', () => {
    expect(styleBlock('screenshotCardStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))'")
    expect(styleBlock('badgeCardStyle')).toContain("flex: '1 1 min(100%, 190px)'")
    expect(styleBlock('historyFilterStyle')).toContain("overflowX: 'auto'")
    expect(styleBlock('historyFilterStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('historyFilterButtonStyle')).toContain("maxWidth: 'min(220px, 82vw)'")
    expect(styleBlock('scanLoadingStyle')).toContain("flexWrap: 'wrap'")
  })
})
