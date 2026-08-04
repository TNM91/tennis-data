import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PlatformResumeCandidate } from '../platform-resume'
import {
  filterPlatformResumeCandidates,
  getPlatformResumeFingerprint,
  PLATFORM_RESUME_LATER_MS,
  sanitizePlatformResumeSuppressions,
} from '../platform-resume-preferences'

const now = Date.parse('2026-08-03T12:00:00.000Z')
const lineup: PlatformResumeCandidate = {
  id: 'captain',
  lane: 'Captain',
  label: 'Lineup Builder',
  context: 'TIQ Tri-Level',
  href: '/captain/lineup-builder?team=TIQ',
  visitedAt: '2026-08-03T11:45:00.000Z',
  status: 'unfinished',
  actionLabel: 'Finish lineup',
  reason: '3 courts still in draft',
  priority: 110,
}

describe('platform resume attention preferences', () => {
  it('moves an exact action to Later for 24 hours', () => {
    const suppressions = sanitizePlatformResumeSuppressions([{
      fingerprint: getPlatformResumeFingerprint(lineup),
      mode: 'later',
      savedAt: new Date(now).toISOString(),
      until: new Date(now + PLATFORM_RESUME_LATER_MS).toISOString(),
    }], now)

    expect(filterPlatformResumeCandidates([lineup], suppressions, now)).toEqual([])
    expect(filterPlatformResumeCandidates([lineup], suppressions, now + PLATFORM_RESUME_LATER_MS + 1)).toEqual([lineup])
  })

  it('keeps hidden work available again when the action changes', () => {
    const suppressions = sanitizePlatformResumeSuppressions([{
      fingerprint: getPlatformResumeFingerprint(lineup),
      mode: 'hidden',
      savedAt: new Date(now).toISOString(),
    }], now)
    const changed = { ...lineup, actionLabel: 'Send lineup', reason: 'The lineup is ready for the team' }

    expect(filterPlatformResumeCandidates([lineup], suppressions, now)).toEqual([])
    expect(filterPlatformResumeCandidates([changed], suppressions, now)).toEqual([changed])
  })

  it('keeps the controls compact, reversible, and separate from saved work', () => {
    const hook = readFileSync(join(process.cwd(), 'app/components/use-platform-resume.ts'), 'utf8')
    const header = readFileSync(join(process.cwd(), 'app/components/site-header.tsx'), 'utf8')

    expect(hook).toContain("message: mode === 'later' ? 'Moved to Later.' : 'Shortcut hidden.'")
    expect(hook).toContain('undoLastSuppression')
    expect(header).toContain('title="Hide for 24 hours"')
    expect(header).toContain('title="Hide until this work changes"')
    expect(header).toContain('>Undo</button>')
    expect(header).not.toContain('deletePlatformResume')
  })
})
