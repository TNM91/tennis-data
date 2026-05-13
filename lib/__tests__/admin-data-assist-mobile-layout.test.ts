import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/admin/data-assist/page.tsx'), 'utf8')
const sharedSource = readFileSync(join(process.cwd(), 'app/admin/_components/admin-review-ui.tsx'), 'utf8')

function styleBlock(sourceText: string, styleName: string) {
  const start = sourceText.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = sourceText.indexOf('\nconst ', start + 1)
  return sourceText.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Admin Data Assist mobile layout guards', () => {
  it('keeps the shared admin review shell from forcing horizontal scroll', () => {
    for (const styleName of [
      'adminReviewFrameStyle',
      'adminHeroStyle',
      'adminHeroContentStyle',
      'adminReviewGridStyle',
      'adminReviewPanelStyle',
      'adminActionRowStyle',
      'adminReviewHeaderRowStyle',
      'adminFactStyle',
    ]) {
      expect(styleBlock(sharedSource, styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock(sharedSource, 'adminHeroTitleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(sharedSource, 'adminHeroSubtitleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(sharedSource, 'adminStatusPanelStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('wraps Data Assist queue filters and batch cards around long upload metadata', () => {
    for (const styleName of [
      'queueFilterRowStyle',
      'queueBatchButtonStyle',
      'queueBatchHeaderStyle',
      'queueBatchTitleStyle',
      'batchHeaderStyle',
      'batchHeaderCopyStyle',
    ]) {
      const block = styleBlock(source, styleName)
      expect(block).toMatch(/minWidth: 0|overflowWrap: 'anywhere'/)
    }

    expect(styleBlock(source, 'queueFilterButtonStyle')).toContain("whiteSpace: 'normal'")
  })

  it('keeps OCR review panels, screenshot cards, and draft facts mobile-safe', () => {
    for (const styleName of [
      'reviewSubPanelStyle',
      'compactReviewSubPanelStyle',
      'reviewSplitRowStyle',
      'ocrFactGridStyle',
      'parserWarningPanelStyle',
      'ocrPreviewTextStyle',
      'parsedLineCardStyle',
      'screenshotGridStyle',
      'screenshotCardStyle',
      'screenshotBodyStyle',
      'draftSummaryGridStyle',
    ]) {
      const block = styleBlock(source, styleName)
      expect(block).toMatch(/minWidth: 0|overflowWrap: 'anywhere'|gridTemplateColumns: 'repeat\(auto-fit, minmax\(min\(100%,/)
    }
  })
})
