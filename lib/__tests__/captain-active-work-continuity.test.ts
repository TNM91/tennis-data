import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Captain active-work continuity', () => {
  it('cloud-syncs a safe signed-in workspace resume state', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/captain/resume/route.ts'), 'utf8')
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260803000100_create_captain_workspace_preferences.sql'),
      'utf8',
    )

    expect(route).toContain("sanitizeCaptainResumeState(body.resume)")
    expect(route).toContain(".from('captain_workspace_preferences')")
    expect(route).toContain(".upsert({")
    expect(migration).toContain('create table if not exists public.captain_workspace_preferences')
    expect(migration).toContain('auth.uid() = user_id')
  })

  it('puts match-day arrival follow-up and unresolved courts ahead of Continue', () => {
    const captain = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

    expect(captain).toContain("label: `Continue ${captainResume?.lastToolLabel || 'your work'}`")
    expect(captain).toContain('const captainHomePrimaryAction = captainLateArrivalAction || captainPostArrivalAction || captainArrivalFollowUpAction || captainCourtPrimaryAction || captainContinueAction || captainHomeShortcutPrimaryItem')
    expect(captain).toContain("id: 'late-arrival'")
    expect(captain).toContain("arrivalAction: 'message'")
    expect(captain).toContain('buildTeamRoomLateArrivalBuilderHref(lineupBuilderHref')
    expect(captain).toContain("id: 'send-lineup-change'")
    expect(captain).toContain("id: 'capture-scores'")
    expect(captain).toContain("id: 'send-team-recap'")
    expect(captain).toContain("id: 'close-match-week'")
    expect(captain).toContain("href: '#captain-score-capture-checklist'")
    expect(captain).toContain("href: '#captain-home-recap-ready'")
    expect(captain).toContain("href: '#captain-post-match-closeout'")
    expect(captain).toContain("safeText(entry.label) === 'Post-match recap copied'")
    expect(captain).toContain("id: 'arrival-follow-up'")
    expect(captain).toContain('messageId: captainArrivalFollowUp.messageId')
    expect(captain).toContain('court: captainArrivalFollowUp.courtLabel')
    expect(captain).toContain("captainHomePrimaryAction?.id === 'continue-captain-work' ? 'Continue'")
    expect(captain).toContain("stage: 'team-room' as CaptainResumeStage")
  })

  it('restores the selected match, saved lineup, and team conversation', () => {
    const lineup = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')
    const room = readFileSync(join(process.cwd(), 'app/team-room/page.tsx'), 'utf8')

    expect(lineup).toContain('const matchContext = resolveCaptainMatchContext(params)')
    expect(lineup).toContain('matchId: matchContext.matchId')
    expect(lineup).toContain("resumeState?.scenarioId || ''")
    expect(lineup).toContain('const scenarioId = currentScenarioId || prefillScenarioId || undefined')
    expect(lineup).toContain('}, userId, session?.access_token)')
    expect(room).toContain("resumeState?.lastTool !== 'team-room'")
    expect(room).toContain("lastToolLabel: 'Team Chat'")
    expect(room).toContain('teamRoomId: room.id')
  })
})
