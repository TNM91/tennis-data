import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('League Coordinator active-work continuity', () => {
  it('cloud-syncs a safe signed-in League resume state', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/league-coordinator/resume/route.ts'), 'utf8')
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260803000300_create_league_coordinator_workspace_preferences.sql'),
      'utf8',
    )

    expect(route).toContain('sanitizeLeagueCoordinatorResumeState(body.resume)')
    expect(route).toContain(".from('league_coordinator_workspace_preferences')")
    expect(route).toContain('.upsert({ user_id: auth.userId, resume_state: resume, updated_at: now }')
    expect(migration).toContain('create table if not exists public.league_coordinator_workspace_preferences')
    expect(migration).toContain('auth.uid() = user_id')
  })

  it('turns League home into an exact Continue action', () => {
    const workspace = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')

    expect(workspace).toContain("title: `Continue ${coordinatorResumeState?.lastSurfaceLabel || 'league work'}`")
    expect(workspace).toContain('primaryAction={coordinatorContinueAction || leagueHomeAction}')
    expect(workspace).toContain('preferPrimaryAction={Boolean(coordinatorContinueAction)}')
    expect(workspace).toContain('contextValue={coordinatorResumeLeague?.leagueName || latestRecord?.leagueName')
  })

  it('restores team, individual, tournament, and league conversation work', () => {
    const teamResults = readFileSync(join(process.cwd(), 'app/components/team-league-results-workspace.tsx'), 'utf8')
    const individualResults = readFileSync(join(process.cwd(), 'app/components/individual-league-results-workspace.tsx'), 'utf8')
    const tournaments = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')
    const messages = readFileSync(join(process.cwd(), 'app/messages/page.tsx'), 'utf8')

    expect(teamResults).toContain('setResumeTeamResultDraft(draft)')
    expect(teamResults).toContain("lastSurfaceLabel: activeEntryEventId ? 'Team Match Lines' : hasDraft ? 'Team Match Draft'")
    expect(individualResults).toContain('setResultPlayerA(draft.playerA ||')
    expect(individualResults).toContain("lastSurfaceLabel: hasDraft ? 'Player Result Draft' : 'Player Results'")
    expect(tournaments).toContain('setResumeTargetTournamentId(targetId)')
    expect(tournaments).toContain("lastSurfaceLabel: selectedId ? 'Tournament Desk' : 'Tournament Draft'")
    expect(messages).toContain("selectedConversation.conversationType !== 'league'")
    expect(messages).toContain("lastSurfaceLabel: 'League Conversation'")
  })
})
