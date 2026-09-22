import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const competeHome = readFileSync(join(process.cwd(), 'app/compete/_components/compete-home.tsx'), 'utf8')
const tracker = readFileSync(join(process.cwd(), 'app/compete/_components/compete-resume-tracker.tsx'), 'utf8')
const matchup = readFileSync(join(process.cwd(), 'app/matchup/page.tsx'), 'utf8')
const tournament = readFileSync(join(process.cwd(), 'app/tournaments/[id]/page.tsx'), 'utf8')
const tournamentAlerts = readFileSync(join(process.cwd(), 'app/tournaments/[id]/preferences/page.tsx'), 'utf8')
const league = readFileSync(join(process.cwd(), 'app/explore/leagues/tiq/[league]/page.tsx'), 'utf8')
const route = readFileSync(join(process.cwd(), 'app/api/compete/resume/route.ts'), 'utf8')
const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260803000500_create_compete_workspace_preferences.sql'), 'utf8')

describe('Compete active-work continuity', () => {
  it('stores signed-in Compete state in an owner-scoped cloud record', () => {
    expect(route).toContain(".from('compete_workspace_preferences')")
    expect(route).toContain('getResumeAuth')
    expect(migration).toContain('create table if not exists public.compete_workspace_preferences')
    expect(migration).toContain('auth.uid() = user_id')
  })

  it('opens the exact latest Compete destination from the home action', () => {
    expect(competeHome).toContain('getCompeteResumeHref')
    expect(competeHome).toContain("label: 'Continue'")
    expect(competeHome).toContain('preferPrimaryAction={Boolean(continueAction)}')
    expect(competeHome).toContain('resumeKey={userId ? `compete:${userId}` : \'compete\'}')
  })

  it('tracks exact matchup, event, alert, and league context', () => {
    expect(tracker).toContain('syncCompeteResumeState')
    expect(matchup).toContain('buildMatchupResumeHref')
    expect(matchup).toContain('matchupLabel={matchupResumeLabel}')
    expect(tournament).toContain("'tournament-entry' : 'tournament'")
    expect(tournamentAlerts).toContain('surface="tournament-alerts"')
    expect(league).toContain('leagueName={league.leagueName}')
  })

  it('does not persist tournament phone or email drafts', () => {
    expect(tracker).not.toContain('phone')
    expect(tracker).not.toContain('email')
  })
})
