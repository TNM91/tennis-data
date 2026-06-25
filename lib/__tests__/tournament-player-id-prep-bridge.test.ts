import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/tournaments/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const pattern = new RegExp(`const ${styleName}(?:: CSSProperties)? = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
  const match = source.match(pattern)
  if (!match) throw new Error(`Missing style block: ${styleName}`)
  return match[0]
}

describe('Tournament Player ID prep bridge', () => {
  it('connects event discovery to Player ID and Level Up prep', () => {
    expect(source).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(source).toContain("const TOURNAMENT_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('pressure-closer-4-0')")
    expect(source).toContain('const TOURNAMENT_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(TOURNAMENT_PLAYER_IDENTITY)')
    expect(source).toContain('const TOURNAMENT_LEVEL_UP_HREF = `/level-up/${TOURNAMENT_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('const TOURNAMENT_PLAYER_DEVELOPMENT_HREF = `/player-development/${TOURNAMENT_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('aria-label="Tournament Player ID prep bridge"')
    expect(source).toContain('aria-label="Tournament Player ID starter read"')
    expect(source).toContain('Tournament to Player ID')
    expect(source).toContain('Turn the draw into one pressure cue.')
    expect(source).toContain('Use Player ID when the event question shifts from where to play into how to handle the next score moment.')
    expect(source).toContain('Start Level Up')
    expect(source).toContain('Read Player ID')
    expect(source).toContain('Prep matchup')
    expect(source.indexOf('aria-label="Tournament Player ID prep bridge"')).toBeGreaterThan(source.indexOf('tournamentNextActions.map((action)'))
    expect(source.indexOf('aria-label="Tournament Player ID prep bridge"')).toBeLessThan(source.indexOf('id="find"'))
  })

  it('keeps the tournament Player ID bridge compact on phones', () => {
    expect(styleBlock('tournamentPlayerIdPrepStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))'")
    expect(styleBlock('tournamentPlayerIdPrepStyle')).toContain('minWidth: 0')
    expect(styleBlock('tournamentPlayerIdPrepStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('tournamentPlayerIdPrepGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(styleBlock('tournamentPlayerIdPrepCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('tournamentPlayerIdActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('tournamentPlayerIdActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('tournamentPlayerIdActionStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('tournamentPlayerIdActionStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
