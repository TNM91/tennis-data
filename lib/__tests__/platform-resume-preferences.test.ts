import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PlatformResumeCandidate } from '../platform-resume'
import {
  applyPlatformResumeCloudOperations,
  filterPlatformResumeCandidates,
  getPlatformResumeFingerprint,
  PLATFORM_RESUME_LATER_MS,
  sanitizePlatformResumeSuppressions,
  sanitizePlatformResumeCloudOperations,
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

  it('merges queued changes by shortcut without overwriting other devices', () => {
    const hidden = sanitizePlatformResumeSuppressions([{
      fingerprint: getPlatformResumeFingerprint(lineup),
      mode: 'hidden',
      savedAt: new Date(now).toISOString(),
    }], now)[0]
    const other = { ...hidden, fingerprint: 'coach|unfinished|Finish assignment', savedAt: new Date(now - 1000).toISOString() }
    const operations = sanitizePlatformResumeCloudOperations([{
      id: 'remove-lineup',
      action: 'remove',
      fingerprint: hidden.fingerprint,
      queuedAt: new Date(now + 1000).toISOString(),
    }], now)

    expect(applyPlatformResumeCloudOperations([hidden, other], operations, now)).toEqual([other])
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

  it('syncs authenticated preferences with an idempotent row per shortcut', () => {
    const hook = readFileSync(join(process.cwd(), 'app/components/use-platform-resume.ts'), 'utf8')
    const preferences = readFileSync(join(process.cwd(), 'lib/platform-resume-preferences.ts'), 'utf8')
    const route = readFileSync(join(process.cwd(), 'app/api/resume/preferences/route.ts'), 'utf8')
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260803000700_create_platform_resume_suppressions.sql'), 'utf8')

    expect(hook).toContain('syncPlatformResumeSuppressionsWithCloud(accessToken, userId)')
    expect(hook).toContain("window.addEventListener('online'")
    expect(preferences).toContain('PLATFORM_RESUME_PENDING_STORAGE_KEY')
    expect(preferences).toContain("fetch('/api/resume/preferences'")
    expect(preferences).toContain('seedExistingPlatformResumeSuppressions(userId)')
    expect(route).toContain('getPreferencesAuth(request)')
    expect(route).toContain("createHash('sha256')")
    expect(route).toContain(".upsert({")
    expect(route).toContain(".delete()")
    expect(migration).toContain('primary key (user_id, fingerprint_hash)')
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('auth.uid() = user_id')
  })
})
