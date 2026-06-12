import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260612000100_create_personal_quest.sql'),
  'utf8',
)
const weeklyRuleMigrationSource = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260612000200_add_personal_quest_weekly_rule.sql'),
  'utf8',
)
const streakFreezeMigrationSource = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260612000300_create_personal_streak_freezes.sql'),
  'utf8',
)

const personalTables = [
  'personal_quest_profiles',
  'personal_daily_logs',
  'personal_daily_quest_completions',
  'personal_measurements',
  'personal_progress_photos',
  'personal_achievements',
  'personal_weekly_reviews',
  'personal_streak_freezes',
] as const

describe('personal quest schema privacy contract', () => {
  it('creates every private table with user ownership and RLS enabled', () => {
    for (const table of personalTables) {
      const source = table === 'personal_streak_freezes' ? streakFreezeMigrationSource : migrationSource
      expect(source).toContain(`create table if not exists public.${table}`)
      expect(source).toContain('user_id uuid')
      expect(source).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('uses auth.uid ownership policies for every table operation', () => {
    for (const table of personalTables) {
      const source = table === 'personal_streak_freezes' ? streakFreezeMigrationSource : migrationSource
      expect(source).toContain(`on public.${table} for select`)
      expect(source).toContain(`on public.${table} for insert`)
      expect(source).toContain(`on public.${table} for update`)
      expect(source).toContain(`on public.${table} for delete`)
    }

    expect(`${migrationSource}\n${streakFreezeMigrationSource}`.match(/auth\.uid\(\) = user_id/g)?.length ?? 0).toBeGreaterThanOrEqual(32)
  })

  it('keeps progress photos in a private owner-scoped storage bucket', () => {
    expect(migrationSource).toContain("'personal-quest-photos'")
    expect(migrationSource).toContain('public = false')
    expect(migrationSource).toContain("array['image/jpeg', 'image/png', 'image/webp']")
    expect(migrationSource.match(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(migrationSource).not.toContain('getPublicUrl')
  })

  it('keeps the tracker habit-based without calories or scale weight', () => {
    const lower = `${migrationSource}\n${weeklyRuleMigrationSource}\n${streakFreezeMigrationSource}`.toLowerCase()
    expect(lower).not.toContain('calorie')
    expect(lower).not.toContain('calories')
    expect(lower).not.toContain('body_weight')
    expect(lower).not.toContain('scale_weight')
  })

  it('adds the private weekly rule to the RLS-protected profile table', () => {
    expect(weeklyRuleMigrationSource).toContain('alter table public.personal_quest_profiles')
    expect(weeklyRuleMigrationSource).toContain('add column if not exists weekly_rule text not null')
  })
})
