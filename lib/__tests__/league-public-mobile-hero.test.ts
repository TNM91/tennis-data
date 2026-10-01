import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/explore/leagues/tiq/[league]/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('public league mobile hero', () => {
  it('leads with the uploaded league logo and keeps it fully visible', () => {
    expect(source).toContain("src={league.photoUrl || '/brand/web/header-iq-compact.png'}")
    expect(source).toContain("alt={league.photoUrl ? `${league.leagueName} logo` : 'TenAceIQ'}")
    expect(styleBlock('mobileLeagueLogo')).toContain("objectFit: 'contain'")
    expect(styleBlock('leaguePhoto')).toContain("objectFit: 'contain'")
  })

  it('replaces mobile system labels with concise player context and actions', () => {
    expect(source).toContain("{isMobile ? 'League home' : 'TIQ League'}")
    expect(source).toContain('{isMobile ? <GhostLink href="#league-schedule">See schedule</GhostLink> : null}')
    expect(source).toContain("[league.seasonLabel, league.flight, league.locationLabel].filter(Boolean).join(' · ')")
    expect(source).toContain("activeEntryCount === 1 ? 'player' : 'players'")
    expect(source).toContain('{!isMobile ? <span aria-hidden="true" style={watermarkStyle} /> : null}')
    expect(source).toContain('{!isMobile ? <div style={sideCard}>')
    expect(source).toContain('key={`${item.href}-${item.label}`}')
  })

  it('does not show the irrelevant third-set badge for rotating-partner doubles', () => {
    expect(source).toContain('{!league.weeklySettings.enabled ? (')
    expect(source).toContain('getTiqLeagueThirdSetRuleLabel(league.thirdSetRule)')
  })
})
