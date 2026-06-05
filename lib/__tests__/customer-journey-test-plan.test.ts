import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_JOURNEY_TEST_PLANS,
  getCustomerJourneyFixtureIds,
  getCustomerJourneyTestPlan,
  getCustomerJourneyTestPlansForTier,
  getHighestRiskCustomerJourneyPlans,
  hasKnownCloseoutFeature,
} from '../customer-journey-test-plan'
import { PLATFORM_CLOSEOUT_TIER_LABELS } from '../platform-closeout-inventory'

const testPlanDocSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-plan.md'), 'utf8')
const testScriptsSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-scripts.md'), 'utf8')
const fixtureSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-fixtures.md'), 'utf8')
const processMapSource = readFileSync(join(process.cwd(), 'docs/customer-journey-process-map.md'), 'utf8')
const CRITICAL_SCRIPT_ANCHORS: Record<string, string[]> = {
  'player-level-up-mobile-loop': ['Level Up Portal', '/player-development/relentless-competitor-4-0/level-up', 'local saved state behaves honestly'],
  'coach-player-assigned-challenge': ['Coach-To-Player Assigned Challenge Journey', 'Player sees the assigned challenge', 'Coach returns to review the proof'],
}

describe('customer journey test plan', () => {
  it('keeps journeys ordered, labeled, and tied to known closeout features', () => {
    expect(CUSTOMER_JOURNEY_TEST_PLANS.length).toBeGreaterThanOrEqual(8)
    expect(new Set(CUSTOMER_JOURNEY_TEST_PLANS.map((plan) => plan.id)).size).toBe(CUSTOMER_JOURNEY_TEST_PLANS.length)
    expect(new Set(CUSTOMER_JOURNEY_TEST_PLANS.map((plan) => plan.suggestedOrder)).size).toBe(CUSTOMER_JOURNEY_TEST_PLANS.length)

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(PLATFORM_CLOSEOUT_TIER_LABELS[plan.tierId], `${plan.id} has unknown tier`).toBeTruthy()
      expect(plan.entryRoute, plan.id).toMatch(/^\//)
      expect(plan.primaryQuestion.trim(), plan.id).not.toHaveLength(0)
      expect(plan.successSignal.trim(), plan.id).not.toHaveLength(0)
      expect(plan.failFastSignals.length, plan.id).toBeGreaterThan(0)
      expect(plan.evidenceToCapture.length, plan.id).toBeGreaterThan(0)

      for (const featureId of plan.featureIds) {
        expect(hasKnownCloseoutFeature(featureId), `${plan.id} references missing feature ${featureId}`).toBe(true)
      }
    }
  })

  it('keeps the typed plan mirrored in the human-readable agenda', () => {
    expect(testPlanDocSource).toContain('Testing Agenda')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(testPlanDocSource, `${plan.id} label missing`).toContain(plan.label)
      expect(testPlanDocSource, `${plan.id} route missing`).toContain(plan.entryRoute)
      expect(testPlanDocSource, `${plan.id} success signal missing`).toContain(plan.successSignal)
      expect(processMapSource, `${plan.id} tier journey missing`).toContain(PLATFORM_CLOSEOUT_TIER_LABELS[plan.tierId])
    }
  })

  it('keeps fixture references documented before journey testing starts', () => {
    for (const fixtureId of getCustomerJourneyFixtureIds()) {
      expect(fixtureSource, `${fixtureId} missing from fixture plan`).toContain(fixtureId)
    }
  })

  it('keeps critical journeys visible in the manual test scripts', () => {
    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS.filter((item) => item.risk === 'critical')) {
      expect(testPlanDocSource, `${plan.id} agenda label missing`).toContain(plan.label)

      for (const anchor of CRITICAL_SCRIPT_ANCHORS[plan.id] ?? []) {
        expect(testScriptsSource, `${plan.id} manual anchor missing: ${anchor}`).toContain(anchor)
      }
    }
  })

  it('offers tier and risk helpers for daily closeout planning', () => {
    expect(getCustomerJourneyTestPlan('coach-player-assigned-challenge')?.tierId).toBe('coach')
    expect(getCustomerJourneyTestPlansForTier('coach').map((plan) => plan.id)).toContain('coach-player-assigned-challenge')
    expect(getHighestRiskCustomerJourneyPlans(2).map((plan) => plan.id)).toEqual([
      'player-level-up-mobile-loop',
      'coach-player-assigned-challenge',
    ])
  })
})
