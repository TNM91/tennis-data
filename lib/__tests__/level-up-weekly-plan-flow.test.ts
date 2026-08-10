import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const playerWorkbenchSource = readSource('app/player-development/_components/player-live-workbench.tsx')
const playerCoachResponseSource = readSource('app/player-development/_components/weekly-plan-coach-response.tsx')
const playerRouteSource = readSource('app/api/player/level-up-weekly-plan/route.ts')
const coachRouteSource = readSource('app/api/coach/level-up-weekly-plans/route.ts')
const coachPageSource = readSource('app/coach/page.tsx')
const coachSharedWeekSource = readSource('app/coach/coach-shared-week.tsx')
const myQuestSource = readSource('app/level-up/my-quest/my-quest-client.tsx')
const migrationSource = readSource('supabase/migrations/20260810000100_create_level_up_weekly_plans.sql')
const responseMigrationSource = readSource('supabase/migrations/20260810000200_add_level_up_weekly_plan_coach_response.sql')

describe('Level Up weekly plan flow', () => {
  it('lets a player save, complete, sync, and explicitly share the current week', () => {
    expect(playerWorkbenchSource).toContain('Save this week')
    expect(playerWorkbenchSource).toContain('Mark done')
    expect(playerWorkbenchSource).toContain('Share with coach')
    expect(playerWorkbenchSource).toContain('/api/player/level-up-weekly-plan')
    expect(playerWorkbenchSource).toContain('completeWeeklyLevelUpPlanFocus')
    expect(playerRouteSource).toContain("code: 'coach_link_required'")
    expect(playerRouteSource).toContain("onConflict: 'player_user_id,week_start,identity_slug'")
  })

  it('shows only explicitly shared plans in the linked coach workspace', () => {
    expect(coachRouteSource).toContain(".eq('shared_with_coach', true)")
    expect(coachRouteSource).toContain(".eq('coach_user_id', auth.userId)")
    expect(coachPageSource).toContain('/api/coach/level-up-weekly-plans')
    expect(coachPageSource).toContain('<CoachSharedWeek')
    expect(coachSharedWeekSource).toContain('Shared Level Up week')
    expect(coachSharedWeekSource).toContain('Week complete. Use the proof trail for the next lesson.')
  })

  it('lets the linked coach acknowledge, adjust, or replace a rep without rewriting player-owned fields', () => {
    expect(coachSharedWeekSource).toContain('Looks good')
    expect(coachSharedWeekSource).toContain('Add cue')
    expect(coachSharedWeekSource).toContain('Swap rep')
    expect(coachRouteSource).toContain(".rpc('respond_to_level_up_weekly_plan'")
    expect(responseMigrationSource).toContain('security definer')
    expect(responseMigrationSource).toContain("plan.coach_user_id = auth.uid()")
    expect(responseMigrationSource).toContain("jsonb_set(v_plan_json, '{coachResponse}'")
    expect(responseMigrationSource).toContain('grant execute on function public.respond_to_level_up_weekly_plan')
    expect(playerRouteSource).toContain('coachResponse: existingPlan?.coachResponse ?? null')
    expect(playerWorkbenchSource).toContain('<WeeklyPlanCoachResponse')
    expect(playerCoachResponseSource).toContain('Coach update')
    expect(myQuestSource).toContain('Coach updated')
  })

  it('keeps the current plan visible in My Quest and protects it with row-level security', () => {
    expect(myQuestSource).toContain('Weekly plan')
    expect(myQuestSource).toContain('getWeeklyLevelUpPlanProgress')
    expect(migrationSource).toContain('alter table public.level_up_weekly_plans enable row level security')
    expect(migrationSource).toContain('Players can update own Level Up weekly plans')
    expect(migrationSource).toContain('Coaches can read shared Level Up weekly plans')
    expect(migrationSource).toContain('shared_with_coach')
  })
})
