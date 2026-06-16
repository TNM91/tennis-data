import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const commandCenterSource = readFileSync(join(process.cwd(), 'app/components/public-command-center.tsx'), 'utf8')
const trackedLinkSource = readFileSync(join(process.cwd(), 'app/components/tracked-product-link.tsx'), 'utf8')
const eventsSource = readFileSync(join(process.cwd(), 'lib/product-usage-events.ts'), 'utf8')

describe('public CTA analytics', () => {
  it('uses a client-safe tracked link for public command-center CTAs', () => {
    expect(trackedLinkSource).toContain("'use client'")
    expect(trackedLinkSource).toContain('trackProductUsageEvent(event)')
    expect(commandCenterSource).toContain('TrackedProductLink')
    expect(commandCenterSource).toContain('getPublicLinkEvent')
  })

  it('maps public tennis actions to the requested product events', () => {
    for (const eventName of [
      'find_coach_clicked',
      'coach_hub_clicked',
      'coach_assignment_preview_clicked',
      'team_search_submitted',
      'captain_tools_clicked',
      'lineup_preview_clicked',
      'availability_clicked',
      'tournament_search_submitted',
      'run_tournament_clicked',
      'tournament_desk_clicked',
      'draw_preview_clicked',
      'league_search_submitted',
      'league_office_clicked',
      'schedule_preview_clicked',
      'standings_preview_clicked',
      'data_assist_opened',
      'data_issue_reported',
      'matchup_started',
      'search_category_selected',
      'search_result_clicked',
    ]) {
      expect(eventsSource).toContain(`'${eventName}'`)
      expect(commandCenterSource).toContain(`eventName: '${eventName}'`)
    }
  })

  it('tracks the homepage quick-start CTA language directly', () => {
    expect(commandCenterSource).toContain("target.includes('start exploring')")
    expect(commandCenterSource).toContain("target.includes('find player insights')")
    expect(commandCenterSource).toContain("target.includes('level up my game')")
    expect(commandCenterSource).toContain("target.includes('manage my team')")
    expect(commandCenterSource).toContain("target.includes('run a league or tournament')")
    expect(commandCenterSource).toContain("eventName: 'search_category_selected', surface: 'public_site'")
    expect(commandCenterSource).toContain("eventName: 'captain_tools_clicked', surface: 'captain'")
    expect(commandCenterSource).toContain("eventName: 'run_tournament_clicked', surface: 'tournaments'")
  })

  it('checks specific Data Assist trust actions before the generic Data Assist route', () => {
    const reportIndex = commandCenterSource.indexOf("target.includes('report issue')")
    const requestReviewIndex = commandCenterSource.indexOf("target.includes('request review')")
    const genericIndex = commandCenterSource.indexOf("target.includes('data assist') || target.includes('upload source')")

    expect(reportIndex).toBeGreaterThan(-1)
    expect(requestReviewIndex).toBeGreaterThan(-1)
    expect(genericIndex).toBeGreaterThan(-1)
    expect(reportIndex).toBeLessThan(genericIndex)
    expect(requestReviewIndex).toBeLessThan(genericIndex)
  })

  it('passes Data Assist intent and context from the homepage trust strip', () => {
    expect(commandCenterSource).toContain("context = 'Homepage trust strip'")
    expect(commandCenterSource).toContain('const trustContext = encodeURIComponent(context)')
    expect(commandCenterSource).toContain('/data-assist?intent=upload-source&context=${trustContext}')
    expect(commandCenterSource).toContain('/data-assist?intent=report-issue&context=${trustContext}')
    expect(commandCenterSource).toContain('/data-assist?intent=request-review&context=${trustContext}')
    expect(commandCenterSource).toContain("getPublicLinkEvent('Upload source', uploadHref, context)")
    expect(commandCenterSource).toContain("getPublicLinkEvent('Report issue', reportHref, context)")
    expect(commandCenterSource).toContain("getPublicLinkEvent('Request review', reviewHref, context)")
    expect(commandCenterSource).not.toContain("getPublicLinkEvent('Report issue', reportHref, 'trust-strip')")
  })
})
