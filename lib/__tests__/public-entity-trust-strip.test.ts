import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('public entity trust strips', () => {
  it('provides a compact reusable trust strip with source, freshness, confidence, status, and Data Assist review actions', () => {
    const source = read('app/components/tiq-trust-strip.tsx')

    expect(source).toContain("import TrackedProductLink")
    expect(source).toContain("label: 'Source' | 'Freshness' | 'Confidence' | 'Status'")
    expect(source).toContain("actionLabel = 'Report issue'")
    expect(source).toContain('reviewContext')
    expect(source).toContain("label: 'Upload source'")
    expect(source).toContain("label: 'Report issue'")
    expect(source).toContain("label: 'Request review'")
    expect(source).toContain('intent=upload-source')
    expect(source).toContain('intent=report-issue')
    expect(source).toContain('intent=request-review')
    expect(source).toContain("eventName: 'data_issue_reported'")
    expect(source).toContain("eventName: 'data_assist_opened'")
    expect(source).toContain("metadata: {")
    expect(source).toContain("trustLabel: label")
    expect(source).toContain('aria-label={label}')
    expect(source).toContain('actionHref')
  })

  it('surfaces trust strips on public entity result cards', () => {
    const players = read('app/players/page.tsx')
    const teams = read('app/teams/page.tsx')
    const rankings = read('app/rankings/page.tsx')
    const leagues = read('app/leagues/page.tsx')
    const exploreLeagues = read('app/explore/leagues/page.tsx')

    for (const source of [players, teams, rankings, leagues, exploreLeagues]) {
      expect(source).toContain('TiqTrustStrip')
      expect(source).toContain("label: 'Source'")
      expect(source).toContain("label: 'Freshness'")
      expect(source).toContain("label: 'Confidence'")
      expect(source).toContain("label: 'Status'")
      expect(source).toContain("reviewContext={`")
    }
  })
})
