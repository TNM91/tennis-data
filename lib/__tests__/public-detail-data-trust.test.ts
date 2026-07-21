import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const playerDetailSource = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')
const teamDetailSource = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')
const leagueDetailSource = readFileSync(join(process.cwd(), 'app/leagues/[league]/page.tsx'), 'utf8')
const tournamentDetailSource = readFileSync(join(process.cwd(), 'app/tournaments/[id]/page.tsx'), 'utf8')

function styleBlock(source: string, styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('public detail data trust panels', () => {
  it('surfaces reviewable player trust signals on player detail pages', () => {
    expect(playerDetailSource).toContain("import DataTrustPanel from '@/app/components/data-trust-panel'")
    expect(playerDetailSource).toContain('Player data trust')
    expect(playerDetailSource).toContain('Player profiles combine public player records')
    expect(playerDetailSource).toContain("label: 'Source'")
    expect(playerDetailSource).toContain("label: 'Freshness'")
    expect(playerDetailSource).toContain("label: 'Confidence'")
    expect(playerDetailSource).toContain("label: 'Status'")
    expect(playerDetailSource).toContain('Report, upload, or request review through Data Assist')
  })

  it('surfaces reviewable team trust signals on team detail pages', () => {
    expect(teamDetailSource).toContain("import DataTrustPanel from '@/app/components/data-trust-panel'")
    expect(teamDetailSource).toContain('Team data trust')
    expect(teamDetailSource).toContain('Team pages combine reviewed team summaries')
    expect(teamDetailSource).toContain("label: 'Source'")
    expect(teamDetailSource).toContain("label: 'Freshness'")
    expect(teamDetailSource).toContain("label: 'Confidence'")
    expect(teamDetailSource).toContain("label: 'Status'")
    expect(teamDetailSource).toContain('Report, upload, or request review through Data Assist')
  })

  it('surfaces reviewable league trust signals on league detail pages', () => {
    expect(leagueDetailSource).toContain("import DataTrustPanel from '@/app/components/data-trust-panel'")
    expect(leagueDetailSource).toContain('League data trust')
    expect(leagueDetailSource).toContain('League pages combine reviewed schedule rows')
    expect(leagueDetailSource).toContain("label: 'Source'")
    expect(leagueDetailSource).toContain("label: 'Freshness'")
    expect(leagueDetailSource).toContain("label: 'Confidence'")
    expect(leagueDetailSource).toContain("label: 'Status'")
    expect(leagueDetailSource).toContain('Report, upload, or request review through Data Assist')
  })

  it('surfaces reviewable tournament trust signals on tournament detail pages', () => {
    expect(tournamentDetailSource).toContain("import DataTrustPanel from '@/app/components/data-trust-panel'")
    expect(tournamentDetailSource).toContain('Tournament data trust')
    expect(tournamentDetailSource).toContain('Tournament pages combine Tournament Desk setup')
    expect(tournamentDetailSource).toContain("label: 'Source'")
    expect(tournamentDetailSource).toContain("label: 'Freshness'")
    expect(tournamentDetailSource).toContain("label: 'Confidence'")
    expect(tournamentDetailSource).toContain("label: 'Status'")
    expect(tournamentDetailSource).toContain('Report, upload, or request review through Data Assist')
  })

  it('keeps public tournament entry fields keyboard focus-visible', () => {
    expect(tournamentDetailSource).toContain('const [entryFocusedField, setEntryFocusedField] = useState<string | null>(null)')
    expect(tournamentDetailSource).toContain("onFocus={() => setEntryFocusedField('name')}")
    expect(tournamentDetailSource).toContain("onFocus={() => setEntryFocusedField('email')}")
    expect(tournamentDetailSource).toContain("onFocus={() => setEntryFocusedField('phone')}")
    expect(tournamentDetailSource).toContain("onFocus={() => setEntryFocusedField('rating')}")
    expect(tournamentDetailSource).toContain('const entryInputFocusStyle: CSSProperties')
    expect(styleBlock(tournamentDetailSource, 'entryInputStyle')).toContain("outline: '2px solid transparent'")
    expect(styleBlock(tournamentDetailSource, 'entryInputStyle')).toContain('outlineOffset: 2')
    expect(styleBlock(tournamentDetailSource, 'entryInputStyle')).not.toContain("outline: 'none'")
  })

  it('keeps public detail watermarks inside phone-width heroes', () => {
    for (const source of [teamDetailSource, leagueDetailSource]) {
      const watermark = styleBlock(source, 'watermarkStyle')
      expect(watermark).toContain('right: 0')
      expect(watermark).toContain("width: 'min(100%, 310px)'")
      expect(watermark).not.toContain("right: '-110px'")
    }

    const tournamentWatermark = styleBlock(tournamentDetailSource, 'watermarkStyle')
    expect(tournamentWatermark).toContain('right: 0')
    expect(tournamentWatermark).toContain("width: 'min(100%, 320px)'")
    expect(tournamentWatermark).not.toContain("right: '-110px'")
  })
})
