import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_JOURNEY_FLOW_MAPS,
  getCustomerJourneyFlowMap,
  getCustomerJourneyFlowMapsForFeature,
  getCustomerJourneyFlowMapsForTier,
} from '../customer-journey-flow-map'
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
const qaIndexSource = readFileSync(join(process.cwd(), 'docs/customer-journey-qa-index.md'), 'utf8')
const fixtureSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-fixtures.md'), 'utf8')
const processMapSource = readFileSync(join(process.cwd(), 'docs/customer-journey-process-map.md'), 'utf8')
const deployChecklistSource = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
const routeSmokeSource = readFileSync(join(process.cwd(), 'scripts/verify-platform-routes.mjs'), 'utf8')
const dayOneRunbookSource = readFileSync(join(process.cwd(), 'docs/customer-journey-day-one-runbook.md'), 'utf8')
const weeklyRunbookSource = readFileSync(join(process.cwd(), 'docs/customer-journey-weekly-runbook.md'), 'utf8')
const dayOneReadinessScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-day-one-readiness.mjs'), 'utf8')
const weeklyReadinessScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-weekly-readiness.mjs'), 'utf8')
const fixtureChecklistScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-checklist.mjs'), 'utf8')
const qaPrepScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-prep.mjs'), 'utf8')
const qaStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-status.mjs'), 'utf8')
const journeySessionScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-session-brief.mjs'), 'utf8')
const journeyCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-card.mjs'), 'utf8')
const tierCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tier-card.mjs'), 'utf8')
const tierStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tier-status.mjs'), 'utf8')
const evidenceChecklistScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-evidence-checklist.mjs'), 'utf8')
const flowMapScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-flow-map.mjs'), 'utf8')
const journeyFocusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-focus.mjs'), 'utf8')
const journeyHandoffScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-handoffs.mjs'), 'utf8')
const packageSource = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
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

  it('keeps the QA index as the one-page starting point', () => {
    for (const command of [
      'npm run qa:prep',
      'npm run qa:status',
      'npm run qa:next',
      'npm run qa:session',
      'npm run qa:journey',
      'npm run qa:tier',
      'npm run qa:tier-status',
      'npm run qa:day1',
      'npm run qa:week',
      'npm run qa:fixtures',
      'npm run qa:ledger',
      'npm run qa:flows',
      'npm run qa:focus',
      'npm run qa:handoffs',
      'npm run qa:matrix',
      'npm run qa:gaps',
      'npm run qa:evidence',
      'npm run qa:triage',
      'npm run qa:results',
      'npm run qa:launch',
      'npm run verify:closeout:live',
    ]) {
      expect(qaIndexSource, `${command} missing from QA index`).toContain(command)
    }

    for (const doc of [
      'docs/customer-journey-weekly-runbook.md',
      'docs/customer-journey-day-one-runbook.md',
      'docs/customer-journey-test-plan.md',
      'docs/customer-journey-test-results.md',
      'docs/customer-journey-test-fixtures.md',
      'docs/level-up-sync-audit.md',
      'docs/platform-closeout-verification-log.md',
    ]) {
      expect(qaIndexSource, `${doc} missing from QA index`).toContain(doc)
    }

    expect(testScriptsSource).toContain('docs/customer-journey-qa-index.md')
    expect(packageSource).toContain('"qa:prep": "node scripts/customer-journey-qa-prep.mjs"')
    expect(packageSource).toContain('"qa:status": "node scripts/customer-journey-qa-status.mjs"')
    expect(packageSource).toContain('"qa:next": "node scripts/customer-journey-next.mjs"')
    expect(packageSource).toContain('"qa:session": "node scripts/customer-journey-session-brief.mjs"')
    expect(packageSource).toContain('"qa:journey": "node scripts/customer-journey-card.mjs"')
    expect(packageSource).toContain('"qa:tier": "node scripts/customer-journey-tier-card.mjs"')
    expect(packageSource).toContain('"qa:tier-status": "node scripts/customer-journey-tier-status.mjs"')
    expect(packageSource).toContain('"qa:fixtures": "node scripts/customer-journey-fixture-checklist.mjs"')
    expect(packageSource).toContain('"qa:flows": "node scripts/customer-journey-flow-map.mjs"')
    expect(packageSource).toContain('"qa:focus": "node scripts/customer-journey-focus.mjs"')
    expect(packageSource).toContain('"qa:handoffs": "node scripts/customer-journey-handoffs.mjs"')
    expect(packageSource).toContain('"qa:matrix": "node scripts/customer-journey-feature-matrix.mjs"')
    expect(packageSource).toContain('"qa:gaps": "node scripts/customer-journey-gap-report.mjs"')
    expect(packageSource).toContain('"qa:evidence": "node scripts/customer-journey-evidence-checklist.mjs"')
    expect(packageSource).toContain('"qa:triage": "node scripts/customer-journey-triage-guide.mjs"')
    expect(packageSource).toContain('"qa:results": "node scripts/customer-journey-results-summary.mjs"')
    expect(packageSource).toContain('"qa:launch": "node scripts/customer-journey-launch-readiness.mjs"')
    expect(qaStatusScriptSource).toContain('docs/customer-journey-qa-index.md')
    expect(qaStatusScriptSource).toContain('qa:prep')
    expect(qaStatusScriptSource).toContain('qa:next')
    expect(qaStatusScriptSource).toContain('qa:session')
    expect(qaStatusScriptSource).toContain('qa:journey')
    expect(qaStatusScriptSource).toContain('qa:tier')
    expect(qaStatusScriptSource).toContain('qa:tier-status')
    expect(qaStatusScriptSource).toContain('qa:fixtures')
    expect(qaStatusScriptSource).toContain('qa:flows')
    expect(qaStatusScriptSource).toContain('qa:focus')
    expect(qaStatusScriptSource).toContain('qa:handoffs')
    expect(qaStatusScriptSource).toContain('qa:matrix')
    expect(qaStatusScriptSource).toContain('qa:gaps')
    expect(qaStatusScriptSource).toContain('qa:evidence')
    expect(qaStatusScriptSource).toContain('qa:triage')
    expect(qaStatusScriptSource).toContain('qa:results')
    expect(qaStatusScriptSource).toContain('qa:launch')

    for (const script of [
      'scripts/customer-journey-qa-status.mjs',
      'scripts/customer-journey-weekly-readiness.mjs',
      'scripts/customer-journey-card.mjs',
      'scripts/customer-journey-tier-card.mjs',
      'scripts/customer-journey-tier-status.mjs',
      'scripts/customer-journey-fixture-checklist.mjs',
      'scripts/customer-journey-flow-map.mjs',
      'scripts/customer-journey-handoffs.mjs',
      'scripts/customer-journey-feature-matrix.mjs',
      'scripts/customer-journey-gap-report.mjs',
      'scripts/customer-journey-evidence-checklist.mjs',
      'scripts/customer-journey-triage-guide.mjs',
      'scripts/customer-journey-results-summary.mjs',
      'scripts/verify-platform-closeout-inventory.mjs',
    ]) {
      expect(qaPrepScriptSource, `${script} missing from QA prep`).toContain(script)
    }
  })

  it('keeps the deploy checklist connected to the customer journey QA packet', () => {
    for (const anchor of [
      'docs/customer-journey-qa-index.md',
      'npm run qa:prep',
      'npm run qa:status',
      'npm run qa:next',
      'npm run qa:session',
      'npm run qa:journey',
      'npm run qa:tier',
      'npm run qa:tier-status',
      'npm run qa:week',
      'npm run qa:fixtures',
      'npm run qa:ledger',
      'npm run qa:flows',
      'npm run qa:focus',
      'npm run qa:handoffs',
      'npm run qa:matrix',
      'npm run qa:gaps',
      'npm run qa:evidence',
      'npm run qa:triage',
      'npm run qa:results',
      'npm run qa:launch',
      'npm run verify:closeout',
      'npm run verify:closeout:live',
    ]) {
      expect(deployChecklistSource, `${anchor} missing from deploy checklist`).toContain(anchor)
    }
  })

  it('keeps customer journey flow maps tied to tiers, features, handoffs, and evidence', () => {
    expect(CUSTOMER_JOURNEY_FLOW_MAPS.length).toBeGreaterThanOrEqual(7)
    expect(new Set(CUSTOMER_JOURNEY_FLOW_MAPS.map((flow) => flow.id)).size).toBe(CUSTOMER_JOURNEY_FLOW_MAPS.length)
    expect(flowMapScriptSource).toContain('lib/customer-journey-flow-map.json')
    expect(journeyFocusScriptSource).toContain('lib/customer-journey-flow-map.json')
    expect(journeyFocusScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(journeyFocusScriptSource).toContain('npm run qa:focus -- <tier | flow id | feature id | search>')
    expect(journeyHandoffScriptSource).toContain('lib/customer-journey-flow-map.json')
    expect(journeyHandoffScriptSource).toContain('shared work must reach the right role')
    expect(processMapSource).toContain('lib/customer-journey-flow-map.json')
    expect(processMapSource).toContain('Flow Contract')
    expect(processMapSource).toContain('npm run qa:handoffs')

    for (const session of ['day1', 'day2', 'day3', 'day4', 'day5']) {
      expect(journeySessionScriptSource, `${session} missing from session brief`).toContain(session)
    }

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(journeySessionScriptSource, `${plan.id} missing from session brief`).toContain(plan.id)
    }

    for (const flow of CUSTOMER_JOURNEY_FLOW_MAPS) {
      expect(PLATFORM_CLOSEOUT_TIER_LABELS[flow.tierId], `${flow.id} has unknown tier`).toBeTruthy()
      expect(flow.entryRoute, flow.id).toMatch(/^\//)
      expect(flow.painPoint.trim(), flow.id).not.toHaveLength(0)
      expect(flow.accessRule.trim(), flow.id).not.toHaveLength(0)
      expect(flow.steps.length, flow.id).toBeGreaterThanOrEqual(3)
      expect(flow.primaryFeatureIds.length, flow.id).toBeGreaterThan(0)
      expect(processMapSource, `${flow.id} label missing from process map`).toContain(PLATFORM_CLOSEOUT_TIER_LABELS[flow.tierId])

      for (const featureId of flow.primaryFeatureIds) {
        expect(hasKnownCloseoutFeature(featureId), `${flow.id} references missing feature ${featureId}`).toBe(true)
      }

      for (const step of flow.steps) {
        expect(step.route, `${flow.id} step route`).toMatch(/^\//)
        expect(step.action.trim(), `${flow.id} step action`).not.toHaveLength(0)
        expect(step.productSignal.trim(), `${flow.id} product signal`).not.toHaveLength(0)
        expect(step.evidence.trim(), `${flow.id} evidence`).not.toHaveLength(0)
      }

      for (const handoff of flow.handoffs) {
        expect(PLATFORM_CLOSEOUT_TIER_LABELS[handoff.toTierId], `${flow.id} handoff tier`).toBeTruthy()
        expect(handoff.trigger.trim(), `${flow.id} handoff trigger`).not.toHaveLength(0)
        expect(handoff.proof.trim(), `${flow.id} handoff proof`).not.toHaveLength(0)
      }
    }

    expect(getCustomerJourneyFlowMap('player-practice-progress-loop')?.tierId).toBe('player_plus')
    expect(getCustomerJourneyFlowMapsForTier('coach').map((flow) => flow.id)).toContain('coach-assignment-lesson-loop')
    expect(getCustomerJourneyFlowMapsForFeature('player-level-up').map((flow) => flow.id)).toContain('player-practice-progress-loop')
  })

  it('keeps fixture references documented before journey testing starts', () => {
    for (const fixtureId of getCustomerJourneyFixtureIds()) {
      expect(fixtureSource, `${fixtureId} missing from fixture plan`).toContain(fixtureId)
      expect(fixtureChecklistScriptSource, `${fixtureId} missing from fixture checklist command`).toContain(fixtureId)
    }

    expect(fixtureSource).toContain('npm run qa:fixtures')
  })

  it('keeps every agenda entry route covered by production route smoke', () => {
    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(routeSmokeSource, `${plan.id} entry route missing from route smoke`).toContain(`route: '${plan.entryRoute}'`)
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

  it('keeps every agenda entry visible in the evidence checklist command', () => {
    expect(evidenceChecklistScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(journeyCardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(journeyCardScriptSource).toContain('npm run qa:journey -- <journey-id | tier | search>')
    expect(tierCardScriptSource).toContain('Closeout rule: a tier is not test-ready')
    expect(tierCardScriptSource).toContain('npm run qa:tier -- <free | player | coach | captain | league | full-court | admin>')
    expect(tierStatusScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(tierStatusScriptSource).toContain('a tier is ready only when every listed journey has pass evidence')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(evidenceChecklistScriptSource, `${plan.id} missing from evidence checklist`).toContain(plan.id)
      expect(evidenceChecklistScriptSource, `${plan.entryRoute} missing from evidence checklist`).toContain(plan.entryRoute)
      expect(evidenceChecklistScriptSource, `${plan.personaFixture} missing from evidence checklist`).toContain(plan.personaFixture)
      expect(evidenceChecklistScriptSource, `${plan.successSignal} missing from evidence checklist`).toContain(plan.successSignal)
      expect(journeyCardScriptSource, `${plan.id} missing from journey card command`).toContain(plan.id)
      expect(journeyCardScriptSource, `${plan.entryRoute} missing from journey card command`).toContain(plan.entryRoute)
      expect(journeyCardScriptSource, `${plan.personaFixture} missing from journey card command`).toContain(plan.personaFixture)
      expect(journeyCardScriptSource, `${plan.successSignal} missing from journey card command`).toContain(plan.successSignal)
      expect(tierCardScriptSource, `${plan.id} missing from tier card command`).toContain(plan.id)
      expect(tierStatusScriptSource, `${plan.id} missing from tier status command`).toContain(plan.id)
    }
  })

  it('keeps tier readiness cards aligned to role tiers and feature proof', () => {
    for (const [tierId, label] of Object.entries(PLATFORM_CLOSEOUT_TIER_LABELS)) {
      expect(tierCardScriptSource, `${tierId} missing from tier card command`).toContain(tierId)
      expect(tierCardScriptSource, `${label} missing from tier card command`).toContain(label)
      expect(tierStatusScriptSource, `${tierId} missing from tier status command`).toContain(tierId)
    }

    for (const featureId of [
      'free-public-explore',
      'player-level-up',
      'player-my-lab',
      'coach-hub',
      'coach-invite-link',
      'captain-lineup-week',
      'league-office',
      'full-court-navigation',
      'admin-access-management',
    ]) {
      expect(tierCardScriptSource, `${featureId} missing from tier card command`).toContain(featureId)
    }
  })

  it('keeps the day one runbook focused on the first two trust-heavy journeys', () => {
    const firstTwoPlans = CUSTOMER_JOURNEY_TEST_PLANS.slice(0, 2)

    expect(dayOneRunbookSource).toContain('docs/customer-journey-test-results.md')
    expect(dayOneRunbookSource).toContain('docs/level-up-sync-audit.md')
    expect(dayOneRunbookSource).toContain('npm run qa:day1')
    expect(packageSource).toContain('"qa:day1": "node scripts/customer-journey-day-one-readiness.mjs"')

    for (const plan of firstTwoPlans) {
      expect(dayOneRunbookSource, `${plan.id} missing from day one runbook`).toContain(plan.id)
      expect(dayOneRunbookSource, `${plan.entryRoute} missing from day one runbook`).toContain(plan.entryRoute)
      expect(dayOneRunbookSource, `${plan.personaFixture} missing from day one runbook`).toContain(plan.personaFixture)
      expect(dayOneReadinessScriptSource, `${plan.id} missing from readiness script`).toContain(plan.id)
      expect(dayOneReadinessScriptSource, `${plan.entryRoute} missing from readiness script`).toContain(plan.entryRoute)
    }
  })

  it('keeps the weekly runbook covering every agenda journey', () => {
    expect(weeklyRunbookSource).toContain('docs/customer-journey-day-one-runbook.md')
    expect(weeklyRunbookSource).toContain('docs/customer-journey-test-results.md')
    expect(weeklyRunbookSource).toContain('npm run qa:week')
    expect(weeklyRunbookSource).toContain('npm run verify:closeout:live')
    expect(testScriptsSource).toContain('docs/customer-journey-weekly-runbook.md')
    expect(packageSource).toContain('"qa:week": "node scripts/customer-journey-weekly-readiness.mjs"')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(weeklyRunbookSource, `${plan.id} missing from weekly runbook`).toContain(plan.id)
      expect(weeklyReadinessScriptSource, `${plan.id} missing from weekly readiness script`).toContain(plan.id)
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
