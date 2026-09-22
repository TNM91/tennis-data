import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Captain opponent form scan', () => {
  const page = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

  it('uses canonical match results for an opponent record, recent form, and head-to-head', () => {
    expect(page).toContain("const [opponentMatches, setOpponentMatches] = useState<TeamMatch[]>([])")
    expect(page).toContain("const opponentForm = useMemo<CaptainOpponentForm | null>(() =>")
    expect(page).toContain("record: seasonMatches.length ? `${wins}-${losses}` : 'No season result yet'")
    expect(page).toContain("headToHead: headToHead.length ? `${teamWins}-${headToHead.length - teamWins} vs ${opponent}` : 'No recorded meeting yet'")
    expect(page).toContain('aria-label="Opponent form"')
    expect(page).toContain('aria-label="Opponent last five results"')
    expect(page).toContain('Completed match history will appear here as it becomes available for this league and flight.')
  })
})
