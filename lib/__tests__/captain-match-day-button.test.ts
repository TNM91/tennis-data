import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
const styles = readFileSync(join(process.cwd(), 'app/captain/captain-mobile-command.module.css'), 'utf8')

describe('Captain Match Day button', () => {
  it('appears only for the local match date and opens the live tools', () => {
    expect(page).toContain("captainMobileActionLayout.phase === 'match_day'")
    expect(page).toContain('<strong>Match Day</strong>')
    expect(page).toContain('aria-label="Match Day tools"')
    expect(page).toContain('href={captainLiveScorecardHref}')
    expect(page).toContain('including defaults or retirements')
    expect(page).toContain('View final lineup')
    expect(page).toContain('Capture scorecard')
    expect(page).toContain('Opponent read')
    expect(page).toContain('Directions')
  })

  it('keeps an explicitly selected match instead of jumping to the next fixture', () => {
    expect(page).toContain("const requestedMatchDate = safeText(searchParams.get('date'), '').slice(0, 10)")
    expect(page).toContain("q = requestedMatchDate ? q.eq('match_date', requestedMatchDate) : q.gte('match_date', today)")
    expect(page).toContain('if (!m && requestedMatchDate && requestedMatchOpponent)')
    expect(page).toContain('opponent: requestedMatchOpponent')
    expect(page).toContain('const eventDate = matchWeekDate || currentMatch?.match_date || null')
    expect(page).toContain('matchWeekOpponent ||')
  })

  it('uses a prominent phone-first control and collapses tools on narrow phones', () => {
    expect(styles).toContain('.matchDayButton')
    expect(styles).toContain('min-height: 64px')
    expect(styles).toContain('.matchDayPrimaryAction')
    expect(styles).toContain('.matchDayActionGrid')
    expect(styles).toContain('.matchDayActionGrid {\n    grid-template-columns: minmax(0, 1fr);')
  })
})
