import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(join(process.cwd(), 'app/api/captain/lineup-builder/route.ts'), 'utf8')
const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260827000100_optimize_captain_team_loads.sql'), 'utf8')

describe('captain team load performance', () => {
  it('keeps the roster as the only required builder read', () => {
    expect(route).toContain('const primaryError = rosterResult.error')
    expect(route).toContain("resolveOptionalQuery('team schedule', matchesPromise")
    expect(route).toContain("resolveOptionalQuery('team availability', availabilityPromise")
    expect(route).toContain("resolveOptionalQuery('scheduled match players', matchPlayersResultPromise")
  })

  it('logs a query fallback rather than allowing an optional read to reach Vercel timeout', () => {
    expect(route).toContain("query timed out; using fallback")
    expect(route).toContain("resolveOptionalQuery('team schedule', matchesPromise, emptyMatchesResult, 3_500)")
  })

  it('indexes the exact team lookups used by captain access and scheduling', () => {
    expect(migration).toContain('team_profile_links_profile_team_status_idx')
    expect(migration).toContain('matches_home_team_schedule_lookup_idx')
    expect(migration).toContain('matches_away_team_schedule_lookup_idx')
    expect(migration).toContain('lineup_availability_team_date_lookup_idx')
  })
})
