import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')
const route = readFileSync(join(process.cwd(), 'app/api/captain/lineup-builder/route.ts'), 'utf8')
const draftRoute = readFileSync(join(process.cwd(), 'app/api/captain/lineup-drafts/route.ts'), 'utf8')
const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260908000200_create_captain_lineup_drafts.sql'), 'utf8')
const lifecycleMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260908000300_add_captain_lineup_draft_status.sql'), 'utf8')

describe('captain lineup draft recovery', () => {
  it('autosaves a captain-scoped draft locally and in TiQ before cloud scenario restore', () => {
    expect(page).toContain('getCaptainLineupDraftStorageKey(userId)')
    expect(page).toContain('getCaptainLineupDraftStorageKey(userId, initialDraftScope)')
    expect(page).toContain('getCaptainLineupDraftStorageKey(userId, currentBuilderDraft)')
    expect(page).toContain('localBuilderDraftRestoredRef')
    expect(page).toContain('localBuilderDraftWriteReadyRef')
    expect(page).toContain("setMessage('In-progress lineup restored.')")
    expect(page).toContain("setMessage('In-progress lineup restored from TiQ.')")
    expect(page).toContain('localStorage.setItem(getCaptainLineupDraftStorageKey(userId)')
    expect(page).toContain('if (localBuilderDraftRestoredRef.current)')
    expect(page).toContain('captainLineupDraftMatchesScope')
    expect(page).toContain('/api/captain/lineup-drafts')
    expect(page).toContain('!cloudDraftResolved')
    expect(page).toContain('Draft autosaved to TiQ')
    expect(page).toContain('getCaptainRouteResumeFallback(params,')
  })

  it('stores private drafts per captain and exact team-match scope', () => {
    expect(draftRoute).toContain(".from('captain_lineup_drafts')")
    expect(draftRoute).toContain(".eq('user_id', authorized.auth.userId)")
    expect(draftRoute).toContain(".eq('scope_key', scopeKey)")
    expect(draftRoute).toContain("{ onConflict: 'user_id,scope_key' }")
    expect(draftRoute).toContain(".eq('normalized_team_name', normalizeTeamRoomKey(teamName))")
    expect(migration).toContain('constraint captain_lineup_drafts_owner_scope_unique unique (user_id, scope_key)')
    expect(migration).toContain('alter table public.captain_lineup_drafts enable row level security')
    expect(migration).toContain('user_id = (select auth.uid())')
    expect(lifecycleMigration).toContain("status in ('working', 'final')")
  })

  it('provides a private minimal Teams summary and finalizes only a confirmed lineup', () => {
    expect(draftRoute).toContain("searchParams.get('view') === 'summary'")
    expect(draftRoute).toContain(".select('competition_layer,team_name,league_name,flight,match_date,opponent_team,slots_json,status,updated_at')")
    expect(draftRoute).toContain('summarizeCaptainLineupDraft(row)')
    expect(draftRoute).toContain(".update({ status: 'final'")
    expect(page).toContain("method: 'PATCH'")
    expect(page).toContain('if (!finalLineupReady)')
  })

  it('keeps saved selections visible if the live roster refresh is delayed', () => {
    expect(page).toContain("player.playerName || 'Saved player'")
    expect(page).toContain('saved draft</option>')
  })

  it('uses indexed roster-contact scope and prevents optional data from blocking the builder', () => {
    expect(route).toContain(".eq('captain_user_id', auth.userId)")
    expect(route).toContain(".eq('normalized_team_name', normalizedTeam)")
    expect(route).toContain("resolveOptionalQuery('team schedule', matchesPromise")
    expect(route).toContain("resolveOptionalQuery('team availability', availabilityPromise")
    expect(route).toContain('captainMessageContacts: [],')
    expect(route).not.toContain('captain_message_contacts')
    expect(route).toContain("resolveOptionalQuery('saved scenarios', scenariosPromise")
    expect(route).toContain('const primaryError = rosterResult.error')
  })
})
