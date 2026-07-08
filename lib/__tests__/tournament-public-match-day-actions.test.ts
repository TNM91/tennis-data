import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const pattern = new RegExp(`const ${styleName}(?:: CSSProperties)? = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
  const match = source.match(pattern)
  if (!match) throw new Error(`Missing style block: ${styleName}`)
  return match[0]
}

describe('public tournament match-day actions', () => {
  it('keeps participant actions compact and status-driven', () => {
    expect(source).toContain('matchDayActions')
    expect(source).toContain('Event-day command board')
    expect(source).toContain('Check the next move before you scroll.')
    expect(source).toContain('Alerts, profile, draw, schedule, results, and awards stay close to the tournament status so players can act from one place.')
    expect(source).toContain('eventDayCommandStyle')
    expect(source).toContain('Match-day actions')
    expect(source).toContain('playerRailCopyStyle')
    expect(source).toContain('Court alerts')
    expect(source).toContain('Find yours')
    expect(source).toContain('results')
    expect(source).not.toContain('Manage tournament texts.')
    expect(source).not.toContain('Self-rated players show with an S until verified.')
    expect(source).not.toContain('Awards appear after the finish.')
  })

  it('connects tournament detail match day back into Player ID and Level Up prep', () => {
    expect(source).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(source).toContain("const TOURNAMENT_DETAIL_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('pressure-closer-4-0')")
    expect(source).toContain('const TOURNAMENT_DETAIL_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(TOURNAMENT_DETAIL_PLAYER_IDENTITY)')
    expect(source).toContain('const TOURNAMENT_DETAIL_LEVEL_UP_HREF = `/level-up/${TOURNAMENT_DETAIL_PLAYER_IDENTITY.slug}#level-up-flow`')
    expect(source).toContain('const TOURNAMENT_DETAIL_PLAYER_DEVELOPMENT_HREF = `/player-development/${TOURNAMENT_DETAIL_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('aria-label="Tournament detail Player ID match-day read"')
    expect(source).toContain('aria-label="Tournament detail Player ID starter read"')
    expect(source).toContain('Match day to Player ID')
    expect(source).toContain('Leave the tournament with one clearer rep.')
    expect(source).toContain('Use this read after checking the draw, court, or result so the next match has one pressure cue.')
    expect(source).toContain('Start Level Up')
    expect(source).toContain('Read Player ID')
    expect(source).toContain('Prep matchup')
    expect(source.indexOf('aria-label="Tournament detail Player ID match-day read"')).toBeGreaterThan(source.indexOf('aria-label="Match-day actions"'))
    expect(source.indexOf('aria-label="Tournament detail Player ID match-day read"')).toBeGreaterThan(source.indexOf('aria-label="Tournament readiness"'))
    expect(source.indexOf('aria-label="Tournament readiness"')).toBeLessThan(source.indexOf('aria-label="Match-day actions"'))
  })

  it('keeps the tournament detail Player ID read compact on phones', () => {
    expect(styleBlock('eventDayCommandStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))'")
    expect(styleBlock('eventDayCommandStyle')).toContain('minWidth: 0')
    expect(styleBlock('eventDayCommandStyle')).toContain("overflow: 'hidden'")
    expect(styleBlock('tournamentDetailPlayerIdStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))'")
    expect(styleBlock('tournamentDetailPlayerIdStyle')).toContain('minWidth: 0')
    expect(styleBlock('tournamentDetailPlayerIdStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('tournamentDetailPlayerIdGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(styleBlock('tournamentDetailPlayerIdCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('tournamentDetailPlayerIdActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('tournamentDetailPlayerIdActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('tournamentDetailPlayerIdActionStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('tournamentDetailPlayerIdActionStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
