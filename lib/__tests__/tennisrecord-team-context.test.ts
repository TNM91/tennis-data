import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260821000300_add_tennisrecord_public_team_context.sql'),
  'utf8',
)
const teamDirectory = readFileSync(join(process.cwd(), 'lib/team-directory.ts'), 'utf8')
const leagueSummary = readFileSync(join(process.cwd(), 'lib/league-summary.ts'), 'utf8')
const teamDetail = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')
const exploreSearch = readFileSync(join(process.cwd(), 'app/explore/search/page.tsx'), 'utf8')

describe('TennisRecord public team context', () => {
  it('exposes only a limited, source-labeled context projection', () => {
    expect(migration).toContain('create or replace view public.tennisrecord_public_team_context')
    expect(migration).toContain('grant select on public.tennisrecord_public_team_context to anon, authenticated')
    expect(migration).toContain("'tennisrecord'::text as source")
    expect(migration).not.toContain('raw jsonb')
    expect(migration).not.toContain('published_rating')
  })

  it('adds source context to both team and league discovery without changing ratings', () => {
    expect(teamDirectory).toContain("from('tennisrecord_public_team_context')")
    expect(teamDirectory).toContain("source: 'tennisrecord'")
    expect(leagueSummary).toContain("from('tennisrecord_public_team_context')")
    expect(leagueSummary).toContain("source: 'tennisrecord'")
    expect(leagueSummary).not.toContain('recalculateRatings')
    expect(teamDetail).toContain("from('tennisrecord_public_team_context')")
    expect(exploreSearch).toContain("from('tennisrecord_public_team_context')")
    expect(exploreSearch).toContain('TennisRecord context')
  })
})
