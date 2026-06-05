import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PLATFORM_CLOSEOUT_FEATURES,
  type PlatformCapabilityStatus,
  type PlatformCloseoutTierId,
  type PlatformVerificationKind,
  getPlatformCloseoutFeaturesForTier,
} from '../platform-closeout-inventory'
import { MEMBERSHIP_TIER_ORDER } from '../product-story'

const REQUIRED_TIERS: PlatformCloseoutTierId[] = [...MEMBERSHIP_TIER_ORDER, 'admin_internal']

const CAPABILITY_STATUSES: PlatformCapabilityStatus[] = ['backend-backed', 'local', 'mock', 'manual', 'blocked']
const VERIFICATION_KINDS: PlatformVerificationKind[] = ['automated', 'manual', 'needs-account', 'blocked']

describe('platform closeout inventory', () => {
  it('keeps every product tier represented with actionable features', () => {
    expect(new Set(PLATFORM_CLOSEOUT_FEATURES.map((feature) => feature.id)).size).toBe(PLATFORM_CLOSEOUT_FEATURES.length)

    for (const tierId of REQUIRED_TIERS) {
      const features = getPlatformCloseoutFeaturesForTier(tierId)
      expect(features.length, `${tierId} needs closeout inventory coverage`).toBeGreaterThan(0)
    }
  })

  it('labels every feature with capability status, verification status, and next action', () => {
    for (const feature of PLATFORM_CLOSEOUT_FEATURES) {
      expect(feature.id.trim(), feature.id).not.toHaveLength(0)
      expect(feature.label.trim(), feature.id).not.toHaveLength(0)
      expect(feature.route, feature.id).toMatch(/^\//)
      expect(feature.job.trim(), feature.id).not.toHaveLength(0)
      expect(CAPABILITY_STATUSES, feature.id).toContain(feature.status)
      expect(VERIFICATION_KINDS, feature.id).toContain(feature.verification.kind)
      expect(feature.verification.note.trim(), feature.id).not.toHaveLength(0)
      expect(feature.nextCloseoutStep.trim(), feature.id).not.toHaveLength(0)
    }
  })

  it('keeps automated verification scripts real and tied to closeout automation where applicable', () => {
    const closeoutRunner = join(process.cwd(), 'scripts/verify-platform-closeout.mjs')
    const closeoutRunnerSource = existsSync(closeoutRunner) ? readFileSync(closeoutRunner, 'utf8') : ''

    for (const feature of PLATFORM_CLOSEOUT_FEATURES) {
      if (!feature.verification.script) continue

      const scriptPath = join(process.cwd(), feature.verification.script)
      expect(existsSync(scriptPath), `${feature.id} references missing script ${feature.verification.script}`).toBe(true)

      if (feature.verification.script.startsWith('scripts/verify-')) {
        expect(closeoutRunnerSource, `${feature.verification.script} should be listed in the closeout runner`).toContain(
          feature.verification.script
        )
      }
    }
  })

  it('keeps local, manual, and needs-account work visible instead of pretending it is done', () => {
    expect(PLATFORM_CLOSEOUT_FEATURES.some((feature) => feature.status === 'local')).toBe(true)
    expect(PLATFORM_CLOSEOUT_FEATURES.some((feature) => feature.status === 'manual')).toBe(true)
    expect(PLATFORM_CLOSEOUT_FEATURES.some((feature) => feature.verification.kind === 'needs-account')).toBe(true)
  })
})
