import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const trustPanelSource = readFileSync(join(process.cwd(), 'app/components/data-trust-panel.tsx'), 'utf8')
const playersSource = readFileSync(join(process.cwd(), 'app/players/page.tsx'), 'utf8')
const teamsSource = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')
const leaguesSource = readFileSync(join(process.cwd(), 'app/leagues/page.tsx'), 'utf8')
const rankingsSource = readFileSync(join(process.cwd(), 'app/rankings/page.tsx'), 'utf8')

describe('public data trust panels', () => {
  it('keeps source, freshness, confidence, status, and review actions reusable', () => {
    expect(trustPanelSource).toContain("'use client'")
    expect(trustPanelSource).toContain("import TrackedProductLink from '@/app/components/tracked-product-link'")
    expect(trustPanelSource).toContain("'Source'")
    expect(trustPanelSource).toContain("'Freshness'")
    expect(trustPanelSource).toContain("'Confidence'")
    expect(trustPanelSource).toContain("'Status'")
    expect(trustPanelSource).toContain('Upload source')
    expect(trustPanelSource).toContain('Report issue')
    expect(trustPanelSource).toContain('/legal/data-policy')
    expect(trustPanelSource).toContain('Request review')
    expect(trustPanelSource).toContain('ariaLabel={`Upload source for ${title}`}')
    expect(trustPanelSource).toContain('ariaLabel={`Report issue for ${title}`}')
    expect(trustPanelSource).toContain('ariaLabel={`Request review for ${title}`}')
    expect(trustPanelSource).toContain('aria-label={`Read data policy for ${title}`}')
    expect(trustPanelSource).toContain('/data-assist?intent=upload-source')
    expect(trustPanelSource).toContain('/data-assist?intent=request-review')
    expect(trustPanelSource).toContain('const contextQuery = encodeURIComponent(title)')
    expect(trustPanelSource).toContain('context=${contextQuery}')
    expect(trustPanelSource).toContain("eventName: 'data_assist_opened'")
    expect(trustPanelSource).toContain("eventName: 'data_issue_reported'")
    expect(trustPanelSource).toContain("action: 'request_review'")
  })

  it('surfaces trust panels on public directory fallback states', () => {
    expect(playersSource).toContain('Player data trust')
    expect(playersSource).toContain('Why a player may be missing')
    expect(teamsSource).toContain('Team data trust')
    expect(teamsSource).toContain('Why a team may be missing')
    expect(leaguesSource).toContain('League data trust')
    expect(leaguesSource).toContain('Why a league may be missing')
    expect(rankingsSource).toContain('Ranking data trust')
  })
})
