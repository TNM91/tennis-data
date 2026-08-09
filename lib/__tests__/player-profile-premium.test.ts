import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

describe('premium player profile', () => {
  it('uses the balanced profile hero at tablet landscape widths', () => {
    expect(source).toContain('const useSplitProfileHero = screenWidth >= 1180')
    expect(source).toContain('aria-label="Player score summary"')
    expect(source).toContain('aria-label="Player profile context"')
    expect(source).toContain('Competitive read')
    expect(source).toContain('Rating journey')
  })

  it('treats a new profile as a valid baseline instead of a losing record', () => {
    expect(source).toContain("const trackedRecordLabel = hasTrackedMatches ? `${wins}-${losses}` : '--'")
    expect(source).toContain('No reviewed results')
    expect(source).toContain('Starts after first result')
    expect(source).toContain('Building match history')
    expect(source).toContain("value={hasTrackedMatches ? confidence : 'Baseline'}")
    expect(source).toContain("'Awaiting results'")
  })

  it('keeps the first action choice focused while preserving the full toolset', () => {
    expect(source).toContain('const profilePrimaryActions = [')
    expect(source).toContain('aria-label="Primary player actions"')
    expect(source).toContain('Open Level Up plan')
    expect(source).toContain('Open the complete Player ID read')
    expect(source).toContain('aria-label="Player path actions"')
  })
})
