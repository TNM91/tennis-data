import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Coach active-work continuity', () => {
  it('cloud-syncs a safe signed-in Coach resume state', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/coach/resume/route.ts'), 'utf8')
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260803000200_create_coach_workspace_preferences.sql'),
      'utf8',
    )

    expect(route).toContain('sanitizeCoachResumeState(body.resume)')
    expect(route).toContain(".from('coach_workspace_preferences')")
    expect(route).toContain('.upsert({')
    expect(migration).toContain('create table if not exists public.coach_workspace_preferences')
    expect(migration).toContain('auth.uid() = user_id')
  })

  it('turns the Coach primary action into an exact Continue action', () => {
    const coach = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')
    const roleHome = readFileSync(join(process.cwd(), 'app/components/role-action-home.tsx'), 'utf8')

    expect(coach).toContain("title: `Continue ${coachResumeState?.lastSurfaceLabel || 'coaching'}`")
    expect(coach).toContain('primaryAction={coachContinueAction || coachHomeAction}')
    expect(coach).toContain('preferPrimaryAction={Boolean(coachContinueAction)}')
    expect(roleHome).toContain('preferPrimaryAction ? primaryAction : resumeAction || primaryAction')
  })

  it('restores the selected player, assignment draft, development plan, and saved conversation', () => {
    const coach = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')
    const messages = readFileSync(join(process.cwd(), 'app/messages/page.tsx'), 'utf8')

    expect(coach).toContain('const resumeStudentId = requestedStudentLinkId || resumeState.studentLinkId ||')
    expect(coach).toContain('setAssignmentTitle(draft.title ||')
    expect(coach).toContain("'development-plan',")
    expect(coach).toContain("'conversation',")
    expect(messages).toContain("selectedConversation.relatedEntityType !== 'coach_player_link'")
    expect(messages).toContain('conversationId: selectedConversation.id')
    expect(messages).toContain('lastHref: `/messages?thread=${encodeURIComponent(selectedConversation.id)}`')
  })
})
