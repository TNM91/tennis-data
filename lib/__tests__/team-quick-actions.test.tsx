import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import TeamQuickActions from '@/app/teams/[team]/team-quick-actions'

describe('compact team actions', () => {
  it('keeps free team members focused on calendar and scoped chat', () => {
    const html = renderToStaticMarkup(<TeamQuickActions chatHref="/team-room?team=Aces&league=Fall" />)
    expect(html).toContain('Schedule &amp; calendar')
    expect(html).toContain('href="#team-schedule"')
    expect(html).toContain('/team-room?team=Aces&amp;league=Fall')
    expect(html).not.toContain('Build lineup')
    expect(html).not.toContain('Availability')
  })
  it('preserves captain scope and opens season availability directly', () => {
    const html = renderToStaticMarkup(<TeamQuickActions chatHref="/team-room?team=Aces" lineupHref="/captain/lineup-builder?team=Aces&league=Fall&flight=4.0" availabilityHref="#team-availability" />)
    expect(html).toContain('/captain/lineup-builder?team=Aces&amp;league=Fall&amp;flight=4.0')
    expect(html).toContain('href="#team-availability"')
    expect(html).toContain('aria-label="Your team actions"')
    expect(html.match(/<a /g)).toHaveLength(4)
  })
  it('uses flexible phone columns and touch-sized actions', () => {
    const source = readFileSync('app/teams/[team]/team-quick-actions.tsx', 'utf8')
    expect(source).toContain("action.href.startsWith('#') ? 'a' : Link")
    const css = readFileSync('app/teams/[team]/team-profile.module.css', 'utf8')
    expect(css).toContain('repeat(2, minmax(0, 1fr))')
    expect(css).toContain('min-height: 54px')
    expect(css).toContain(':focus-visible')
    expect(css).not.toContain('word-break: break-all')
  })
  it('keeps supplementary tools closed without removing access', () => {
    const source = readFileSync('app/teams/[team]/page.tsx', 'utf8')
    expect(source).toContain('<details className={profileStyles.drawer}>')
    expect(source).toContain('Follow & player tools')
    expect(source).toContain('<details style={{ ...detailDrawerStyle, order: 5 }} aria-label="Captain team week tools">')
    expect(source).toContain('Readiness, pairings & team plan')
    expect(source).toContain('data-team-week-job={item.job}')
  })
})
