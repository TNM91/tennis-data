import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const playerApiSource = readFileSync(join(process.cwd(), 'app/api/player/level-up-sessions/route.ts'), 'utf8')
const coachApiSource = readFileSync(join(process.cwd(), 'app/api/coach/level-up-sessions/route.ts'), 'utf8')
const workbenchSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-live-workbench.tsx'), 'utf8')
const authSource = readFileSync(join(process.cwd(), 'lib/player-api-auth.ts'), 'utf8')

describe('Level Up session sync', () => {
  it('keeps coach-invited access separate from Player+ self-guided access', () => {
    expect(authSource).toContain('getSignedInPlayerApiAuth')
    expect(playerApiSource).toContain("accessMode === 'coach_invited'")
    expect(playerApiSource).toContain("accessMode === 'player_plus'")
    expect(playerApiSource).toContain('loadPlayerAccess')
    expect(playerApiSource).toContain('Connect with a coach invite before syncing coach-visible Level Up work.')
    expect(playerApiSource).toContain('Player+ is required to sync self-guided Level Up history across devices.')
  })

  it('persists Level Up work for players and exposes shared logs to coaches', () => {
    expect(existsSync(join(process.cwd(), 'supabase/migrations/20260530000100_create_level_up_sessions.sql'))).toBe(true)
    expect(playerApiSource).toContain(".from('level_up_sessions')")
    expect(playerApiSource).toContain('buildPlayerAssignmentCompletion')
    expect(coachApiSource).toContain(".from('level_up_sessions')")
    expect(coachApiSource).toContain(".eq('shared_with_coach', true)")
    expect(workbenchSource).toContain('/api/player/level-up-sessions')
    expect(workbenchSource).toContain('Synced. Your linked coach can use this for the next lesson.')
    expect(workbenchSource).toContain('Free preview saved locally.')
  })
})
