import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveCaptainMatchContext } from '../captain-memory'

const builderSource = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')
const availabilitySource = readFileSync(join(process.cwd(), 'app/captain/availability/page.tsx'), 'utf8')
const railSource = readFileSync(join(process.cwd(), 'app/components/captain-match-week-rail.tsx'), 'utf8')
const globalStyles = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

function dateOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

describe('captain mobile safety and next-match defaults', () => {
  it('drops stale shared match links so Match Week starts at the next scheduled match', () => {
    expect(resolveCaptainMatchContext(new URLSearchParams({
      date: dateOffset(-2),
      opponent: 'Old opponent',
      match: 'old-match',
    }))).toEqual({ eventDate: '', opponentTeam: '', matchId: '' })

    expect(resolveCaptainMatchContext(new URLSearchParams({
      date: dateOffset(2),
      opponent: 'Next opponent',
      match: 'next-match',
    }))).toEqual({ eventDate: dateOffset(2), opponentTeam: 'Next opponent', matchId: 'next-match' })
  })

  it('builds captain rosters from the selected team match participants, not only a membership snapshot', () => {
    expect(builderSource).toContain("const [scopedRosterPlayerIds, setScopedRosterPlayerIds] = useState<string[]>([])")
    expect(builderSource).toContain(".or(`home_team.eq.\"${escapedTeam}\",away_team.eq.\"${escapedTeam}\"")
    expect(builderSource).toContain(".select('match_id, player_id, side')")
    expect(builderSource).toContain('for (const playerId of scopedRosterPlayerIds) ids.add(playerId)')
  })

  it('keeps availability on the next match and gives each response action enough room on phones', () => {
    expect(availabilitySource).toContain('function isPastAvailabilityDate(value: string)')
    expect(availabilitySource).toContain("eventDate: explicitDate")
    expect(availabilitySource).toContain('statusButtonRowResponsive(isMobile)')
    expect(availabilitySource).toContain("gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))'")
    expect(availabilitySource).toContain('No reply')
  })

  it('applies the shared mobile text reflow contract and stacked Match Week steps', () => {
    expect(globalStyles).toContain('Mobile text safety contract')
    expect(globalStyles).toContain('#main-content *')
    expect(globalStyles).toContain("#main-content :is(button, a, label, [role='button'])")
    expect(railSource).toContain("flexDirection: 'column'")
  })
})
