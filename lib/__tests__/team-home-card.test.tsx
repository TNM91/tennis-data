import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import TeamHomeCard, { type TeamHomeCardProps } from '@/app/compete/teams/team-home-card'

const base: TeamHomeCardProps = { name: 'Aces / Fall Team', league: 'Fall league', flight: '4.0', isDefault: true, teamHref: '/teams/Aces?league=Fall&flight=4.0', chatHref: '/team-room?team=Aces&league=Fall&flight=4.0' }
describe('team home cards', () => {
  it('keeps team scope on roster, chat and calendar links', () => {
    const html = renderToStaticMarkup(<TeamHomeCard {...base} />)
    expect(html).toContain('/teams/Aces?league=Fall&amp;flight=4.0#team-schedule')
    expect(html).toContain('/team-room?team=Aces&amp;league=Fall&amp;flight=4.0')
    expect(html).toContain('Default team')
    expect(html).not.toContain('Build lineup')
    expect(html).not.toContain('Season availability')
  })
  it('shows the actual next opponent and an accessible date, without inventing times', () => {
    const html = renderToStaticMarkup(<TeamHomeCard {...base} nextMatch={{ date: '2026-09-14', opponent: 'Volleys' }} />)
    expect(html).toContain('dateTime="2026-09-14"')
    expect(html).toContain('vs Volleys')
    expect(html).toContain('Monday')
    expect(html).not.toContain('6:00')
  })
  it('exposes captain tools only when supplied and preserves the exact handoff', () => {
    const html = renderToStaticMarkup(<TeamHomeCard {...base} availabilityHref={`${base.teamHref}#team-availability`} lineupHref="/captain/lineup-builder?team=Aces&layer=usta" />)
    expect(html).toContain('Season availability')
    expect(html).toContain('#team-availability')
    expect(html).toContain('/captain/lineup-builder?team=Aces&amp;layer=usta')
  })
  it('separates loading from an empty upcoming schedule', () => {
    expect(renderToStaticMarkup(<TeamHomeCard {...base} syncing />)).toContain('Schedule syncing')
    const loaded = renderToStaticMarkup(<TeamHomeCard {...base} historyCount={7} />)
    expect(loaded).toContain('No upcoming match listed')
    expect(loaded).toContain('7 matches in history')
  })
  it('keeps controls touch-sized and phone columns flexible', () => {
    const css = readFileSync('app/compete/teams/teams-home.module.css', 'utf8')
    expect(css).toContain('min-height: 46px')
    expect(css).toContain('repeat(2, minmax(0, 1fr))')
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)')
    const calendar = readFileSync('app/components/team-season-calendar.tsx', 'utf8')
    expect(calendar).toContain("window.location.hash === '#team-availability' && canStartSeason && accessToken")
    expect(calendar).toContain('if (kickoffDirty) return')
  })
})
