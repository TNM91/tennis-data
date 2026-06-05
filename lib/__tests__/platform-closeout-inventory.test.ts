import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PLATFORM_CAPABILITY_STATUSES,
  PLATFORM_CLOSEOUT_FEATURES,
  PLATFORM_CLOSEOUT_TIER_LABELS,
  PLATFORM_CUSTOMER_JOURNEY_STAGES,
  PLATFORM_VERIFICATION_KINDS,
  type PlatformCloseoutTierId,
  getPlatformCloseoutFeaturesByJourneyStage,
  getPlatformCloseoutFeaturesByStatus,
  getPlatformCloseoutFeaturesByVerification,
  getPlatformCloseoutFeaturesForTier,
  getPlatformCloseoutNextActions,
  getPlatformCloseoutOutstandingFeatures,
  getPlatformCloseoutSummary,
} from '../platform-closeout-inventory'
import { MEMBERSHIP_TIER_ORDER } from '../product-story'

const REQUIRED_TIERS: PlatformCloseoutTierId[] = [...MEMBERSHIP_TIER_ORDER, 'admin_internal']
const journeyMapSource = readFileSync(join(process.cwd(), 'docs/customer-journey-process-map.md'), 'utf8')
const journeyTestScriptsSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-scripts.md'), 'utf8')
const journeyTestFixturesSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-fixtures.md'), 'utf8')

describe('platform closeout inventory', () => {
  it('keeps every product tier represented with actionable features', () => {
    expect(new Set(PLATFORM_CLOSEOUT_FEATURES.map((feature) => feature.id)).size).toBe(PLATFORM_CLOSEOUT_FEATURES.length)

    for (const tierId of REQUIRED_TIERS) {
      const features = getPlatformCloseoutFeaturesForTier(tierId)
      expect(PLATFORM_CLOSEOUT_TIER_LABELS[tierId], `${tierId} needs a label`).toBeTruthy()
      expect(features.length, `${tierId} needs closeout inventory coverage`).toBeGreaterThan(0)
    }
  })

  it('labels every feature with capability status, verification status, and next action', () => {
    for (const feature of PLATFORM_CLOSEOUT_FEATURES) {
      expect(feature.id.trim(), feature.id).not.toHaveLength(0)
      expect(feature.label.trim(), feature.id).not.toHaveLength(0)
      expect(feature.route, feature.id).toMatch(/^\//)
      expect(PLATFORM_CUSTOMER_JOURNEY_STAGES, feature.id).toContain(feature.journeyStage)
      expect(feature.painPoint.trim(), feature.id).not.toHaveLength(0)
      expect(feature.job.trim(), feature.id).not.toHaveLength(0)
      expect(PLATFORM_CAPABILITY_STATUSES, feature.id).toContain(feature.status)
      expect(PLATFORM_VERIFICATION_KINDS, feature.id).toContain(feature.verification.kind)
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

  it('summarizes closeout progress by tier, status, and verification kind', () => {
    const summary = getPlatformCloseoutSummary()

    expect(summary.totalFeatures).toBe(PLATFORM_CLOSEOUT_FEATURES.length)
    expect(summary.automatedFeatures).toBe(getPlatformCloseoutFeaturesByVerification('automated').length)
    expect(summary.outstandingFeatures).toBe(getPlatformCloseoutOutstandingFeatures().length)
    expect(summary.byStatus.local).toBe(getPlatformCloseoutFeaturesByStatus('local').length)
    expect(summary.byVerification.manual).toBe(getPlatformCloseoutFeaturesByVerification('manual').length)
    expect(summary.byJourneyStage.act).toBe(getPlatformCloseoutFeaturesByJourneyStage('act').length)

    for (const tierId of REQUIRED_TIERS) {
      expect(summary.byTier[tierId], `${tierId} should be counted in summary`).toBe(getPlatformCloseoutFeaturesForTier(tierId).length)
    }
  })

  it('keeps the core journey stages represented in the test-ready map', () => {
    for (const stage of ['discover', 'unlock', 'plan', 'act', 'review', 'share', 'operate', 'return', 'admin'] as const) {
      expect(getPlatformCloseoutFeaturesByJourneyStage(stage).length, `${stage} should have at least one feature`).toBeGreaterThan(0)
    }
  })

  it('keeps the technical journey map aligned to the feature inventory', () => {
    expect(journeyMapSource).toContain('Feature Access And Pain Point Matrix')

    for (const feature of PLATFORM_CLOSEOUT_FEATURES) {
      expect(journeyMapSource, `${feature.id} label missing from journey map`).toContain(feature.label)
      expect(journeyMapSource, `${feature.id} route missing from journey map`).toContain(feature.route)
      expect(journeyMapSource, `${feature.id} pain point missing from journey map`).toContain(feature.painPoint)
    }
  })

  it('keeps the manual journey test scripts aligned to the feature inventory', () => {
    expect(journeyTestScriptsSource).toContain('Highest-Risk Closeout Items')
    expect(journeyTestScriptsSource).toContain('docs/customer-journey-test-fixtures.md')

    for (const feature of PLATFORM_CLOSEOUT_FEATURES) {
      expect(journeyTestScriptsSource, `${feature.id} label missing from test scripts`).toContain(feature.label)
      expect(journeyTestScriptsSource, `${feature.id} route missing from test scripts`).toContain(feature.route)
    }
  })

  it('keeps the journey fixture plan aligned to tier and high-risk testing needs', () => {
    for (const label of Object.values(PLATFORM_CLOSEOUT_TIER_LABELS)) {
      expect(journeyTestFixturesSource, `${label} fixture coverage missing`).toContain(label)
    }

    for (const fixture of [
      'Coach invite token',
      'Level Up assignment',
      'Level Up completion',
      'Captain team week',
      'League week',
      'Data Assist upload',
      'Full-Court access state',
      'Admin access repair',
    ]) {
      expect(journeyTestFixturesSource, `${fixture} fixture missing`).toContain(fixture)
    }
  })

  it('prioritizes next actions toward account-dependent and local work before lower-risk manual docs', () => {
    const nextActions = getPlatformCloseoutNextActions(4)

    expect(nextActions.length).toBe(4)
    expect(nextActions.every((feature) => feature.verification.kind !== 'automated' || feature.status !== 'backend-backed')).toBe(true)
    expect(nextActions.map((feature) => feature.id)).toContain('coach-invite-link')
    expect(nextActions.map((feature) => feature.id)).toContain('player-level-up')
  })
})
