import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getPlatformResumeCompletionMessage } from '../platform-resume-events'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('platform resume completion events', () => {
  it('keeps completion copy short and action-specific', () => {
    expect(getPlatformResumeCompletionMessage('Finish lineup')).toBe('Lineup draft cleared.')
    expect(getPlatformResumeCompletionMessage('Check replies')).toBe('Reply follow-up cleared.')
    expect(getPlatformResumeCompletionMessage('Finish message')).toBe('Message draft cleared.')
    expect(getPlatformResumeCompletionMessage('Unknown action')).toBe('Work updated.')
  })

  it('refreshes the shared shortcut after every lane memory write', () => {
    const sourceByFile = {
      'lib/captain-memory.ts': 'captain',
      'lib/coach-memory.ts': 'coach',
      'lib/compete-memory.ts': 'compete',
      'lib/explore-memory.ts': 'explore',
      'lib/league-coordinator-memory.ts': 'league',
      'lib/player-improve-memory.ts': 'improve',
    }

    for (const [file, source] of Object.entries(sourceByFile)) {
      const memory = read(file)
      expect(memory).toContain("import { notifyPlatformResumeUpdated } from './platform-resume-events'")
      expect(memory).toContain(`notifyPlatformResumeUpdated('${source}')`)
    }
  })

  it('only signals Team Chat when its draft becomes pending or clears', () => {
    const room = read('app/team-room/page.tsx')
    expect(room).toContain('draftPending !== draftPendingRef.current')
    expect(room).toContain("notifyPlatformResumeUpdated('team-chat')")
  })
})
