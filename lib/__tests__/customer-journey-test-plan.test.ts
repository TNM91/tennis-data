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
const testWeekQuickstartSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-week-quickstart.md'), 'utf8')
const issueDecisionGuideSource = readFileSync(join(process.cwd(), 'docs/customer-journey-issue-decision-guide.md'), 'utf8')
const evidenceIndexSource = readFileSync(join(process.cwd(), 'docs/qa-evidence/README.md'), 'utf8')
const fixtureSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-fixtures.md'), 'utf8')
const processMapSource = readFileSync(join(process.cwd(), 'docs/customer-journey-process-map.md'), 'utf8')
const deployChecklistSource = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
const routeSmokeSource = readFileSync(join(process.cwd(), 'scripts/verify-platform-routes.mjs'), 'utf8')
const dayOneRunbookSource = readFileSync(join(process.cwd(), 'docs/customer-journey-day-one-runbook.md'), 'utf8')
const weeklyRunbookSource = readFileSync(join(process.cwd(), 'docs/customer-journey-weekly-runbook.md'), 'utf8')
const dayOneReadinessScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-day-one-readiness.mjs'), 'utf8')
const weeklyReadinessScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-weekly-readiness.mjs'), 'utf8')
const weekDashboardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-week-dashboard.mjs'), 'utf8')
const weekPlanScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-week-plan.mjs'), 'utf8')
const fixtureChecklistScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-checklist.mjs'), 'utf8')
const fixtureBoardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-board.mjs'), 'utf8')
const fixtureStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-status.mjs'), 'utf8')
const fixtureReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-review.mjs'), 'utf8')
const qaPrepScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-prep.mjs'), 'utf8')
const qaStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-status.mjs'), 'utf8')
const missionControlScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-mission-control.mjs'), 'utf8')
const qaStartScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-start.mjs'), 'utf8')
const qaTodayScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-today.mjs'), 'utf8')
const readinessBriefScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-readiness-brief.mjs'), 'utf8')
const journeyMorningBriefScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-morning-brief.mjs'), 'utf8')
const journeySessionStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-session-status.mjs'), 'utf8')
const journeyDayScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-day-brief.mjs'), 'utf8')
const testerPacketScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tester-packet.mjs'), 'utf8')
const kickoffScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-kickoff.mjs'), 'utf8')
const journeyCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-card.mjs'), 'utf8')
const liveJourneyCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-live-card.mjs'), 'utf8')
const deviceJourneyCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-card.mjs'), 'utf8')
const deviceLedgerScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-ledger.mjs'), 'utf8')
const deviceStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-status.mjs'), 'utf8')
const routeReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-route-review.mjs'), 'utf8')
const tierCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tier-card.mjs'), 'utf8')
const tierStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tier-status.mjs'), 'utf8')
const tierBoardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tier-board.mjs'), 'utf8')
const accessReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-access-review.mjs'), 'utf8')
const evidenceChecklistScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-evidence-checklist.mjs'), 'utf8')
const evidenceIndexScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-evidence-index.mjs'), 'utf8')
const evidencePackScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-evidence-pack.mjs'), 'utf8')
const issueDecisionScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-issue-decision.mjs'), 'utf8')
const proofGapScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-proof-gaps.mjs'), 'utf8')
const sessionLedgerScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-session-ledger.mjs'), 'utf8')
const flowMapScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-flow-map.mjs'), 'utf8')
const traceabilityScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-traceability.mjs'), 'utf8')
const journeyFocusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-focus.mjs'), 'utf8')
const journeyHandoffScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-handoffs.mjs'), 'utf8')
const featureReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-feature-review.mjs'), 'utf8')
const coverageReportScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-coverage-report.mjs'), 'utf8')
const riskBoardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-risk-board.mjs'), 'utf8')
const changeImpactScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-change-impact.mjs'), 'utf8')
const ledgerCheckScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-ledger-check.mjs'), 'utf8')
const resultsSummaryScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-results-summary.mjs'), 'utf8')
const nextJourneyScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-next.mjs'), 'utf8')
const actionListScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-action-list.mjs'), 'utf8')
const qaDataScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-data.mjs'), 'utf8')
const ownerBoardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-owner-board.mjs'), 'utf8')
const retestPlanScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-retest-plan.mjs'), 'utf8')
const dailySummaryScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-daily-summary.mjs'), 'utf8')
const dayCloseoutScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-day-closeout.mjs'), 'utf8')
const testerHandoffScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tester-handoff.mjs'), 'utf8')
const scorecardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-scorecard.mjs'), 'utf8')
const signoffSheetScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-signoff-sheet.mjs'), 'utf8')
const launchBoardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-launch-board.mjs'), 'utf8')
const launchReadinessScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-launch-readiness.mjs'), 'utf8')
const gapReportScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-gap-report.mjs'), 'utf8')
const packageSource = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
const CRITICAL_SCRIPT_ANCHORS: Record<string, string[]> = {
  'player-level-up-mobile-loop': [
    'Level Up Portal',
    '/player-development/relentless-competitor-4-0/level-up',
    'Level Up return-state panel',
    'Level Up local sync proof cue',
  ],
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
      'npm run qa:control',
      'npm run qa:start',
      'npm run qa:today',
      'npm run qa:readiness',
      'npm run qa:brief',
      'npm run qa:next',
      'npm run qa:session',
      'npm run qa:session-status',
      'npm run qa:day',
      'npm run qa:tester-packet',
      'npm run qa:kickoff',
      'npm run qa:journey',
      'npm run qa:live-card',
      'npm run qa:device-card',
      'npm run qa:device-ledger',
      'npm run qa:device-status',
      'npm run qa:route-review',
      'npm run qa:tier',
      'npm run qa:tier-status',
      'npm run qa:tier-board',
      'npm run qa:access-review',
      'npm run qa:day1',
      'npm run qa:week',
      'npm run qa:week-dashboard',
      'npm run qa:week-plan',
      'npm run qa:fixtures',
      'npm run qa:fixture-auth-smoke',
      'npm run qa:fixture-board',
      'npm run qa:fixture-status',
      'npm run qa:fixture-review',
      'npm run qa:ledger',
      'npm run qa:session-ledger',
      'npm run qa:flows',
      'npm run qa:trace',
      'npm run qa:focus',
      'npm run qa:handoffs',
      'npm run qa:matrix',
      'npm run qa:feature-review',
      'npm run qa:coverage',
      'npm run qa:risk-board',
      'npm run qa:change-impact',
      'npm run qa:gaps',
      'npm run qa:evidence',
      'npm run qa:evidence-index',
      'npm run qa:evidence-pack',
      'npm run qa:triage',
      'npm run qa:issue',
      'npm run qa:proof-gaps',
      'npm run qa:ledger-check',
      'npm run qa:results',
      'npm run qa:action-list',
      'npm run qa:owner-board',
      'npm run qa:retest',
      'npm run qa:daily-summary',
      'npm run qa:close-day',
      'npm run qa:tester-handoff',
      'npm run qa:scorecard',
      'npm run qa:signoff',
      'npm run qa:launch-board',
      'npm run qa:launch',
      'npm run verify:closeout:live',
    ]) {
      expect(qaIndexSource, `${command} missing from QA index`).toContain(command)
    }

    for (const doc of [
      'docs/customer-journey-test-week-quickstart.md',
      'docs/customer-journey-issue-decision-guide.md',
      'docs/customer-journey-weekly-runbook.md',
      'docs/customer-journey-day-one-runbook.md',
      'docs/customer-journey-test-plan.md',
      'docs/customer-journey-test-results.md',
      'docs/qa-evidence/README.md',
      'docs/customer-journey-test-fixtures.md',
      'docs/level-up-sync-audit.md',
      'docs/platform-closeout-verification-log.md',
    ]) {
      expect(qaIndexSource, `${doc} missing from QA index`).toContain(doc)
    }

    expect(testScriptsSource).toContain('docs/customer-journey-qa-index.md')
    expect(qaStatusScriptSource).toContain('docs/customer-journey-test-week-quickstart.md')
    expect(qaStatusScriptSource).toContain('docs/customer-journey-issue-decision-guide.md')
    expect(packageSource).toContain('"qa:prep": "node scripts/customer-journey-qa-prep.mjs"')
    expect(packageSource).toContain('"qa:status": "node scripts/customer-journey-qa-status.mjs"')
    expect(packageSource).toContain('"qa:control": "node scripts/customer-journey-mission-control.mjs"')
    expect(packageSource).toContain('"qa:start": "node scripts/customer-journey-start.mjs"')
    expect(packageSource).toContain('"qa:today": "node scripts/customer-journey-today.mjs"')
    expect(packageSource).toContain('"qa:readiness": "node scripts/customer-journey-readiness-brief.mjs"')
    expect(packageSource).toContain('"qa:brief": "node scripts/customer-journey-morning-brief.mjs"')
    expect(packageSource).toContain('"qa:next": "node scripts/customer-journey-next.mjs"')
    expect(packageSource).toContain('"qa:session": "node scripts/customer-journey-session-brief.mjs"')
    expect(packageSource).toContain('"qa:session-status": "node scripts/customer-journey-session-status.mjs"')
    expect(packageSource).toContain('"qa:day": "node scripts/customer-journey-day-brief.mjs"')
    expect(packageSource).toContain('"qa:tester-packet": "node scripts/customer-journey-tester-packet.mjs"')
    expect(packageSource).toContain('"qa:kickoff": "node scripts/customer-journey-kickoff.mjs"')
    expect(packageSource).toContain('"qa:journey": "node scripts/customer-journey-card.mjs"')
    expect(packageSource).toContain('"qa:live-card": "node scripts/customer-journey-live-card.mjs"')
    expect(packageSource).toContain('"qa:device-card": "node scripts/customer-journey-device-card.mjs"')
    expect(packageSource).toContain('"qa:device-ledger": "node scripts/customer-journey-device-ledger.mjs"')
    expect(packageSource).toContain('"qa:device-status": "node scripts/customer-journey-device-status.mjs"')
    expect(packageSource).toContain('"qa:route-review": "node scripts/customer-journey-route-review.mjs"')
    expect(packageSource).toContain('"qa:tier": "node scripts/customer-journey-tier-card.mjs"')
    expect(packageSource).toContain('"qa:tier-status": "node scripts/customer-journey-tier-status.mjs"')
    expect(packageSource).toContain('"qa:tier-board": "node scripts/customer-journey-tier-board.mjs"')
    expect(packageSource).toContain('"qa:access-review": "node scripts/customer-journey-access-review.mjs"')
    expect(packageSource).toContain('"qa:week-dashboard": "node scripts/customer-journey-week-dashboard.mjs"')
    expect(packageSource).toContain('"qa:week-plan": "node scripts/customer-journey-week-plan.mjs"')
    expect(packageSource).toContain('"qa:fixtures": "node scripts/customer-journey-fixture-checklist.mjs"')
    expect(packageSource).toContain('"qa:fixture-auth-smoke": "node scripts/customer-journey-fixture-auth-smoke.mjs"')
    expect(packageSource).toContain('"qa:fixture-board": "node scripts/customer-journey-fixture-board.mjs"')
    expect(packageSource).toContain('"qa:fixture-status": "node scripts/customer-journey-fixture-status.mjs"')
    expect(packageSource).toContain('"qa:fixture-review": "node scripts/customer-journey-fixture-review.mjs"')
    expect(packageSource).toContain('"qa:session-ledger": "node scripts/customer-journey-session-ledger.mjs"')
    expect(packageSource).toContain('"qa:flows": "node scripts/customer-journey-flow-map.mjs"')
    expect(packageSource).toContain('"qa:trace": "node scripts/customer-journey-traceability.mjs"')
    expect(packageSource).toContain('"qa:focus": "node scripts/customer-journey-focus.mjs"')
    expect(packageSource).toContain('"qa:handoffs": "node scripts/customer-journey-handoffs.mjs"')
    expect(packageSource).toContain('"qa:matrix": "node scripts/customer-journey-feature-matrix.mjs"')
    expect(packageSource).toContain('"qa:feature-review": "node scripts/customer-journey-feature-review.mjs"')
    expect(packageSource).toContain('"qa:coverage": "node scripts/customer-journey-coverage-report.mjs"')
    expect(packageSource).toContain('"qa:risk-board": "node scripts/customer-journey-risk-board.mjs"')
    expect(packageSource).toContain('"qa:change-impact": "node scripts/customer-journey-change-impact.mjs"')
    expect(packageSource).toContain('"qa:gaps": "node scripts/customer-journey-gap-report.mjs"')
    expect(packageSource).toContain('"qa:evidence": "node scripts/customer-journey-evidence-checklist.mjs"')
    expect(packageSource).toContain('"qa:evidence-index": "node scripts/customer-journey-evidence-index.mjs"')
    expect(packageSource).toContain('"qa:evidence-pack": "node scripts/customer-journey-evidence-pack.mjs"')
    expect(packageSource).toContain('"qa:triage": "node scripts/customer-journey-triage-guide.mjs"')
    expect(packageSource).toContain('"qa:issue": "node scripts/customer-journey-issue-decision.mjs"')
    expect(packageSource).toContain('"qa:proof-gaps": "node scripts/customer-journey-proof-gaps.mjs"')
    expect(proofGapScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(proofGapScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(proofGapScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(packageSource).toContain('"qa:ledger-check": "node scripts/customer-journey-ledger-check.mjs"')
    expect(packageSource).toContain('"qa:results": "node scripts/customer-journey-results-summary.mjs"')
    expect(packageSource).toContain('"qa:action-list": "node scripts/customer-journey-action-list.mjs"')
    expect(actionListScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(actionListScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(actionListScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(actionListScriptSource).toContain('sessionByJourneyId')
    expect(actionListScriptSource).toContain('journeyById')
    expect(actionListScriptSource).toContain('tierAliases')
    expect(actionListScriptSource).toContain('Tier:')
    expect(actionListScriptSource).toContain('Session:')
    expect(actionListScriptSource).toContain('if (tierQuery)')
    expect(actionListScriptSource).toContain('aliases.includes(normalizedQuery)')
    expect(packageSource).toContain('"qa:owner-board": "node scripts/customer-journey-owner-board.mjs"')
    expect(ownerBoardScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(ownerBoardScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(ownerBoardScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(packageSource).toContain('"qa:retest": "node scripts/customer-journey-retest-plan.mjs"')
    expect(retestPlanScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(retestPlanScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(retestPlanScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(packageSource).toContain('"qa:daily-summary": "node scripts/customer-journey-daily-summary.mjs"')
    expect(packageSource).toContain('"qa:close-day": "node scripts/customer-journey-day-closeout.mjs"')
    expect(packageSource).toContain('"qa:tester-handoff": "node scripts/customer-journey-tester-handoff.mjs"')
    expect(testerHandoffScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(testerHandoffScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(testerHandoffScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(packageSource).toContain('"qa:scorecard": "node scripts/customer-journey-scorecard.mjs"')
    expect(packageSource).toContain('"qa:signoff": "node scripts/customer-journey-signoff-sheet.mjs"')
    expect(packageSource).toContain('"qa:launch-board": "node scripts/customer-journey-launch-board.mjs"')
    expect(packageSource).toContain('"qa:launch": "node scripts/customer-journey-launch-readiness.mjs"')
    expect(gapReportScriptSource).toContain('Linking proof privacy cue')
    expect(gapReportScriptSource).toContain('Invite acceptance proof cue')
    expect(gapReportScriptSource).toContain('Coach invite account proof cue')
    expect(gapReportScriptSource).toContain('Capture the Captain Save status cue')
    expect(gapReportScriptSource).toContain('what is browser-saved')
    expect(gapReportScriptSource).toContain('Fixture safety, Admin access repair')
    expect(gapReportScriptSource).toContain('Admin import outcome proof cues')
    expect(gapReportScriptSource).toContain('Full-Court access pass cue')
    expect(gapReportScriptSource).toContain('Full-Court workspace fit proof cue')
    expect(gapReportScriptSource).toContain('Full-Court role switching proof cue')
    expect(gapReportScriptSource).toContain('source-to-public proof cue')
    expect(gapReportScriptSource).toContain('Level Up assignment handoff cue')
    expect(gapReportScriptSource).toContain('Coach lesson support proof cue')
    expect(gapReportScriptSource).toContain('Compete Bridge captain handoff cue')
    expect(gapReportScriptSource).toContain('Captain local sync proof cue')
    expect(gapReportScriptSource).toContain('Captain decision handoff proof cue')
    expect(gapReportScriptSource).toContain('League Office operation proof cue')
    expect(gapReportScriptSource).toContain('Data Assist review-first handoff cue')
    expect(gapReportScriptSource).toContain('Data Assist upload state proof cue')
    expect(qaDataScriptSource).toContain('Public discovery proof cue')
    expect(gapReportScriptSource).toContain('Level Up local sync proof cue')
    expect(gapReportScriptSource).toContain('My Lab refresh proof cue')
    expect(qaDataScriptSource).toContain('fixture safety rollback cue')
    expect(qaDataScriptSource).toContain('Admin access repair proof cue')
    expect(qaDataScriptSource).toContain('Admin import outcome proof cue')
    expect(qaDataScriptSource).toContain('Invite acceptance proof cue')
    expect(qaDataScriptSource).toContain('Coach invite account proof cue')
    expect(qaDataScriptSource).toContain('Full-Court access pass cue')
    expect(qaDataScriptSource).toContain('Full-Court workspace fit proof cue')
    expect(qaDataScriptSource).toContain('Full-Court role switching proof cue')
    expect(qaDataScriptSource).toContain('source-to-public proof cue')
    expect(qaDataScriptSource).toContain('Level Up assignment handoff cue')
    expect(qaDataScriptSource).toContain('Coach lesson support proof cue')
    expect(qaDataScriptSource).toContain('Compete Bridge captain handoff cue')
    expect(qaDataScriptSource).toContain('Captain local sync proof cue')
    expect(qaDataScriptSource).toContain('Captain decision handoff proof cue')
    expect(qaDataScriptSource).toContain('League Office operation proof cue')
    expect(qaDataScriptSource).toContain('Data Assist review-first handoff cue')
    expect(qaDataScriptSource).toContain('Data Assist upload state proof cue')
    expect(qaDataScriptSource).toContain('Level Up local sync proof cue')
    expect(qaDataScriptSource).toContain('My Lab refresh proof cue')
    expect(qaDataScriptSource).toContain('data-trust-guard-cue')
    expect(qaDataScriptSource).toContain('admin-access-repair-proof-cue')
    expect(qaDataScriptSource).toContain('admin-import-outcome-proof-cue')
    expect(qaDataScriptSource).toContain('level-up-local-sync-proof-cue')
    expect(qaDataScriptSource).toContain('invite-acceptance-proof-cue')
    expect(qaDataScriptSource).toContain('coach-invite-account-proof-cue')
    expect(qaDataScriptSource).toContain('full-court-access-pass-cue')
    expect(qaDataScriptSource).toContain('full-court-workspace-fit-proof-cue')
    expect(qaDataScriptSource).toContain('full-court-role-switching-proof-cue')
    expect(qaDataScriptSource).toContain('source-to-public-proof-cue')
    expect(qaDataScriptSource).toContain('level-up-assignment-handoff-cue')
    expect(qaDataScriptSource).toContain('coach-lesson-support-proof-cue')
    expect(qaDataScriptSource).toContain('compete-bridge-captain-handoff-cue')
    expect(qaDataScriptSource).toContain('captain-local-sync-proof-cue')
    expect(qaDataScriptSource).toContain('captain-decision-handoff-proof-cue')
    expect(qaDataScriptSource).toContain('league-office-operation-proof-cue')
    expect(qaDataScriptSource).toContain('data-assist-review-first-handoff-cue')
    expect(qaDataScriptSource).toContain('public-discovery-proof-cue')
    expect(qaDataScriptSource).toContain('data-assist-upload-state-proof-cue')
    expect(qaDataScriptSource).toContain('my-lab-refresh-proof-cue')
    expect(qaStatusScriptSource).toContain('docs/customer-journey-qa-index.md')
    expect(qaStatusScriptSource).toContain('docs/customer-journey-test-week-quickstart.md')
    expect(qaStatusScriptSource).toContain('docs/customer-journey-issue-decision-guide.md')
    expect(qaStatusScriptSource).toContain('qa:prep')
    expect(qaStatusScriptSource).toContain('qa:control')
    expect(qaStatusScriptSource).toContain('qa:start')
    expect(qaStatusScriptSource).toContain('qa:today')
    expect(qaStatusScriptSource).toContain('qa:readiness')
    expect(qaStatusScriptSource).toContain('qa:brief')
    expect(qaStatusScriptSource).toContain('qa:next')
    expect(qaStatusScriptSource).toContain('qa:session')
    expect(qaStatusScriptSource).toContain('qa:session-status')
    expect(qaStatusScriptSource).toContain('qa:day')
    expect(qaStatusScriptSource).toContain('qa:tester-packet')
    expect(qaStatusScriptSource).toContain('qa:kickoff')
    expect(qaStatusScriptSource).toContain('qa:journey')
    expect(qaStatusScriptSource).toContain('qa:live-card')
    expect(qaStatusScriptSource).toContain('qa:device-card')
    expect(qaStatusScriptSource).toContain('qa:device-ledger')
    expect(qaStatusScriptSource).toContain('qa:device-status')
    expect(qaStatusScriptSource).toContain('qa:route-review')
    expect(qaStatusScriptSource).toContain('qa:tier')
    expect(qaStatusScriptSource).toContain('qa:tier-status')
    expect(qaStatusScriptSource).toContain('qa:tier-board')
    expect(qaStatusScriptSource).toContain('qa:access-review')
    expect(qaStatusScriptSource).toContain('qa:week-dashboard')
    expect(qaStatusScriptSource).toContain('qa:week-plan')
    expect(qaStatusScriptSource).toContain('qa:fixtures')
    expect(qaStatusScriptSource).toContain('qa:fixture-auth-smoke')
    expect(qaStatusScriptSource).toContain('qa:fixture-board')
    expect(qaStatusScriptSource).toContain('qa:fixture-status')
    expect(qaStatusScriptSource).toContain('qa:fixture-review')
    expect(qaStatusScriptSource).toContain('qa:session-ledger')
    expect(qaStatusScriptSource).toContain('qa:flows')
    expect(qaStatusScriptSource).toContain('qa:trace')
    expect(qaStatusScriptSource).toContain('qa:focus')
    expect(qaStatusScriptSource).toContain('qa:handoffs')
    expect(qaStatusScriptSource).toContain('qa:matrix')
    expect(qaStatusScriptSource).toContain('qa:feature-review')
    expect(qaStatusScriptSource).toContain('qa:coverage')
    expect(qaStatusScriptSource).toContain('qa:risk-board')
    expect(qaStatusScriptSource).toContain('qa:change-impact')
    expect(qaStatusScriptSource).toContain('qa:gaps')
    expect(qaStatusScriptSource).toContain('qa:evidence')
    expect(qaStatusScriptSource).toContain('qa:evidence-index')
    expect(qaStatusScriptSource).toContain('qa:evidence-pack')
    expect(qaStatusScriptSource).toContain('qa:triage')
    expect(qaStatusScriptSource).toContain('qa:issue')
    expect(qaStatusScriptSource).toContain('qa:proof-gaps')
    expect(qaStatusScriptSource).toContain('qa:ledger-check')
    expect(qaStatusScriptSource).toContain('qa:results')
    expect(qaStatusScriptSource).toContain('qa:action-list')
    expect(qaStatusScriptSource).toContain('qa:owner-board')
    expect(qaStatusScriptSource).toContain('qa:retest')
    expect(qaStatusScriptSource).toContain('qa:daily-summary')
    expect(qaStatusScriptSource).toContain('qa:close-day')
    expect(qaStatusScriptSource).toContain('qa:tester-handoff')
    expect(qaStatusScriptSource).toContain('qa:scorecard')
    expect(qaStatusScriptSource).toContain('qa:signoff')
    expect(qaStatusScriptSource).toContain('qa:launch-board')
    expect(qaStatusScriptSource).toContain('qa:launch')

    for (const script of [
      'scripts/customer-journey-qa-status.mjs',
      'scripts/customer-journey-mission-control.mjs',
      'scripts/customer-journey-start.mjs',
      'scripts/customer-journey-today.mjs',
      'scripts/customer-journey-readiness-brief.mjs',
      'scripts/customer-journey-morning-brief.mjs',
      'scripts/customer-journey-weekly-readiness.mjs',
      'scripts/customer-journey-week-dashboard.mjs',
      'scripts/customer-journey-week-plan.mjs',
      'scripts/customer-journey-session-status.mjs',
      'scripts/customer-journey-day-brief.mjs',
      'scripts/customer-journey-tester-packet.mjs',
      'scripts/customer-journey-kickoff.mjs',
      'scripts/customer-journey-card.mjs',
      'scripts/customer-journey-live-card.mjs',
      'scripts/customer-journey-device-card.mjs',
      'scripts/customer-journey-device-ledger.mjs',
      'scripts/customer-journey-device-status.mjs',
      'scripts/customer-journey-route-review.mjs',
      'scripts/customer-journey-tier-card.mjs',
      'scripts/customer-journey-tier-status.mjs',
      'scripts/customer-journey-tier-board.mjs',
      'scripts/customer-journey-access-review.mjs',
      'scripts/customer-journey-session-ledger.mjs',
      'scripts/customer-journey-fixture-checklist.mjs',
      'scripts/customer-journey-fixture-board.mjs',
      'scripts/customer-journey-fixture-status.mjs',
      'scripts/customer-journey-fixture-review.mjs',
      'scripts/customer-journey-flow-map.mjs',
      'scripts/customer-journey-traceability.mjs',
      'scripts/customer-journey-handoffs.mjs',
      'scripts/customer-journey-feature-matrix.mjs',
      'scripts/customer-journey-feature-review.mjs',
      'scripts/customer-journey-coverage-report.mjs',
      'scripts/customer-journey-risk-board.mjs',
      'scripts/customer-journey-change-impact.mjs',
      'scripts/customer-journey-gap-report.mjs',
      'scripts/customer-journey-evidence-checklist.mjs',
      'scripts/customer-journey-evidence-index.mjs',
      'scripts/customer-journey-evidence-pack.mjs',
      'scripts/customer-journey-triage-guide.mjs',
      'scripts/customer-journey-issue-decision.mjs',
      'scripts/customer-journey-proof-gaps.mjs',
      'scripts/customer-journey-ledger-check.mjs',
      'scripts/customer-journey-results-summary.mjs',
      'scripts/customer-journey-action-list.mjs',
      'scripts/customer-journey-owner-board.mjs',
      'scripts/customer-journey-retest-plan.mjs',
      'scripts/customer-journey-daily-summary.mjs',
      'scripts/customer-journey-day-closeout.mjs',
      'scripts/customer-journey-tester-handoff.mjs',
      'scripts/customer-journey-scorecard.mjs',
      'scripts/customer-journey-signoff-sheet.mjs',
      'scripts/customer-journey-launch-board.mjs',
      'scripts/verify-platform-closeout-inventory.mjs',
    ]) {
      expect(qaPrepScriptSource, `${script} missing from QA prep`).toContain(script)
    }
  })

  it('keeps the test week quickstart tied to daily execution, pass rules, and every planned journey', () => {
    for (const command of [
      'npm run qa:prep',
      'npm run qa:control',
      'npm run qa:start',
      'npm run qa:today',
      'npm run qa:tester-packet',
      'npm run qa:kickoff',
      'npm run qa:fixture-board',
      'npm run qa:fixture-status',
      'npm run qa:evidence-index',
      'npm run qa:evidence-pack',
      'npm run qa:tier-board',
      'npm run qa:issue',
      'npm run qa:proof-gaps',
      'npm run qa:ledger-check',
      'npm run qa:session-status',
      'npm run qa:close-day',
      'npm run qa:change-impact',
      'npm run qa:tester-handoff',
      'npm run qa:launch-board',
      'npm run qa:launch',
      'npm run verify:closeout',
      'npm run verify:closeout:live',
    ]) {
      expect(testWeekQuickstartSource, `${command} missing from test week quickstart`).toContain(command)
    }

    for (const anchor of [
      'docs/customer-journey-qa-index.md',
      'docs/customer-journey-test-results.md',
      'fixture-gap',
      'p0',
      'p1',
      'screenshot or video evidence',
      'What Counts As Pass',
      'If You Get Stuck',
      'Recommended Week Sweep',
    ]) {
      expect(testWeekQuickstartSource, `${anchor} missing from test week quickstart`).toContain(anchor)
    }

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(testWeekQuickstartSource, `${plan.id} missing from test week quickstart`).toContain(plan.id)
    }
  })

  it('keeps the fixture status board tied to sessions, fixture gaps, and dependent journeys', () => {
    for (const anchor of [
      'TenAceIQ Fixture Status',
      'docs/customer-journey-test-fixtures.md',
      'docs/customer-journey-test-results.md',
      'fixture-gap',
      'npm run qa:fixtures',
      'npm run qa:fixture-review -- <fixture>',
      'npm run qa:tester-packet -- <day1-day5>',
      'level-up-assignment',
      'data-assist-upload',
      'npm run qa:fixture-auth-smoke',
      'Fixture gate: npm run qa:fixture-gate --',
      'customerJourneySessions',
      'journeyById',
    ]) {
      expect(fixtureStatusScriptSource, `${anchor} missing from fixture status script`).toContain(anchor)
    }

    for (const anchor of ['player-level-up-mobile-loop', 'coach-player-assigned-challenge']) {
      expect(qaDataScriptSource, `${anchor} missing from shared QA data`).toContain(anchor)
    }
  })

  it('keeps the fixture readiness board tied to account access, safe data, and fixture gaps', () => {
    for (const anchor of [
      'TenAceIQ Fixture Readiness Board',
      'docs/customer-journey-test-fixtures.md',
      'docs/customer-journey-test-results.md',
      'Account access',
      'Player and coach link',
      'Team and league data',
      'Admin and data safety',
      'fixture-gap',
      'qa:fixture-status',
      'qa:fixture-review',
      'Fixture board rule',
    ]) {
      expect(fixtureBoardScriptSource, `${anchor} missing from fixture readiness board`).toContain(anchor)
    }

    expect(fixtureBoardScriptSource).toContain('customerJourneyDetails')
    expect(fixtureBoardScriptSource).toContain('sessionByJourneyId')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the QA evidence index tied to capture storage and ledger proof', () => {
    for (const anchor of [
      'docs/qa-evidence',
      'docs/customer-journey-test-results.md',
      'npm run qa:evidence-index',
      'npm run qa:evidence-pack',
      'Screenshot/video',
      'Capture Standard',
      'Ledger Rule',
      'prove the journey signal',
      'Keep credentials',
    ]) {
      expect(evidenceIndexSource, `${anchor} missing from evidence README`).toContain(anchor)
      expect(evidenceIndexScriptSource, `${anchor} missing from evidence index script`).toContain(anchor)
    }

    expect(evidencePackScriptSource).toContain('docs/qa-evidence')
    expect(evidencePackScriptSource).toContain('docs/qa-evidence/README.md')
    expect(evidencePackScriptSource).toContain('qa:evidence-index')
  })

  it('keeps the issue decision guide tied to categories, severity, and retest commands', () => {
    for (const anchor of [
      'docs/customer-journey-test-results.md',
      'npm run qa:issue',
      'npm run qa:triage',
      'npm run qa:ledger-check',
      'npm run qa:action-list',
      'npm run qa:retest',
      'Stop wider testing',
      'Ledger Row Formula',
      'p0',
      'p1',
      'fixture-gap',
      'mobile-ux-gap',
      'content-quality-gap',
      'which journey proves the fix',
    ]) {
      expect(issueDecisionGuideSource, `${anchor} missing from issue decision guide`).toContain(anchor)
      expect(issueDecisionScriptSource, `${anchor} missing from issue decision script`).toContain(anchor)
    }
  })

  it('keeps the deploy checklist connected to the customer journey QA packet', () => {
    for (const anchor of [
      'docs/customer-journey-qa-index.md',
      'npm run qa:prep',
      'npm run qa:status',
      'npm run qa:control',
      'npm run qa:start',
      'npm run qa:today',
      'npm run qa:readiness',
      'npm run qa:brief',
      'npm run qa:next',
      'npm run qa:session',
      'npm run qa:session-status',
      'npm run qa:day',
      'npm run qa:tester-packet',
      'npm run qa:kickoff',
      'npm run qa:journey',
      'npm run qa:live-card',
      'npm run qa:device-card',
      'npm run qa:device-ledger',
      'npm run qa:device-status',
      'npm run qa:route-review',
      'npm run qa:tier',
      'npm run qa:tier-status',
      'npm run qa:tier-board',
      'npm run qa:access-review',
      'npm run qa:week',
      'npm run qa:week-dashboard',
      'npm run qa:week-plan',
      'npm run qa:fixtures',
      'npm run qa:fixture-board',
      'npm run qa:fixture-status',
      'npm run qa:fixture-review',
      'npm run qa:ledger',
      'npm run qa:session-ledger',
      'npm run qa:flows',
      'npm run qa:trace',
      'npm run qa:focus',
      'npm run qa:handoffs',
      'npm run qa:matrix',
      'npm run qa:feature-review',
      'npm run qa:coverage',
      'npm run qa:risk-board',
      'npm run qa:change-impact',
      'npm run qa:gaps',
      'npm run qa:evidence',
      'npm run qa:evidence-index',
      'npm run qa:evidence-pack',
      'npm run qa:triage',
      'npm run qa:issue',
      'npm run qa:proof-gaps',
      'npm run qa:ledger-check',
      'npm run qa:results',
      'npm run qa:action-list',
      'npm run qa:owner-board',
      'npm run qa:retest',
      'npm run qa:daily-summary',
      'npm run qa:close-day',
      'npm run qa:tester-handoff',
      'npm run qa:scorecard',
      'npm run qa:signoff',
      'npm run qa:launch-board',
      'npm run qa:launch',
      'npm run verify:closeout',
      'npm run verify:closeout:live',
    ]) {
      expect(deployChecklistSource, `${anchor} missing from deploy checklist`).toContain(anchor)
    }
  })

  it('keeps the tester handoff sheet tied to carry-forward blockers and next commands', () => {
    for (const anchor of [
      'TenAceIQ Tester Handoff',
      'docs/customer-journey-test-results.md',
      'Carry forward',
      'fixture-gap',
      'Open p0/p1',
      'missing pass evidence',
      'missing screenshot/video',
      'npm run qa:fixture-status --',
      'npm run qa:tester-packet --',
      'npm run qa:retest --',
      'Auth env: npm run qa:fixture-auth-smoke -- --env',
      'Auth smoke: npm run qa:fixture-auth-smoke',
      'npm run qa:action-list',
      'npm run qa:close-day --',
      'Handoff rule',
    ]) {
      expect(testerHandoffScriptSource, `${anchor} missing from tester handoff script`).toContain(anchor)
    }

    expect(testerHandoffScriptSource).toContain('customerJourneySessions')
    expect(testerHandoffScriptSource).toContain('customerJourneyDetails')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the owner board tied to journey ownership, blockers, and next commands', () => {
    for (const anchor of [
      'TenAceIQ Customer Journey Owner Board',
      'docs/customer-journey-test-results.md',
      'Owner load',
      'Journey ownership',
      'open p0/p1',
      'missing next action',
      'npm run qa:action-list',
      'npm run qa:tester-handoff -- <day1-day5>',
      'npm run qa:change-impact -- --files=<comma-separated-files>',
      'Owner rule',
    ]) {
      expect(ownerBoardScriptSource, `${anchor} missing from owner board script`).toContain(anchor)
    }

    expect(ownerBoardScriptSource).toContain('customerJourneyDetails')
    expect(ownerBoardScriptSource).toContain('sessionByJourneyId')

    for (const owner of ['Product + mobile QA', 'Coach workflow QA', 'Admin/data QA', 'Public discovery QA']) {
      expect(qaDataScriptSource, `${owner} missing from shared QA data`).toContain(owner)
    }

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the change impact review tied to changed files and journey reruns', () => {
    for (const anchor of [
      'TenAceIQ Change Impact Review',
      'Use this after a code change or deploy before trusting older pass evidence.',
      'Diff source',
      'Product-affecting files',
      'Impacted journeys',
      'Session rerun queue',
      'npm run qa:tester-packet --',
      'npm run qa:retest --',
      'npm run qa:evidence-pack --',
      'npm run qa:scorecard',
      'Change rule',
      '--files=<comma-separated-files>',
    ]) {
      expect(changeImpactScriptSource, `${anchor} missing from change impact script`).toContain(anchor)
    }

    expect(changeImpactScriptSource).toContain('journeyById')
    expect(changeImpactScriptSource).toContain('sessionByJourneyId')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
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
    expect(processMapSource).toContain('Test-Ready Evidence Contract')
    expect(processMapSource).toContain('Tester Role')
    expect(processMapSource).toContain('Return-State Proof')
    expect(processMapSource).toContain('npm run qa:trace -- <tier | journey | feature | route>')
    expect(processMapSource).toContain('npm run qa:handoffs')
    expect(processMapSource).toContain('npm run qa:coverage -- <tier>')
    expect(traceabilityScriptSource).toContain('lib/customer-journey-flow-map.json')
    expect(traceabilityScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(flowMapScriptSource).toContain('Tester role')
    expect(flowMapScriptSource).toContain('Access check')
    expect(flowMapScriptSource).toContain('Evidence artifact')
    expect(flowMapScriptSource).toContain('Return-state proof')

    for (const session of ['day1', 'day2', 'day3', 'day4', 'day5']) {
      expect(qaDataScriptSource, `${session} missing from shared QA data`).toContain(session)
      expect(journeySessionStatusScriptSource).toContain('customerJourneySessions')
      expect(journeyMorningBriefScriptSource).toContain('customerJourneySessions')
      expect(journeyDayScriptSource).toContain('customerJourneySessions')
      expect(testerPacketScriptSource).toContain('customerJourneySessions')
      expect(evidencePackScriptSource).toContain('customerJourneySessions')
      expect(sessionLedgerScriptSource, `${session} missing from session ledger`).toContain(session)
    }

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(journeySessionStatusScriptSource).toContain('plannedJourneyIds')
      expect(journeyMorningBriefScriptSource).toContain('journeyById')
      expect(journeyDayScriptSource).toContain('journeyById')
      expect(testerPacketScriptSource).toContain('journeyById')
      expect(evidencePackScriptSource).toContain('journeyById')
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }

    for (const flow of CUSTOMER_JOURNEY_FLOW_MAPS) {
      expect(PLATFORM_CLOSEOUT_TIER_LABELS[flow.tierId], `${flow.id} has unknown tier`).toBeTruthy()
      expect(flow.entryRoute, flow.id).toMatch(/^\//)
      expect(flow.painPoint.trim(), flow.id).not.toHaveLength(0)
      expect(flow.accessRule.trim(), flow.id).not.toHaveLength(0)
      expect(flow.testerRole.trim(), flow.id).not.toHaveLength(0)
      expect(flow.fixtureIds.length, flow.id).toBeGreaterThan(0)
      expect(flow.accessCheck.trim(), flow.id).not.toHaveLength(0)
      expect(flow.evidenceArtifact.trim(), flow.id).not.toHaveLength(0)
      expect(flow.returnStateProof.trim(), flow.id).not.toHaveLength(0)
      expect(flow.steps.length, flow.id).toBeGreaterThanOrEqual(3)
      expect(flow.primaryFeatureIds.length, flow.id).toBeGreaterThan(0)
      expect(processMapSource, `${flow.id} label missing from process map`).toContain(PLATFORM_CLOSEOUT_TIER_LABELS[flow.tierId])
      expect(processMapSource, `${flow.id} tester role missing from process map`).toContain(flow.testerRole)
      expect(processMapSource, `${flow.id} access check missing from process map`).toContain(flow.accessCheck)
      expect(processMapSource, `${flow.id} evidence artifact missing from process map`).toContain(flow.evidenceArtifact)
      expect(processMapSource, `${flow.id} return proof missing from process map`).toContain(flow.returnStateProof)

      for (const fixtureId of flow.fixtureIds) {
        expect(fixtureSource, `${flow.id} references missing fixture ${fixtureId}`).toContain(fixtureId)
        expect(processMapSource, `${flow.id} fixture ${fixtureId} missing from process map`).toContain(fixtureId)
      }

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
      expect(fixtureBoardScriptSource, `${fixtureId} missing from fixture readiness board`).toContain(fixtureId)
      expect(fixtureReviewScriptSource, `${fixtureId} missing from fixture review command`).toContain(fixtureId)
    }

    expect(fixtureSource).toContain('npm run qa:fixtures')
    expect(fixtureSource).toContain('npm run qa:fixture-board')
    expect(fixtureSource).toContain('npm run qa:fixture-review')
    expect(fixtureBoardScriptSource).toContain('docs/customer-journey-test-fixtures.md')
    expect(fixtureBoardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(fixtureBoardScriptSource).toContain('account access')
    expect(fixtureBoardScriptSource).toContain('player/coach links')
    expect(fixtureBoardScriptSource).toContain('Fixture board rule')
    expect(fixtureReviewScriptSource).toContain('docs/customer-journey-test-fixtures.md')
    expect(fixtureReviewScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(fixtureReviewScriptSource).toContain('a missing fixture is a fixture-gap')
  })

  it('keeps every agenda entry route covered by production route smoke', () => {
    expect(routeSmokeSource).toContain('requiresAuth')
    expect(routeSmokeSource).toContain('authRedirects')
    expect(routeSmokeSource).toContain('unexpected-auth-redirect')

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
    expect(evidenceChecklistScriptSource).toContain('customerJourneyDetails')
    expect(evidencePackScriptSource).toContain('Evidence folder')
    expect(evidencePackScriptSource).toContain('evidence names should prove the journey signal')
    expect(ledgerCheckScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(proofGapScriptSource).toContain('TenAceIQ Proof Gap Board')
    expect(proofGapScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(proofGapScriptSource).toContain('Missing pass evidence')
    expect(proofGapScriptSource).toContain('Pass rows missing screenshot/video')
    expect(proofGapScriptSource).toContain('Open p0/p1 blockers')
    expect(proofGapScriptSource).toContain('qa:kickoff')
    expect(proofGapScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(proofGapScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(proofGapScriptSource).toContain('qa:evidence-pack')
    expect(proofGapScriptSource).toContain('Proof gap rule')
    expect(proofGapScriptSource).toContain('customerJourneyDetails')
    expect(proofGapScriptSource).toContain('sessionByJourneyId')
    expect(proofGapScriptSource).toContain('tierAliases')
    expect(coverageReportScriptSource).toContain('docs/customer-journey-process-map.md')
    expect(coverageReportScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(coverageReportScriptSource).toContain('every feature should have a proving journey')
    expect(coverageReportScriptSource).toContain('customerJourneyDetails')
    expect(coverageReportScriptSource).toContain('tierAliases')
    expect(traceabilityScriptSource).toContain('TenAceIQ Journey Traceability Map')
    expect(traceabilityScriptSource).toContain('tier promise, pain point, feature access')
    expect(traceabilityScriptSource).toContain('qa:coverage')
    expect(traceabilityScriptSource).toContain('qa:today')
    expect(featureReviewScriptSource).toContain('docs/customer-journey-process-map.md')
    expect(featureReviewScriptSource).toContain('lib/customer-journey-flow-map.json')
    expect(featureReviewScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(featureReviewScriptSource).toContain('a feature is not ready until')
    expect(journeyMorningBriefScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(journeyMorningBriefScriptSource).toContain('begin with one high-risk proof gap')
    expect(missionControlScriptSource).toContain('TenAceIQ QA Mission Control')
    expect(missionControlScriptSource).toContain('compact meeting view')
    expect(missionControlScriptSource).toContain('qa:today')
    expect(missionControlScriptSource).toContain('qa:launch')
    expect(missionControlScriptSource).toContain('customerJourneySessions')
    expect(missionControlScriptSource).toContain('customerJourneyDetails')
    expect(qaStartScriptSource).toContain('TenAceIQ QA Start')
    expect(qaStartScriptSource).toContain('npm run qa:readiness')
    expect(qaStartScriptSource).toContain('qa:tester-packet')
    expect(qaStartScriptSource).toContain('qa:next')
    expect(qaTodayScriptSource).toContain('TenAceIQ Today QA Sheet')
    expect(qaTodayScriptSource).toContain('qa:tester-packet')
    expect(qaTodayScriptSource).toContain('qa:close-day')
    expect(qaTodayScriptSource).toContain('required devices')
    expect(qaTodayScriptSource).toContain('customerJourneySessions')
    expect(qaTodayScriptSource).toContain('customerJourneyDetails')
    expect(qaTodayScriptSource).toContain('customerJourneyDeviceProfiles')
    expect(readinessBriefScriptSource).toContain('TenAceIQ Journey Test Readiness Brief')
    expect(readinessBriefScriptSource).toContain('Ready to start testing')
    expect(readinessBriefScriptSource).toContain('ready to launch means')
    expect(readinessBriefScriptSource).toContain('qa:week-plan')
    expect(riskBoardScriptSource).toContain('docs/customer-journey-process-map.md')
    expect(riskBoardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(riskBoardScriptSource).toContain('start with open p0/p1 trust issues')
    expect(riskBoardScriptSource).toContain('customerJourneyDetails')
    expect(riskBoardScriptSource).toContain('sessionByJourneyId')
    expect(riskBoardScriptSource).toContain('tierAliases')
    expect(ledgerCheckScriptSource).toContain('Ledger check: not ready.')
    expect(ledgerCheckScriptSource).toContain('Ledger check: valid.')
    expect(ledgerCheckScriptSource).toContain('npm run qa:launch')
    expect(resultsSummaryScriptSource).toContain('Open fixture-gap rows')
    expect(resultsSummaryScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(resultsSummaryScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(nextJourneyScriptSource).toContain('npm run qa:fixture-gate --')
    expect(nextJourneyScriptSource).toContain('npm run qa:fixture-auth-smoke -- --env')
    expect(nextJourneyScriptSource).toContain('npm run qa:fixture-auth-smoke')
    expect(actionListScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(actionListScriptSource).toContain('p0/p1 needs a fix or explicit launch decision')
    expect(retestPlanScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(retestPlanScriptSource).toContain('Closeout rule: a fix is not closed')
    expect(dailySummaryScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(dailySummaryScriptSource).toContain('Top fix')
    expect(dayCloseoutScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(dayCloseoutScriptSource).toContain('Fixture blockers')
    expect(dayCloseoutScriptSource).toContain('npm run qa:fixture-gate --')
    expect(dayCloseoutScriptSource).toContain('npm run qa:fixture-auth-smoke -- --env')
    expect(dayCloseoutScriptSource).toContain('npm run qa:fixture-auth-smoke')
    expect(dayCloseoutScriptSource).toContain('a testing day is not closed')
    expect(dayCloseoutScriptSource).toContain('customerJourneySessions')
    expect(scorecardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(scorecardScriptSource).toContain('compact test-week status view')
    expect(scorecardScriptSource).toContain('fixture blocked')
    expect(scorecardScriptSource).toContain('npm run qa:fixture-gate --')
    expect(scorecardScriptSource).toContain('npm run qa:fixture-auth-smoke -- --env')
    expect(scorecardScriptSource).toContain('npm run qa:fixture-auth-smoke')
    expect(scorecardScriptSource).toContain('Closeout rule: use the scorecard')
    expect(scorecardScriptSource).toContain('customerJourneyDetails')
    expect(scorecardScriptSource).toContain('sessionByJourneyId')
    expect(signoffSheetScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(signoffSheetScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(signoffSheetScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(signoffSheetScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(signoffSheetScriptSource).toContain('signed off means pass evidence')
    expect(signoffSheetScriptSource).toContain('customerJourneyDetails')
    expect(signoffSheetScriptSource).toContain('sessionByJourneyId')
    expect(launchReadinessScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(launchReadinessScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(launchReadinessScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(journeySessionStatusScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(journeySessionStatusScriptSource).toContain('Fixture blockers')
    expect(journeySessionStatusScriptSource).toContain('fixture blocked')
    expect(journeySessionStatusScriptSource).toContain('npm run qa:fixture-gate --')
    expect(journeySessionStatusScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(journeySessionStatusScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(journeySessionStatusScriptSource).toContain('a session is ready to move on only when every listed journey has pass evidence')
    expect(journeyCardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(journeyCardScriptSource).toContain('npm run qa:journey -- <journey-id | tier | search>')
    expect(testerPacketScriptSource).toContain('TenAceIQ Tester Packet')
    expect(testerPacketScriptSource).toContain('npm run qa:tester-packet -- <day1 | day2 | day3 | day4 | day5>')
    expect(testerPacketScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(testerPacketScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(testerPacketScriptSource).toContain('Auth smoke: npm run qa:fixture-auth-smoke')
    expect(testerPacketScriptSource).toContain('qa:device-ledger')
    expect(testerPacketScriptSource).toContain('mobile-ux-gap')
    expect(kickoffScriptSource).toContain('TenAceIQ Journey Kickoff')
    expect(kickoffScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(kickoffScriptSource).toContain('qa:fixture-board')
    expect(kickoffScriptSource).toContain('qa:fixture-gate')
    expect(kickoffScriptSource).toContain('qa:fixture-auth-smoke -- --env')
    expect(kickoffScriptSource).toContain('qa:fixture-auth-smoke')
    expect(kickoffScriptSource).toContain('qa:tester-packet')
    expect(kickoffScriptSource).toContain('qa:live-card')
    expect(kickoffScriptSource).toContain('Kickoff rule')
    expect(kickoffScriptSource).toContain('customerJourneyDetails')
    expect(kickoffScriptSource).toContain('sessionByJourneyId')
    expect(liveJourneyCardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(liveJourneyCardScriptSource).toContain('TenAceIQ Live Journey Test Card')
    expect(liveJourneyCardScriptSource).toContain('Paste-ready ledger row')
    expect(liveJourneyCardScriptSource).toContain('blocked-state commands')
    expect(liveJourneyCardScriptSource).toContain('Fixture preflight:')
    expect(liveJourneyCardScriptSource).toContain('npm run qa:fixture-auth-smoke -- --env')
    expect(liveJourneyCardScriptSource).toContain('auth smoke blocked')
    expect(liveJourneyCardScriptSource).toContain('npm run qa:fixture-gate -- ')
    expect(deviceJourneyCardScriptSource).toContain('TenAceIQ Device Journey Card')
    expect(deviceJourneyCardScriptSource).toContain('viewport-specific risk')
    expect(deviceJourneyCardScriptSource).toContain('npm run qa:live-card')
    expect(deviceLedgerScriptSource).toContain('TenAceIQ Device Ledger Rows')
    expect(deviceLedgerScriptSource).toContain('Paste these rows into docs/customer-journey-test-results.md')
    expect(deviceLedgerScriptSource).toContain('viewport-specific risk')
    expect(deviceLedgerScriptSource).toContain('needs-follow-up')
    expect(deviceStatusScriptSource).toContain('TenAceIQ Device Status')
    expect(deviceStatusScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(deviceStatusScriptSource).toContain('Device coverage')
    expect(deviceStatusScriptSource).toContain('device/browser value')
    expect(routeReviewScriptSource).toContain('docs/customer-journey-process-map.md')
    expect(routeReviewScriptSource).toContain('lib/customer-journey-flow-map.json')
    expect(routeReviewScriptSource).toContain('a route is not proven by loading')
    expect(routeReviewScriptSource).toContain('customerJourneyDetails')
    expect(tierCardScriptSource).toContain('Closeout rule: a tier is not test-ready')
    expect(tierCardScriptSource).toContain('npm run qa:tier -- <free | player | coach | captain | league | full-court | admin>')
    expect(tierCardScriptSource).toContain('customerJourneyDetails')
    expect(tierCardScriptSource).toContain('tierAliases')
    expect(tierStatusScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(tierStatusScriptSource).toContain('a tier is ready only when every listed journey has pass evidence')
    expect(tierStatusScriptSource).toContain('customerJourneyDetails')
    expect(tierStatusScriptSource).toContain('tierAliases')
    expect(tierBoardScriptSource).toContain('TenAceIQ Tier Feature Board')
    expect(tierBoardScriptSource).toContain('docs/customer-journey-process-map.md')
    expect(tierBoardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(tierBoardScriptSource).toContain('Feature pain points')
    expect(tierBoardScriptSource).toContain('Board rule')
    expect(tierBoardScriptSource).toContain('customerJourneyDetails')
    expect(tierBoardScriptSource).toContain('sessionByJourneyId')
    expect(accessReviewScriptSource).toContain('docs/customer-journey-process-map.md')
    expect(accessReviewScriptSource).toContain('lib/customer-journey-flow-map.json')
    expect(accessReviewScriptSource).toContain('expected tier can use its tools')
    expect(accessReviewScriptSource).toContain('customerJourneyDetails')
    expect(accessReviewScriptSource).toContain('tierAliases')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
      expect(qaDataScriptSource, `${plan.successSignal} missing from shared QA data`).toContain(plan.successSignal)
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(missionControlScriptSource).toContain('customerJourneySessions')
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaTodayScriptSource).toContain('customerJourneySessions')
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(kickoffScriptSource).toContain('customerJourneyDetails')
      expect(journeyCardScriptSource).toContain('customerJourneyDetails')
      expect(liveJourneyCardScriptSource).toContain('customerJourneyDetails')
      expect(deviceJourneyCardScriptSource).toContain('customerJourneyDetails')
      expect(deviceLedgerScriptSource).toContain('customerJourneyDetails')
      expect(deviceStatusScriptSource).toContain('customerJourneyDetails')
      expect(routeReviewScriptSource).toContain('customerJourneyDetails')
      expect(fixtureReviewScriptSource).toContain('customerJourneyDetails')
      expect(fixtureReviewScriptSource).toContain('sessionByJourneyId')
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
      expect(qaDataScriptSource, `${plan.successSignal} missing from shared QA data`).toContain(plan.successSignal)
      expect(tierCardScriptSource).toContain('customerJourneyDetails')
      expect(tierStatusScriptSource).toContain('customerJourneyDetails')
      expect(tierBoardScriptSource).toContain('customerJourneyDetails')
      expect(accessReviewScriptSource).toContain('customerJourneyDetails')
      expect(featureReviewScriptSource).toContain('customerJourneyDetails')
      expect(coverageReportScriptSource).toContain('customerJourneyDetails')
      expect(traceabilityScriptSource, `${plan.id} missing from traceability command`).toContain(plan.id)
      expect(riskBoardScriptSource).toContain('customerJourneyDetails')
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(dayCloseoutScriptSource).toContain('customerJourneySessions')
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(launchBoardScriptSource).toContain('customerJourneyDetails')
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })

  it('keeps the launch blocker board tied to blockers, evidence gaps, and final gates', () => {
    for (const anchor of [
      'TenAceIQ Launch Blocker Board',
      'docs/customer-journey-test-results.md',
      'Product launch blockers',
      'Fixture/test blockers',
      'Fixture gate: npm run qa:fixture-gate --',
      'Auth env: npm run qa:fixture-auth-smoke -- --env',
      'Auth smoke: npm run qa:fixture-auth-smoke',
      'Quality follow-ups',
      'Missing pass evidence',
      'Pass rows missing screenshot/video',
      'qa:launch',
      'verify:closeout:live',
      'Launch board rule',
    ]) {
      expect(launchBoardScriptSource, `${anchor} missing from launch board`).toContain(anchor)
    }
  })

  it('keeps tier readiness cards aligned to role tiers and feature proof', () => {
    for (const [tierId, label] of Object.entries(PLATFORM_CLOSEOUT_TIER_LABELS)) {
      expect(qaDataScriptSource, `${tierId} missing from shared QA data`).toContain(tierId)
      expect(qaDataScriptSource, `${label} missing from shared QA data`).toContain(label)
      expect(tierCardScriptSource).toContain('customerJourneyDetails')
      expect(qaDataScriptSource, `${tierId} missing from shared QA data`).toContain(tierId)
      expect(tierStatusScriptSource).toContain('customerJourneyDetails')
      expect(tierBoardScriptSource).toContain('customerJourneyDetails')
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
      expect(featureReviewScriptSource, `${featureId} missing from feature review command`).toContain(featureId)
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
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
    }

    expect(dayOneReadinessScriptSource).toContain('customerJourneySessions')
    expect(dayOneReadinessScriptSource).toContain('journeyById')
  })

  it('keeps the weekly runbook covering every agenda journey', () => {
    expect(weeklyRunbookSource).toContain('docs/customer-journey-day-one-runbook.md')
    expect(weeklyRunbookSource).toContain('docs/customer-journey-test-results.md')
    expect(weeklyRunbookSource).toContain('npm run qa:week')
    expect(weeklyRunbookSource).toContain('npm run verify:closeout:live')
    expect(testScriptsSource).toContain('docs/customer-journey-weekly-runbook.md')
    expect(packageSource).toContain('"qa:week": "node scripts/customer-journey-weekly-readiness.mjs"')
    expect(packageSource).toContain('"qa:week-dashboard": "node scripts/customer-journey-week-dashboard.mjs"')
    expect(packageSource).toContain('"qa:week-plan": "node scripts/customer-journey-week-plan.mjs"')
    expect(weekDashboardScriptSource).toContain('TenAceIQ Test Week Dashboard')
    expect(weekDashboardScriptSource).toContain('lib/customer-journey-flow-map.json')
    expect(weekDashboardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(weekDashboardScriptSource).toContain('Access check')
    expect(weekDashboardScriptSource).toContain('Evidence')
    expect(weekDashboardScriptSource).toContain('Return proof')
    expect(weekDashboardScriptSource).toContain('Dashboard rule')
    expect(weekDashboardScriptSource).toContain('customerJourneySessions')
    expect(weekDashboardScriptSource).toContain('customerJourneyDetails')
    expect(weekPlanScriptSource).toContain('TenAceIQ Test Week Plan')
    expect(weekPlanScriptSource).toContain('qa:tester-packet')
    expect(weekPlanScriptSource).toContain('required device pass')
    expect(weekPlanScriptSource).toContain('customerJourneySessions')
    expect(weekPlanScriptSource).toContain('customerJourneyDetails')
    expect(weekPlanScriptSource).toContain('customerJourneyDeviceProfiles')
    expect(weeklyReadinessScriptSource).toContain('customerJourneySessions')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(weeklyRunbookSource, `${plan.id} missing from weekly runbook`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
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
