import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('league lifecycle UI and ownership', () => {
  it('puts edit, renewal, ownership, and guarded deletion in League Office', () => {
    const workspace = read('app/components/league-coordinator-workspace.tsx')
    const lifecycle = read('app/components/league-lifecycle-panel.tsx')

    expect(workspace).toContain('Edit setup')
    expect(workspace).toContain('Renew season')
    expect(workspace).toContain('Create renewed season')
    expect(workspace).toContain("title: 'Manage leagues'")
    expect(workspace).toContain('Manage saved leagues')
    expect(workspace).toContain('id="league-registry" style={responsiveRegistryPanel} open>')
    expect(workspace).toContain('mobileScrollablePanelStyle, order: -1')
    expect(workspace).toContain("if (action.href === '#league-registry') setSetupOpen(false)")
    expect(workspace).toContain("if (action.href === '#league-setup-form') setSetupOpen(true)")
    expect(workspace).toContain("setupOpen || isFirstLeagueSetup ? 'Close form' : 'Open form'")
    expect(workspace).toContain("coordinatorResumeState?.lastSurface !== 'setup' || !hasSavedLeague")
    expect(workspace).toContain('<LeagueLifecyclePanel')
    expect(lifecycle).toContain('Change league owner')
    expect(lifecycle).toContain('Manage owner or delete league')
    expect(lifecycle).toContain('Transfer ownership or permanently remove this league.')
    expect(lifecycle).toContain('Owner tools')
    expect(lifecycle).toContain('Type <strong>{league.leagueName}</strong> to confirm')
    expect(lifecycle).toContain('Permanently delete league')
    expect(lifecycle).toContain('They must accept before ownership can move.')
  })

  it('verifies a cloud delete and transfers ownership atomically', () => {
    const service = read('lib/tiq-league-service.ts')
    const migration = read('supabase/migrations/20260930000400_add_tiq_league_ownership_transfer.sql')

    expect(service).toContain(".delete().eq('id', id).select('id').maybeSingle()")
    expect(service.indexOf("if (!data?.id)")).toBeLessThan(service.indexOf('deleteTiqLeagueRecord(id)', service.indexOf("if (!data?.id)")))
    expect(service).toContain("supabase.rpc('transfer_tiq_league_ownership'")
    expect(migration).toContain('for update;')
    expect(migration).toContain('The new owner must accept a delegate invitation')
    expect(migration).toContain("insert into public.tiq_league_delegates")
    expect(migration).toContain('update public.tiq_leagues')
  })
})
