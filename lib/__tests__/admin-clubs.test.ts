import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canDeleteClubWithConfirmation, countClubRows, normalizeClubDeleteConfirmation } from '../admin-clubs'

describe('Admin club management', () => {
  it('requires the full club name before deletion', () => {
    expect(normalizeClubDeleteConfirmation('  Vetta   Sports ')).toBe('vetta sports')
    expect(canDeleteClubWithConfirmation('Vetta Sports', 'vetta sports')).toBe(true)
    expect(canDeleteClubWithConfirmation('Vetta Sports', 'Vetta')).toBe(false)
    expect(canDeleteClubWithConfirmation('', '')).toBe(false)
  })

  it('counts club-linked rows without counting missing ids', () => {
    expect(countClubRows([{ club_id: 'a' }, { club_id: 'a' }, { club_id: 'b' }, { club_id: null }])).toEqual(new Map([['a', 2], ['b', 1]]))
  })

  it('keeps deletion admin-only, confirmed, audited, and visible from Admin', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/admin/clubs/route.ts'), 'utf8')
    const page = readFileSync(join(process.cwd(), 'app/admin/clubs/page.tsx'), 'utf8')
    const dashboard = readFileSync(join(process.cwd(), 'app/admin/page.tsx'), 'utf8')
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260809000200_create_admin_audit_events.sql'), 'utf8')

    expect(route).toContain('getAdminApiAuth')
    expect(route).toContain('canDeleteClubWithConfirmation')
    expect(route).toContain("action: 'club_deleted'")
    expect(page).toContain('Permanently delete club')
    expect(page).toContain('Linked TIQ leagues and tournaments remain')
    expect(dashboard).toContain("href: '/admin/clubs'")
    expect(migration).toContain('admin_audit_events')
  })
})
