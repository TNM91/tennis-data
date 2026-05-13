import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const exploreSource = readFileSync(join(process.cwd(), 'app/explore/page.tsx'), 'utf8')
const rankingsSource = readFileSync(join(process.cwd(), 'app/rankings/page.tsx'), 'utf8')
const playersSource = readFileSync(join(process.cwd(), 'app/players/page.tsx'), 'utf8')
const playerDetailSource = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')
const teamsSource = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')
const teamDetailSource = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')
const leaguesSource = readFileSync(join(process.cwd(), 'app/leagues/page.tsx'), 'utf8')
const leagueDetailSource = readFileSync(join(process.cwd(), 'app/leagues/[league]/page.tsx'), 'utf8')
const exploreLeaguesSource = readFileSync(join(process.cwd(), 'app/explore/leagues/page.tsx'), 'utf8')
const ustaExploreLeagueDetailSource = readFileSync(join(process.cwd(), 'app/explore/leagues/usta/[league]/page.tsx'), 'utf8')
const tiqLeagueDetailSource = readFileSync(join(process.cwd(), 'app/explore/leagues/tiq/[league]/page.tsx'), 'utf8')

describe('Explore responsive surfaces', () => {
  it('keeps Explore action cards protected from narrow mobile overflow', () => {
    expect(exploreSource).toContain('const actionBody: CSSProperties')
    expect(exploreSource).toContain('const actionFooterRow: CSSProperties')
    expect(exploreSource).toContain("overflowWrap: 'anywhere'")
    expect(exploreSource).toContain("flexWrap: 'wrap'")
    expect(exploreSource).toContain('minWidth: 0')
  })

  it('keeps Explore start-step markers shell-aware across themes', () => {
    expect(exploreSource).toContain('const startStepNumber: CSSProperties')
    expect(exploreSource).toContain("background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)'")
    expect(exploreSource).toContain("color: 'var(--foreground-strong)'")
    expect(exploreSource).not.toContain("color: 'var(--text-dark)',\n  background: 'linear-gradient(135deg, var(--brand-green) 0%, #4ade80 100%)'")
  })

  it('keeps rankings compact cards single-column friendly on mobile', () => {
    expect(rankingsSource).toContain('dynamicLeaderboardActionGrid')
    expect(rankingsSource).toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(rankingsSource).toContain('const compactRankingCardStyle: CSSProperties')
    expect(rankingsSource).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 112px), 1fr))'")
    expect(rankingsSource).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))'")
    expect(rankingsSource).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps public discovery empty states actionable and Data Assist aware', () => {
    expect(playersSource).toContain('Public discovery only shows reviewed player context')
    expect(playersSource).toContain('Reset filters')
    expect(playersSource).toContain('emptyStateActionRow')
    expect(playersSource).toContain('DATA_ASSIST_STORY.cta')

    expect(teamsSource).toContain('Public discovery only shows reviewed team context')
    expect(teamsSource).toContain('Reset team filters')
    expect(teamsSource).toContain('emptyActionRow')
    expect(teamsSource).toContain('DATA_ASSIST_STORY.cta')
  })

  it('keeps Teams directory readable in light mode with shell tokens', () => {
    expect(teamsSource).toContain('var(--background)')
    expect(teamsSource).toContain("color: 'var(--foreground)'")
    expect(teamsSource).toContain("background: 'var(--shell-panel-bg)'")
    expect(teamsSource).toContain("color: 'var(--foreground-strong)'")
    expect(teamsSource).toContain("color: 'var(--shell-copy-muted)'")
    expect(teamsSource).toContain("colorScheme: 'normal'")
    expect(teamsSource).not.toContain("colorScheme: 'dark'")
  })

  it('keeps Leagues directory Data Assist centered and light-mode readable', () => {
    expect(leaguesSource).toContain('Browse uploaded league seasons.')
    expect(leaguesSource).toContain('reviewed Data Assist league groupings')
    expect(leaguesSource).toContain('DATA_ASSIST_STORY.cta')
    expect(leaguesSource).toContain("background: 'var(--shell-chip-bg)'")
    expect(leaguesSource).toContain("color: 'var(--foreground-strong)'")
    expect(leaguesSource).toContain("color: 'var(--shell-copy-muted)'")
    expect(leaguesSource).toContain("colorScheme: 'normal'")
    expect(leaguesSource).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps league detail pages Data Assist aware and light-mode readable', () => {
    expect(leagueDetailSource).toContain('reviewed match rows')
    expect(leagueDetailSource).toContain('DATA_ASSIST_STORY.cta')
    expect(leagueDetailSource).toContain('Use reviewed Data Assist uploads')
    expect(leagueDetailSource).toContain('const standingsTableScrollStyle: CSSProperties')
    expect(leagueDetailSource).toContain("overscrollBehaviorX: 'contain'")
    expect(leagueDetailSource).toContain("minWidth: 700")
    expect(leagueDetailSource).toContain("background: 'var(--shell-panel-bg)'")
    expect(leagueDetailSource).toContain("background: 'var(--shell-chip-bg)'")
    expect(leagueDetailSource).toContain("color: 'var(--foreground-strong)'")
    expect(leagueDetailSource).toContain("color: 'var(--shell-copy-muted)'")
    expect(leagueDetailSource).toContain("colorScheme: 'normal'")
    expect(leagueDetailSource).toContain("overflowWrap: 'anywhere'")
    expect(leagueDetailSource).toContain("subtitle={subtitleParts.join(' | ')}")
    expect(leagueDetailSource).toContain("row.score ?? '-'")
    expect(leagueDetailSource).not.toContain("<Link href={teamHref} style={{ color: '#93c5fd'")
    expect(leagueDetailSource).not.toContain("row.score ?? '—'")
    expect(ustaExploreLeagueDetailSource).toContain("export { default } from '@/app/leagues/[league]/page'")
  })

  it('keeps team detail pages Data Assist aware and light-mode readable', () => {
    expect(teamDetailSource).toContain('reviewed scorecards')
    expect(teamDetailSource).toContain('No reviewed scorecards yet')
    expect(teamDetailSource).toContain('reviewed Data Assist scorecards')
    expect(teamDetailSource).toContain('DATA_ASSIST_STORY.cta')
    expect(teamDetailSource).toContain("background: 'var(--shell-panel-bg)'")
    expect(teamDetailSource).toContain("background: 'var(--shell-chip-bg)'")
    expect(teamDetailSource).toContain("color: 'var(--foreground-strong)'")
    expect(teamDetailSource).toContain("color: 'var(--shell-copy-muted)'")
    expect(teamDetailSource).toContain("boxShadow: 'var(--shadow-soft)'")
  })

  it('keeps player detail analytics and match lists mobile-safe', () => {
    expect(playerDetailSource).toContain('const comparisonMetricGridStyle: CSSProperties')
    expect(playerDetailSource).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))'")
    expect(playerDetailSource).toContain('const matchHistoryToolbarStyle: CSSProperties')
    expect(playerDetailSource).toContain("width: 'min(100%, 180px)'")
    expect(playerDetailSource).toContain('const rivalryRowStyle: CSSProperties')
    expect(playerDetailSource).toContain('const seasonTableWrapStyle: CSSProperties')
    expect(playerDetailSource).toContain("WebkitOverflowScrolling: 'touch'")
    expect(playerDetailSource).toContain('const nearbyPlayerRowStyle: CSSProperties')
    expect(playerDetailSource).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps Explore Leagues empty lanes separated by source and workflow', () => {
    expect(exploreLeaguesSource).toContain("emptyKind=\"usta\"")
    expect(exploreLeaguesSource).toContain('USTA league lanes come from reviewed TennisLink exports')
    expect(exploreLeaguesSource).toContain('Search leagues')
    expect(exploreLeaguesSource).toContain("emptyKind=\"tiq-team\"")
    expect(exploreLeaguesSource).toContain('TIQ team leagues are coordinator-created seasons')
    expect(exploreLeaguesSource).toContain('Create team league')
    expect(exploreLeaguesSource).toContain("emptyKind=\"tiq-individual\"")
    expect(exploreLeaguesSource).toContain('TIQ individual leagues are coordinator-created player-vs-player seasons')
    expect(exploreLeaguesSource).toContain('Create individual league')
  })

  it('keeps TIQ league standings and team results theme-aware on mobile', () => {
    expect(tiqLeagueDetailSource).toContain('const teamStandingsScrollStyle: CSSProperties')
    expect(tiqLeagueDetailSource).toContain("overscrollBehaviorX: 'contain'")
    expect(tiqLeagueDetailSource).toContain("minWidth: '620px'")
    expect(tiqLeagueDetailSource).toContain("color: 'var(--foreground-strong)'")
    expect(tiqLeagueDetailSource).toContain("color: 'var(--shell-copy-muted)'")
    expect(tiqLeagueDetailSource).toContain("border: '1px solid var(--shell-panel-border)'")
    expect(tiqLeagueDetailSource).toContain("overflowWrap: 'anywhere'")
    expect(tiqLeagueDetailSource).toContain("join(' | ')")
    expect(tiqLeagueDetailSource).not.toContain("color: '#94a3b8'")
    expect(tiqLeagueDetailSource).not.toContain("color: '#64748b'")
    expect(tiqLeagueDetailSource).not.toContain("color: '#cbd5e1'")
  })
})
