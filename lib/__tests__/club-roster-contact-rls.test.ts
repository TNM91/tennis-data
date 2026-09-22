import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260809001100_fix_club_roster_contact_rls_recursion.sql',
  ),
  'utf8',
)

describe('club roster contact RLS recursion repair', () => {
  it('moves protected-table lookups behind locked-down security-definer helpers', () => {
    for (const helper of ['can_read_shared_roster_contact', 'owns_roster_contact']) {
      expect(migrationSource).toContain(`function public.${helper}`)
      expect(migrationSource).toContain(`revoke all on function public.${helper}(uuid) from public`)
      expect(migrationSource).toContain(
        `grant execute on function public.${helper}(uuid) to authenticated, service_role`,
      )
    }

    expect(migrationSource.match(/security definer/g)).toHaveLength(2)
    expect(migrationSource.match(/set search_path = ''/g)).toHaveLength(2)
  })

  it('replaces both recursive policies with helper calls', () => {
    expect(migrationSource).toContain('using (public.can_read_shared_roster_contact(id))')
    expect(migrationSource).toContain('and public.owns_roster_contact(contact_id)')
  })
})
