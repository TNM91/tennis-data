import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/club-workspace.tsx'), 'utf8').replace(/\r\n/g, '\n')

describe('Club loading recovery', () => {
  it('turns a stalled Club request into a clear retry path', () => {
    expect(source).toContain('const CLUB_REQUEST_TIMEOUT_MS = 12000')
    expect(source).toContain('const controller = new AbortController()')
    expect(source).toContain('signal: controller.signal')
    expect(source).toContain('Club took too long to open. Check your connection and try again.')
    expect(source).toContain('if (loadError && !workspace)')
    expect(source).toContain('title="Your club did not open."')
    expect(source).toContain('onPrimary={() => void loadClubs(selectedClubId)}')
  })

  it('replaces an unresolved account spinner with recovery actions', () => {
    expect(source).toContain('const CLUB_AUTH_RECOVERY_MS = 9000')
    expect(source).toContain('title="Club is taking longer than expected."')
    expect(source).toContain('void refreshAuth()')
    expect(source).toContain('secondaryLabel="Sign in again"')
    expect(source).toContain('function ClubOpeningState()')
    expect(source).toContain('Checking your account and club access.')
    expect(source).toContain('function ClubLoadRecovery({')
  })
})
