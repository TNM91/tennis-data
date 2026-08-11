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
