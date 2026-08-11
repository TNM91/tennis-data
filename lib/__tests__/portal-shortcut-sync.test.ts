import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const apiSource = readFileSync(join(process.cwd(), 'app/api/portal/shortcuts/route.ts'), 'utf8')
const clientSource = readFileSync(join(process.cwd(), 'lib/portal-shortcut-cloud.ts'), 'utf8')
const toolbarSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')
const migrationSource = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260811000100_add_portal_shortcut_preferences.sql'),
  'utf8',
)

describe('portal shortcut cloud sync', () => {
  it('authenticates every cloud read and write before using service access', () => {
    expect(apiSource).toContain('const auth = await getShortcutAuth(request)')
    expect(apiSource).toContain('authClient.auth.getUser(token)')
    expect(apiSource).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY")
    expect(apiSource).toContain("message: 'Sign in to sync shortcuts.'")
    expect(apiSource).toContain('{ status: 401 }')
  })

  it('keeps local navigation available when cloud sync is unavailable', () => {
    expect(clientSource).toContain('return emptyCloudState(false)')
    expect(toolbarSource).toContain('!cloud.cloudAvailable')
    expect(toolbarSource).toContain('const localShortcutIds = readPinnedPortalShortcuts(userId)')
    expect(toolbarSource).toContain('cachePinnedPortalShortcuts(cloud.shortcuts, userId)')
    expect(toolbarSource).toContain('portalShortcutInteractionVersionRef.current !== restoreVersion')
  })

  it('migrates a first signed-in device and syncs later edits or cue dismissal', () => {
    expect(toolbarSource).toContain('if (!cloud.shortcuts)')
    expect(toolbarSource).toContain('shortcuts: localShortcutIds')
    expect(toolbarSource).toContain('syncPortalShortcutsToCloud(savedShortcutIds, true)')
    expect(toolbarSource).toContain('syncPortalShortcutsToCloud(pinnedPortalShortcutIds, true)')
  })

  it('stores exactly four allowed shortcuts in a user-owned row', () => {
    expect(migrationSource).toContain('user_id uuid primary key references auth.users(id) on delete cascade')
    expect(migrationSource).toContain('cardinality(shortcut_ids) = 4')
    expect(migrationSource).toContain('portal_shortcut_preferences_allowed_shortcuts')
    expect(migrationSource).toContain('alter table public.portal_shortcut_preferences enable row level security')
    expect(migrationSource).toContain('using (auth.uid() = user_id)')
    expect(migrationSource).toContain('with check (auth.uid() = user_id)')
  })
})
