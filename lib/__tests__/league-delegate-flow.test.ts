import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('weekly league delegate flow', () => {
  it('keeps delegate granting owner-only while allowing delegates to run leagues', () => {
    const migration = source('supabase/migrations/20260930000100_add_tiq_league_delegate_invites.sql')
    expect(migration).toContain('public.owns_tiq_league(league_id)')
    expect(migration).toContain('"League managers read delegates"')
    expect(migration).toContain('"League owners add delegates"')
    expect(migration).toContain('"League delegates can read managed leagues"')
    expect(migration).not.toContain('on public.tiq_league_delegates for all to authenticated')
  })

  it('locks acceptance to the invited email and activates delegate access', () => {
    const route = source('app/api/league-delegates/[token]/route.ts')
    expect(route).toContain('canAcceptLeagueDelegateInvite')
    expect(route).toContain("from('tiq_league_delegates').upsert")
    expect(route).toContain("status: 'accepted'")
  })

  it('surfaces identity, chat, and delegate controls in weekly operations', () => {
    const workspace = source('app/league-coordinator/weekly/weekly-league-workspace.tsx')
    const settings = source('app/league-coordinator/weekly/league-operations-settings.tsx')
    expect(workspace).toContain('LeagueOperationsSettings')
    expect(settings).toContain('Save league settings')
    expect(settings).toContain('League chat')
    expect(settings).toContain('Delegate invitation link copied.')
  })
})
