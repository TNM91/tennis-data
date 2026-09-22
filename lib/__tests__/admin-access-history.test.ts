import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(join(process.cwd(), 'app/admin/access/page.tsx'), 'utf8')
const migrationSource = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260904000100_create_profile_access_change_history.sql'),
  'utf8',
)

describe('admin access history and expiry controls', () => {
  it('saves access changes and their audit entry through one database function', () => {
    expect(migrationSource).toContain('create table if not exists public.profile_access_change_events')
    expect(migrationSource).toContain('create or replace function public.apply_profile_access_change')
    expect(migrationSource).toContain('security definer')
    expect(migrationSource).toContain('for update')
    expect(migrationSource).toContain('insert into public.profile_access_change_events')
    expect(migrationSource).toContain('grant execute on function public.apply_profile_access_change')
    expect(pageSource).toContain("supabase.rpc('apply_profile_access_change'")
  })

  it('makes expiry follow-up and the reason for every change visible to an admin', () => {
    expect(pageSource).toContain('Access Ending · 14 Days')
    expect(pageSource).toContain('Extend 30 days')
    expect(pageSource).toContain('Revoke manual access')
    expect(pageSource).toContain('Change note')
    expect(pageSource).toContain('Access history')
    expect(pageSource).toContain('Permanent access history')
    expect(pageSource).toContain('Add a brief reason before saving an access change.')
  })
})
