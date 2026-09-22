import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const improveHome = readFileSync(join(process.cwd(), 'app/player-development/_components/improve-landing-hub.tsx'), 'utf8')
const playerPath = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development-resume-tracker.tsx'), 'utf8')
const levelUp = readFileSync(join(process.cwd(), 'app/player-development/_components/player-live-workbench.tsx'), 'utf8')
const messages = readFileSync(join(process.cwd(), 'app/messages/page.tsx'), 'utf8')
const route = readFileSync(join(process.cwd(), 'app/api/player/resume/route.ts'), 'utf8')
const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260803000400_create_player_improve_workspace_preferences.sql'), 'utf8')

describe('Player and Improve active-work continuity', () => {
  it('stores signed-in Improve state in an owner-scoped cloud record', () => {
    expect(route).toContain(".from('player_improve_workspace_preferences')")
    expect(route).toContain('getResumeAuth')
    expect(migration).toContain('player_improve_workspace_preferences')
    expect(migration).toContain('auth.uid() = user_id')
  })

  it('opens the exact latest Improve destination instead of a generic shortcut', () => {
    expect(improveHome).toContain('getPlayerImproveResumeHref')
    expect(improveHome).toContain("label: 'Continue'")
    expect(improveHome).toContain('preferPrimaryAction={Boolean(continueAction)}')
    expect(playerPath).toContain("lastSurface: 'player-path'")
  })

  it('restores the active Level Up selection and unfinished proof across devices', () => {
    expect(levelUp).toContain("searchParams.get('drill')")
    expect(levelUp).toContain('loadPlayerImproveResumeStateFromCloud')
    expect(levelUp).toContain('setActiveDrillId(latest.drillId)')
    expect(levelUp).toContain('timerStorageKey(latest.drillId)')
    expect(levelUp).toContain('proofCounterStorageKey(latest.drillId)')
    expect(levelUp).toContain('sessionDraft: hasActiveDraft')
  })

  it('restores and syncs a player reply draft in the linked coach conversation', () => {
    expect(messages).toContain("contact.relationship === 'coach'")
    expect(messages).toContain('latest?.conversationId !== selectedConversation.id')
    expect(messages).toContain('conversationDraft: replyBody')
    expect(messages).toContain("lastSurface: 'conversation'")
  })
})
