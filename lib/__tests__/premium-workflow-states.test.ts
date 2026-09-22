import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('premium workflow states', () => {
  it('uses optimized, contextual tennis artwork for shared state surfaces', () => {
    const art = read('app/components/tennis-state-art.tsx')

    expect(art).toContain("from 'next/image'")
    expect(art).toContain("'/player-profile/journey-hero.png'")
    expect(art).toContain("'/player-profile/player-id-court.png'")
    expect(art).toContain("'/tiq/courts/tiq-court-master.png'")
    expect(art).toContain('loading="lazy"')
    expect(art).toContain('quality={75}')
    expect(art).toContain('sizes="(max-width: 720px) 78vw, 44vw"')
    expect(art).toContain('alt=""')
    expect(art).toContain('name={config.icon}')
    expect(art).toContain('size="hero"')
  })

  it('maps page-level visuals to the tennis work each hub represents', () => {
    const visual = read('app/components/contextual-tennis-visual.tsx')
    const commandCenter = read('app/components/public-command-center.tsx')
    const shell = read('app/components/site-shell.tsx')

    expect(visual).toContain("explore: { primary: 'opponentScouting', secondary: 'playerRatings' }")
    expect(visual).toContain("captain: { primary: 'lineupBuilder', secondary: 'captainTennis' }")
    expect(visual).toContain("coach: { primary: 'coachTennis', secondary: 'playerRatings' }")
    expect(visual).toContain("league: { primary: 'leagueTennis', secondary: 'schedule' }")
    expect(visual).toContain("tournament: { primary: 'competeTennis', secondary: 'schedule' }")
    expect(visual).toContain("club: { primary: 'clubTennis', secondary: 'coachTennis' }")
    expect(commandCenter).toContain('<ContextualTennisVisual visual={visual} />')
    expect(shell).toContain("if (visualArea === 'captain') return 'captain'")
    expect(shell).toContain("if (visualArea === 'club') return 'club'")
  })

  it('assigns contextual hero visuals to the public role and organizer pages', () => {
    expect(read('app/coaches/page.tsx')).toContain('visual="coach"')
    expect(read('app/leagues-and-tournaments/page.tsx')).toContain('visual="league"')
    expect(read('app/tournaments/page.tsx')).toContain('visual="tournament"')
    expect(read('app/manage/page.tsx')).toContain('visual="manage"')
    expect(read('app/resources/page.tsx')).toContain('visual="resources"')
    expect(read('app/explore/page.tsx')).toContain('<ContextualTennisVisual visual="explore" />')
    expect(read('app/components/club-workspace.tsx')).toContain('<ContextualTennisVisual visual="club" />')
  })

  it('gives public detail states a shared visual, tone, and primary action hierarchy', () => {
    const state = read('app/components/public-detail-state.tsx')

    expect(state).toContain('<TennisStateArt')
    expect(state).toContain('getTennisStateIcon(visual)')
    expect(state).toContain('data-state-tone={tone}')
    expect(state).toContain("tone?: 'neutral' | 'loading' | 'empty' | 'error' | 'locked'")
    expect(state).toContain("role={busy ? 'status' : undefined}")
    expect(state).toContain('index === 0 ? primaryActionStyle')
  })

  it('themes route loading shells without losing polite busy semantics', () => {
    const shell = read('app/components/route-loading-shell.tsx')

    expect(shell).toContain('visual?: TennisStateVisual')
    expect(shell).toContain('<TennisStateArt compact visual={resolvedVisual} />')
    expect(shell).toContain('data-loading-visual={resolvedVisual}')
    expect(shell).toContain('aria-busy="true"')
    expect(shell).toContain('aria-live="polite"')
    expect(shell).toContain('Reviewing the tennis records behind this directory')
  })

  it('matches locked previews to the role and tennis work they unlock', () => {
    const locked = read('app/components/locked-plan-page.tsx')

    expect(locked).toContain('<TennisStateArt compact visual={preview.visual} />')
    expect(locked).toContain("visual: 'captain'")
    expect(locked).toContain("visual: 'coach'")
    expect(locked).toContain("visual: 'league'")
    expect(locked).toContain("visual: 'player'")
    expect(locked).toContain("heroIcon: 'captainDashboard'")
  })

  it('keeps technical player lookup errors out of the public profile state', () => {
    const player = read('app/players/[id]/page.tsx')

    expect(player).toContain('getPublicPlayerErrorMessage(error)')
    expect(player).toContain('/uuid|syntax|invalid input/i.test(error)')
    expect(player).toContain('That player link is not valid.')
    expect(player).not.toContain("<p style={sectionText}>{error || 'Player not found.'}</p>")
  })

  it('assigns the right visual language to high-value route loading states', () => {
    expect(read('app/players/loading.tsx')).toContain('visual="player"')
    expect(read('app/teams/[team]/loading.tsx')).toContain('visual="team"')
    expect(read('app/matchup/loading.tsx')).toContain('visual="matchup"')
    expect(read('app/captain/loading.tsx')).toContain('visual="captain"')
    expect(read('app/league-coordinator/loading.tsx')).toContain('visual="league"')
  })
})
