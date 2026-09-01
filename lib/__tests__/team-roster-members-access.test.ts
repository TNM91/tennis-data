import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260801000100_allow_roster_reads.sql'),
  'utf8',
)
const captainSource = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
const lineupBuilderSource = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')
const lineupBuilderRoute = readFileSync(join(process.cwd(), 'app/api/captain/lineup-builder/route.ts'), 'utf8')

describe('team roster browser access', () => {
  it('lets public and signed-in Captain clients read imported roster memberships', () => {
    expect(migration).toContain('alter table public.team_roster_members enable row level security')
    expect(migration).toContain('create policy "Public can read team roster members"')
    expect(migration).toContain('for select')
    expect(migration).toContain('using (true)')
  })

  it('keeps roster writes limited to admins while service imports bypass RLS', () => {
    expect(migration).toContain('create policy "Admins can manage team roster members"')
    expect(migration).toContain("profiles.role = 'admin'")
    expect(migration).toContain('with check')
  })

  it('supports both Captain setup discovery and Build Lineup roster loading', () => {
    expect(captainSource).toContain(".from('team_roster_members')")
    expect(captainSource).toContain("source: 'roster'")
    expect(lineupBuilderRoute).toContain(".from('team_roster_members')")
    expect(lineupBuilderSource).toContain('/api/captain/lineup-builder?${params.toString()}')
    expect(lineupBuilderSource).toContain('buildRosterPlayerIdSet')
  })

  it('keeps platform Admin access and imported contact lookups aligned with Captain Builder data', () => {
    const captainAuthSource = readFileSync(join(process.cwd(), 'lib/captain-api-auth.ts'), 'utf8')
    expect(captainAuthSource).toContain('isAdmin: boolean')
    expect(captainAuthSource).toContain('isAdmin: row.role === \'admin\'')
    expect(lineupBuilderRoute).toContain('auth.isAdmin || hasCaptainTeamLink')
    expect(lineupBuilderRoute).toContain('normalizeCaptainRosterContactKey(teamName)')
    expect(lineupBuilderRoute).toContain("authorization: auth.isAdmin ? 'platform-admin' : 'captain-team-link'")
  })
})
