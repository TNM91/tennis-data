import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260806000100_fix_internal_messaging_rls_recursion.sql'),
  'utf8',
)

const securityDefinerHelpers = [
  'is_internal_conversation_participant',
  'is_internal_conversation_creator',
  'is_internal_schedule_event_participant',
  'is_internal_schedule_event_creator',
] as const

describe('internal messaging RLS recursion repair', () => {
  it('uses locked-down security-definer helpers at protected-table boundaries', () => {
    for (const helper of securityDefinerHelpers) {
      expect(migrationSource).toContain(`function public.${helper}`)
      expect(migrationSource).toContain(`revoke all on function public.${helper}(uuid) from public`)
      expect(migrationSource).toContain(`grant execute on function public.${helper}(uuid) to authenticated, service_role`)
    }

    expect(migrationSource.match(/security definer/g)).toHaveLength(securityDefinerHelpers.length)
    expect(migrationSource.match(/set search_path = ''/g)).toHaveLength(securityDefinerHelpers.length)
  })

  it('replaces the recursive conversation and participant policies', () => {
    expect(migrationSource).toContain('public.is_internal_conversation_participant(id)')
    expect(migrationSource).toContain('public.is_internal_conversation_creator(conversation_id)')
    expect(migrationSource).toContain('public.is_internal_conversation_participant(conversation_id)')
    expect(migrationSource).toContain('public.is_admin()')
  })

  it('routes schedule, notification, and preference checks through non-recursive helpers', () => {
    expect(migrationSource).toContain('public.is_internal_schedule_event_participant(event_id)')
    expect(migrationSource).toContain('public.is_internal_schedule_event_creator(event_id)')
    expect(migrationSource).toContain('on public.internal_notifications for select to authenticated')
    expect(migrationSource).toContain('on public.internal_notification_preferences for select to authenticated')
  })
})
