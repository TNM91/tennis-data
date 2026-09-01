import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/season-dashboard/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain season signal', () => {
  it('turns reported team form into one evidence-based next-week recommendation', () => {
    expect(source).toContain('const seasonSignal = !seasonResults.length')
    expect(source).toContain("title: 'Build the first season read'")
    expect(source).toContain("title: currentStreak || 'Keep the positive momentum'")
    expect(source).toContain("title: currentStreak || 'Reset the next match plan'")
    expect(source).toContain('aria-label="Season signal"')
    expect(source).toContain('reported form')
    expect(source).toContain('lineupProjectionHref')
  })

  it('keeps the recommendation card mobile-safe', () => {
    expect(styleBlock('seasonSignalCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('seasonSignalCardStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('seasonSignalCopyStyle')).toContain('minWidth: 0')
    expect(styleBlock('seasonSignalTitleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('seasonSignalDetailStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
