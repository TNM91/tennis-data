import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')
const route = readFileSync(join(process.cwd(), 'app/api/captain/lineup-builder/route.ts'), 'utf8')

describe('captain lineup roster-first availability', () => {
  it('keeps no-response and marked-out roster players selectable by default', () => {
    expect(source).toContain("const [availabilityOnly, setAvailabilityOnly] = useState(initialContext.availabilityOnly)")
    expect(source).toContain('availabilityOnly: false')
    expect(source).toContain('const [hideUnavailable, setHideUnavailable] = useState(false)')
    expect(source).toContain('Show only players who replied')
    expect(source).toContain('Hide players marked out')
  })

  it('labels each player’s response state in the roster and court selector', () => {
    expect(source).toContain("return 'No response'")
    expect(source).toContain('Team roster')
    expect(source).toContain('No-response players remain selectable')
    expect(source).toContain('availabilityLabel(poolPlayer.availabilityStatus)')
  })

  it('keeps the complete team roster together for match planning', () => {
    expect(route).toContain(".eq('normalized_team_name', normalizedTeam)")
    expect(route).toContain(".in('id', rosterPlayerIds)")
    expect(source).toContain('/api/captain/lineup-builder?${params.toString()}')
    expect(source).toContain('const [teamRosterPlayers, setTeamRosterPlayers] = useState<PlayerRow[]>([])')
    expect(source).toContain('const rosterBackedPlayers = useMemo(() =>')
    expect(source).toContain('for (const player of teamRosterPlayers) playersById.set(player.id, player)')
    expect(source).toContain('const rosterBackedPlayers = useMemo(() =>')
    expect(route).not.toContain("rosterQuery = rosterQuery.eq('flight'")
    expect(route).not.toContain("matchQuery = matchQuery.eq('flight'")
  })
})
