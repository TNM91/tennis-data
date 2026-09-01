import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')
const route = readFileSync(join(process.cwd(), 'app/api/captain/lineup-builder/route.ts'), 'utf8')

describe('captain lineup draft recovery', () => {
  it('autosaves a captain-scoped device draft and restores it before cloud resume state', () => {
    expect(page).toContain('getCaptainLineupDraftStorageKey(userId)')
    expect(page).toContain('localBuilderDraftRestoredRef')
    expect(page).toContain('localBuilderDraftWriteReadyRef')
    expect(page).toContain("setMessage('Draft restored on this device.')")
    expect(page).toContain('localStorage.setItem(getCaptainLineupDraftStorageKey(userId)')
    expect(page).toContain('if (localBuilderDraftRestoredRef.current)')
    expect(page).toContain('if (initialContext.hasExplicitRouteScope)')
    expect(page).toContain('Never let a recoverable draft')
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
