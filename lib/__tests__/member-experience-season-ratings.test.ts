import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const searchSource = readFileSync(join(process.cwd(), 'app/explore/search/page.tsx'), 'utf8')
const teamDirectorySource = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')
const teamProfileSource = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')
const playerProfileSource = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')
const questSource = readFileSync(join(process.cwd(), 'app/level-up/my-quest/my-quest-client.tsx'), 'utf8')

describe('member experience season and rating access', () => {
  it('batches Explore search requests instead of searching per keystroke', () => {
    expect(searchSource).toContain('window.setTimeout(() =>')
    expect(searchSource).toContain('}, 260)')
    expect(searchSource).toContain('window.clearTimeout(timeout)')
  })

  it('offers a true season view in team discovery and team performance', () => {
    expect(teamDirectorySource).toContain("const [seasonFilter, setSeasonFilter] = useState('')")
    expect(teamDirectorySource).toContain('All seasons (Dynasty)')
    expect(teamDirectorySource).toContain('Keep the default directory as the dynasty view')
    expect(teamDirectorySource).toContain("params.set('season', seasonFilter)")
    expect(teamProfileSource).toContain('const seasonMatches = useMemo(')
    expect(teamProfileSource).toContain('seasonFilter === \'all\' ? matches')
  })

  it('keeps exact TiQ ratings private to the owner and Player members', () => {
    expect(playerProfileSource).toContain('const canViewExactTiqRating = isOwnProfile || access.canUseAdvancedPlayerInsights')
    expect(playerProfileSource).toContain('`${Math.floor(numeric)}.XX`')
    expect(playerProfileSource).toContain('Unlock exact TIQ ratings with Player')
    expect(playerProfileSource).toContain("'TiQ after'")
    expect(playerProfileSource).toContain('recentResultTiq')
  })

  it('keeps My Quest tennis-specific', () => {
    expect(questSource).toContain("season_slug: 'tennis-season'")
    expect(questSource).toContain('Build your tennis season')
    expect(questSource).not.toMatch(/operation-visible-abs|road to six pack/i)
  })
})
