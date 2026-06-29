import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_JOURNEY_TEST_PLANS } from '../customer-journey-test-plan'
import {
  CUSTOMER_JOURNEY_EVIDENCE_FIELDS,
  CUSTOMER_JOURNEY_ISSUE_CATEGORIES,
  CUSTOMER_JOURNEY_ISSUE_SEVERITIES,
  CUSTOMER_JOURNEY_RESULT_STATUSES,
  buildCustomerJourneyResultDraft,
  getCustomerJourneyIssueCategory,
  type CustomerJourneyIssueCategory,
} from '../customer-journey-test-results'

const resultsDocSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-results.md'), 'utf8')
const scriptsDocSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-scripts.md'), 'utf8')
const testWeekQuickstartSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-week-quickstart.md'), 'utf8')
const closeoutQaSource = readFileSync(join(process.cwd(), 'docs/platform-closeout-qa.md'), 'utf8')
const issueDecisionGuideSource = readFileSync(join(process.cwd(), 'docs/customer-journey-issue-decision-guide.md'), 'utf8')
const evidenceIndexSource = readFileSync(join(process.cwd(), 'docs/qa-evidence/README.md'), 'utf8')
const ledgerTemplateScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-ledger-template.mjs'), 'utf8')
const missionControlScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-mission-control.mjs'), 'utf8')
const qaStartScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-start.mjs'), 'utf8')
const qaTodayScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-today.mjs'), 'utf8')
const readinessBriefScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-readiness-brief.mjs'), 'utf8')
const sessionLedgerScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-session-ledger.mjs'), 'utf8')
const weekDashboardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-week-dashboard.mjs'), 'utf8')
const weekPlanScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-week-plan.mjs'), 'utf8')
const testerPacketScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tester-packet.mjs'), 'utf8')
const kickoffScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-kickoff.mjs'), 'utf8')
const liveJourneyCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-live-card.mjs'), 'utf8')
const deviceJourneyCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-card.mjs'), 'utf8')
const deviceLedgerScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-ledger.mjs'), 'utf8')
const deviceStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-status.mjs'), 'utf8')
const evidencePackScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-evidence-pack.mjs'), 'utf8')
const routeReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-route-review.mjs'), 'utf8')
const fixtureBoardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-board.mjs'), 'utf8')
const fixtureStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-status.mjs'), 'utf8')
const fixtureReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-review.mjs'), 'utf8')
const ledgerCheckScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-ledger-check.mjs'), 'utf8')
const resultsSummaryScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-results-summary.mjs'), 'utf8')
const nextJourneyScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-next.mjs'), 'utf8')
const actionListScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-action-list.mjs'), 'utf8')
const qaDataScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-data.mjs'), 'utf8')
const ownerBoardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-owner-board.mjs'), 'utf8')
const tierBoardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tier-board.mjs'), 'utf8')
const retestPlanScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-retest-plan.mjs'), 'utf8')
const changeImpactScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-change-impact.mjs'), 'utf8')
const testerHandoffScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tester-handoff.mjs'), 'utf8')
const accessReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-access-review.mjs'), 'utf8')
const featureReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-feature-review.mjs'), 'utf8')
const traceabilityScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-traceability.mjs'), 'utf8')
const scorecardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-scorecard.mjs'), 'utf8')
const launchBoardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-launch-board.mjs'), 'utf8')
const launchReadinessScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-launch-readiness.mjs'), 'utf8')
const triageGuideScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-triage-guide.mjs'), 'utf8')
const issueDecisionScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-issue-decision.mjs'), 'utf8')
const proofGapScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-proof-gaps.mjs'), 'utf8')
const evidenceIndexScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-evidence-index.mjs'), 'utf8')
const packageSource = readFileSync(join(process.cwd(), 'package.json'), 'utf8')

describe('customer journey test results', () => {
  it('keeps result statuses documented for manual testing', () => {
    for (const status of CUSTOMER_JOURNEY_RESULT_STATUSES) {
      expect(resultsDocSource, `${status} missing from result ledger doc`).toContain(status)
    }

    expect(CUSTOMER_JOURNEY_RESULT_STATUSES).toEqual(['pass', 'fail', 'blocked', 'needs-follow-up'])
  })

  it('keeps issue categories documented with action-oriented guidance', () => {
    const categories = Object.keys(CUSTOMER_JOURNEY_ISSUE_CATEGORIES) as CustomerJourneyIssueCategory[]

    expect(categories.length).toBeGreaterThanOrEqual(8)

    for (const category of categories) {
      const details = getCustomerJourneyIssueCategory(category)
      expect(resultsDocSource, `${category} missing from result ledger doc`).toContain(category)
      expect(details.label.trim(), category).not.toHaveLength(0)
      expect(details.useWhen.trim(), category).not.toHaveLength(0)
      expect(details.closeoutAction.trim(), category).not.toHaveLength(0)
    }
  })

  it('keeps the triage guide aligned to categories and severities', () => {
    expect(packageSource).toContain('"qa:triage": "node scripts/customer-journey-triage-guide.mjs"')
    expect(resultsDocSource).toContain('npm run qa:triage')
    expect(triageGuideScriptSource).toContain('docs/customer-journey-test-results.md')

    for (const category of Object.keys(CUSTOMER_JOURNEY_ISSUE_CATEGORIES)) {
      expect(triageGuideScriptSource, `${category} missing from triage guide`).toContain(category)
    }

    for (const severity of CUSTOMER_JOURNEY_ISSUE_SEVERITIES) {
      expect(triageGuideScriptSource, `${severity} missing from triage guide`).toContain(severity)
    }
  })

  it('builds result drafts from the ordered journey plan', () => {
    const drafts = CUSTOMER_JOURNEY_TEST_PLANS.map(buildCustomerJourneyResultDraft)

    expect(drafts).toHaveLength(CUSTOMER_JOURNEY_TEST_PLANS.length)
    expect(drafts[0]?.journeyId).toBe('player-level-up-mobile-loop')
    expect(drafts[0]?.result).toBe('needs-follow-up')

    for (const draft of drafts) {
      expect(draft.label.trim(), draft.journeyId).not.toHaveLength(0)
      expect(draft.entryRoute, draft.journeyId).toMatch(/^\//)
      expect(draft.passQuestion.trim(), draft.journeyId).not.toHaveLength(0)
      expect(draft.evidenceFields).toEqual(CUSTOMER_JOURNEY_EVIDENCE_FIELDS)
    }
  })

  it('keeps result ledger linked from closeout docs', () => {
    expect(scriptsDocSource).toContain('docs/customer-journey-test-results.md')
    expect(testWeekQuickstartSource).toContain('docs/customer-journey-test-results.md')
    expect(evidenceIndexSource).toContain('docs/customer-journey-test-results.md')
    expect(closeoutQaSource).toContain('docs/customer-journey-test-results.md')
    expect(resultsDocSource).toContain('Result Ledger')
    expect(resultsDocSource).toContain('Daily Summary')
    expect(resultsDocSource).toContain('npm run qa:control')
    expect(resultsDocSource).toContain('npm run qa:start')
    expect(resultsDocSource).toContain('npm run qa:today')
    expect(resultsDocSource).toContain('npm run qa:readiness')
    expect(resultsDocSource).toContain('npm run qa:week-dashboard')
    expect(resultsDocSource).toContain('npm run qa:week-plan')
    expect(resultsDocSource).toContain('npm run qa:tester-packet')
    expect(resultsDocSource).toContain('npm run qa:kickoff')
    expect(resultsDocSource).toContain('npm run qa:live-card')
    expect(resultsDocSource).toContain('fixture blockers point to the matching `qa:fixture-gate` command')
    expect(resultsDocSource).toContain('npm run qa:device-card')
    expect(resultsDocSource).toContain('npm run qa:device-ledger')
    expect(resultsDocSource).toContain('npm run qa:device-status')
    expect(resultsDocSource).toContain('npm run qa:evidence-index')
    expect(resultsDocSource).toContain('npm run qa:route-review')
    expect(resultsDocSource).toContain('npm run qa:fixture-board')
    expect(resultsDocSource).toContain('npm run qa:fixture-status')
    expect(resultsDocSource).toContain('npm run qa:fixture-review')
    expect(resultsDocSource).toContain('auth redirect checks')
    expect(resultsDocSource).toContain('npm run qa:access-review')
    expect(resultsDocSource).toContain('npm run qa:tier-board')
    expect(resultsDocSource).toContain('npm run qa:feature-review')
    expect(resultsDocSource).toContain('npm run qa:trace')
    expect(resultsDocSource).toContain('npm run qa:proof-gaps')
    expect(resultsDocSource).toContain('npm run qa:scorecard')
    expect(resultsDocSource).toContain('npm run qa:issue')
    expect(resultsDocSource).toContain('npm run qa:owner-board')
    expect(resultsDocSource).toContain('npm run qa:launch-board')
    expect(resultsDocSource).toContain('npm run qa:change-impact')
    expect(resultsDocSource).toContain('npm run qa:tester-handoff')
    expect(weekDashboardScriptSource).toContain('TenAceIQ Test Week Dashboard')
    expect(weekDashboardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(weekDashboardScriptSource).toContain('Dashboard rule')
  })

  it('keeps the test week quickstart aligned to ledger closeout and launch evidence', () => {
    for (const anchor of [
      'docs/customer-journey-test-results.md',
      'npm run qa:control',
      'npm run qa:today',
      'npm run qa:tester-packet',
      'npm run qa:kickoff',
      'npm run qa:fixture-board',
      'npm run qa:evidence-index',
      'npm run qa:issue',
      'npm run qa:proof-gaps',
      'npm run qa:ledger-check',
      'npm run qa:close-day',
      'npm run qa:owner-board',
      'npm run qa:tier-board',
      'npm run qa:change-impact',
      'npm run qa:tester-handoff',
      'npm run qa:scorecard',
      'npm run qa:signoff',
      'npm run qa:launch-board',
      'npm run qa:launch',
      'npm run verify:closeout',
      'npm run verify:closeout:live',
      'Any open p0 or p1 row',
      'fixture-gap',
    ]) {
      expect(testWeekQuickstartSource, `${anchor} missing from quickstart`).toContain(anchor)
    }

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(testWeekQuickstartSource, `${plan.id} missing from quickstart`).toContain(plan.id)
    }
  })

  it('keeps the evidence index aligned to ledger screenshot and video proof', () => {
    expect(packageSource).toContain('"qa:evidence-index": "node scripts/customer-journey-evidence-index.mjs"')
    expect(resultsDocSource).toContain('npm run qa:evidence-index')
    expect(testWeekQuickstartSource).toContain('npm run qa:evidence-index')
    expect(evidenceIndexSource).toContain('docs/qa-evidence')
    expect(evidenceIndexScriptSource).toContain('docs/qa-evidence')
    expect(evidenceIndexSource).toContain('Screenshot/video')
    expect(evidenceIndexScriptSource).toContain('Screenshot/video')
    expect(evidenceIndexSource).toContain('prove the journey signal')
    expect(evidenceIndexScriptSource).toContain('prove the journey signal')
    expect(evidenceIndexSource).toContain('Keep credentials')
    expect(evidenceIndexScriptSource).toContain('Keep credentials')
    expect(evidencePackScriptSource).toContain('docs/qa-evidence/README.md')
    expect(evidencePackScriptSource).toContain('qa:evidence-index')
  })

  it('keeps the issue decision guide aligned to result categories, severity, and retest action', () => {
    expect(packageSource).toContain('"qa:issue": "node scripts/customer-journey-issue-decision.mjs"')
    expect(resultsDocSource).toContain('npm run qa:issue')
    expect(issueDecisionGuideSource).toContain('docs/customer-journey-test-results.md')
    expect(issueDecisionScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(issueDecisionGuideSource).toContain('Stop wider testing')
    expect(issueDecisionScriptSource).toContain('Stop wider testing')
    expect(issueDecisionGuideSource).toContain('Ledger Row Formula')
    expect(issueDecisionScriptSource).toContain('Ledger Row Formula')
    expect(issueDecisionGuideSource).toContain('which journey proves the fix')
    expect(issueDecisionScriptSource).toContain('which journey proves the fix')

    for (const category of Object.keys(CUSTOMER_JOURNEY_ISSUE_CATEGORIES)) {
      expect(issueDecisionGuideSource, `${category} missing from issue decision guide`).toContain(category)
      expect(issueDecisionScriptSource, `${category} missing from issue decision script`).toContain(category)
    }

    for (const severity of CUSTOMER_JOURNEY_ISSUE_SEVERITIES) {
      expect(issueDecisionGuideSource, `${severity} missing from issue decision guide`).toContain(severity)
      expect(issueDecisionScriptSource, `${severity} missing from issue decision script`).toContain(severity)
    }
  })

  it('keeps the proof gap board aligned to missing evidence and blockers', () => {
    expect(packageSource).toContain('"qa:proof-gaps": "node scripts/customer-journey-proof-gaps.mjs"')
    expect(resultsDocSource).toContain('npm run qa:proof-gaps')
    expect(testWeekQuickstartSource).toContain('npm run qa:proof-gaps')
    expect(proofGapScriptSource).toContain('TenAceIQ Proof Gap Board')
    expect(proofGapScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(proofGapScriptSource).toContain('Missing pass evidence')
    expect(proofGapScriptSource).toContain('Pass rows missing screenshot/video')
    expect(proofGapScriptSource).toContain('Open p0/p1 blockers')
    expect(proofGapScriptSource).toContain('Open follow-up proof rows')
    expect(proofGapScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(proofGapScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(proofGapScriptSource).toContain('getFixtureAuthSmokeCommand')
    expect(proofGapScriptSource).toContain('Auth smoke: ${authSmokeCommand')
    expect(proofGapScriptSource).toContain('qa:kickoff')
    expect(proofGapScriptSource).toContain('qa:evidence-pack')
    expect(proofGapScriptSource).toContain('qa:ledger-check')
    expect(proofGapScriptSource).toContain('Proof gap rule')
    expect(proofGapScriptSource).toContain('customerJourneyDetails')
    expect(proofGapScriptSource).toContain('sessionByJourneyId')
    expect(proofGapScriptSource).toContain('tierAliases')
    expect(resultsDocSource).toContain('fixture-gap rows include the matching `qa:fixture-gate` command')

    expect(proofGapScriptSource).toContain('row.category')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the QA start command aligned to the first manual testing block', () => {
    expect(packageSource).toContain('"qa:start": "node scripts/customer-journey-start.mjs"')
    expect(resultsDocSource).toContain('npm run qa:start')
    expect(qaStartScriptSource).toContain('TenAceIQ QA Start')
    expect(qaStartScriptSource).toContain('qa:readiness')
    expect(qaStartScriptSource).toContain('qa:tester-packet')
    expect(qaStartScriptSource).toContain('qa:next')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })

  it('keeps mission control aligned to the compact test-week scoreboard', () => {
    expect(packageSource).toContain('"qa:control": "node scripts/customer-journey-mission-control.mjs"')
    expect(resultsDocSource).toContain('npm run qa:control')
    expect(missionControlScriptSource).toContain('TenAceIQ QA Mission Control')
    expect(missionControlScriptSource).toContain('Scoreboard')
    expect(missionControlScriptSource).toContain('Sessions')
    expect(missionControlScriptSource).toContain('Tiers')
    expect(missionControlScriptSource).toContain('qa:launch')
    expect(missionControlScriptSource).toContain('customerJourneySessions')
    expect(missionControlScriptSource).toContain('customerJourneyDetails')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })

  it('keeps the QA today command aligned to active testing-day closeout', () => {
    expect(packageSource).toContain('"qa:today": "node scripts/customer-journey-today.mjs"')
    expect(resultsDocSource).toContain('npm run qa:today')
    expect(qaTodayScriptSource).toContain('TenAceIQ Today QA Sheet')
    expect(qaTodayScriptSource).toContain('qa:tester-packet')
    expect(qaTodayScriptSource).toContain('qa:ledger-check')
    expect(qaTodayScriptSource).toContain('qa:close-day')
    expect(qaTodayScriptSource).toContain('customerJourneySessions')
    expect(qaTodayScriptSource).toContain('customerJourneyDetails')
    expect(qaTodayScriptSource).toContain('customerJourneyDeviceProfiles')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })

  it('keeps the ledger template command aligned to every planned journey', () => {
    expect(packageSource).toContain('"qa:ledger": "node scripts/customer-journey-ledger-template.mjs"')
    expect(resultsDocSource).toContain('npm run qa:ledger')
    expect(packageSource).toContain('"qa:session-ledger": "node scripts/customer-journey-session-ledger.mjs"')
    expect(resultsDocSource).toContain('npm run qa:session-ledger')
    expect(sessionLedgerScriptSource).toContain('Usage: npm run qa:session-ledger -- <day1 | day2 | day3 | day4 | day5>')
    expect(sessionLedgerScriptSource).toContain('--date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
    expect(sessionLedgerScriptSource).toContain('Defaults: date=')
    expect(sessionLedgerScriptSource).toContain('Paste these rows into docs/customer-journey-test-results.md')
    expect(ledgerTemplateScriptSource).toContain('customerJourneyDetails')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
    }
  })

  it('keeps the readiness brief aligned to packet health and ledger state', () => {
    expect(packageSource).toContain('"qa:readiness": "node scripts/customer-journey-readiness-brief.mjs"')
    expect(resultsDocSource).toContain('npm run qa:readiness')
    expect(readinessBriefScriptSource).toContain('TenAceIQ Journey Test Readiness Brief')
    expect(readinessBriefScriptSource).toContain('Packet Health')
    expect(readinessBriefScriptSource).toContain('Ledger State')
    expect(readinessBriefScriptSource).toContain('Ready to start testing')
    expect(readinessBriefScriptSource).toContain('qa:week-plan')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the route review command aligned to page-level evidence checks', () => {
    expect(packageSource).toContain('"qa:route-review": "node scripts/customer-journey-route-review.mjs"')
    expect(resultsDocSource).toContain('npm run qa:route-review')
    expect(routeReviewScriptSource).toContain('TenAceIQ Route Review')
    expect(routeReviewScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(routeReviewScriptSource).toContain('a route is not proven by loading')
    expect(routeReviewScriptSource).toContain('customerJourneyDetails')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
    }
  })

  it('keeps the live card command aligned to active manual testing', () => {
    expect(packageSource).toContain('"qa:live-card": "node scripts/customer-journey-live-card.mjs"')
    expect(resultsDocSource).toContain('npm run qa:live-card')
    expect(liveJourneyCardScriptSource).toContain('TenAceIQ Live Journey Test Card')
    expect(liveJourneyCardScriptSource).toContain('Paste-ready ledger row')
    expect(liveJourneyCardScriptSource).toContain('blocked-state commands')
    expect(liveJourneyCardScriptSource).toContain('Fixture preflight:')
    expect(liveJourneyCardScriptSource).toContain('npm run qa:fixture-auth-smoke -- --env')
    expect(liveJourneyCardScriptSource).toContain('auth smoke blocked')
    expect(liveJourneyCardScriptSource).toContain('npm run qa:fixture-gate -- ')
    expect(liveJourneyCardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(liveJourneyCardScriptSource).toContain('customerJourneyDetails')
    expect(liveJourneyCardScriptSource).toContain('sessionByJourneyId')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the kickoff command aligned to one-journey test starts', () => {
    expect(packageSource).toContain('"qa:kickoff": "node scripts/customer-journey-kickoff.mjs"')
    expect(resultsDocSource).toContain('npm run qa:kickoff')
    expect(testWeekQuickstartSource).toContain('npm run qa:kickoff')
    expect(kickoffScriptSource).toContain('TenAceIQ Journey Kickoff')
    expect(kickoffScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(kickoffScriptSource).toContain('Paste-ready ledger row')
    expect(kickoffScriptSource).toContain('qa:fixture-board')
    expect(kickoffScriptSource).toContain('qa:fixture-status')
    expect(kickoffScriptSource).toContain('qa:fixture-gate')
    expect(kickoffScriptSource).toContain('qa:fixture-auth-smoke -- --env')
    expect(kickoffScriptSource).toContain('qa:fixture-auth-smoke')
    expect(kickoffScriptSource).toContain('qa:tester-packet')
    expect(kickoffScriptSource).toContain('qa:evidence-pack')
    expect(kickoffScriptSource).toContain('qa:live-card')
    expect(kickoffScriptSource).toContain('Kickoff rule')
    expect(kickoffScriptSource).toContain('customerJourneyDetails')
    expect(kickoffScriptSource).toContain('sessionByJourneyId')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the tester packet command aligned to session and device testing', () => {
    expect(packageSource).toContain('"qa:tester-packet": "node scripts/customer-journey-tester-packet.mjs"')
    expect(resultsDocSource).toContain('npm run qa:tester-packet')
    expect(testerPacketScriptSource).toContain('TenAceIQ Tester Packet')
    expect(testerPacketScriptSource).toContain('qa:device-ledger')
    expect(testerPacketScriptSource).toContain('qa:evidence-pack')
    expect(testerPacketScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(testerPacketScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(testerPacketScriptSource).toContain('getFixtureAuthSmokeCommand')
    expect(testerPacketScriptSource).toContain('Auth smoke: ${authSmokeCommand')
    expect(testerPacketScriptSource).toContain('mobile-ux-gap')
    expect(testerPacketScriptSource).toContain('customerJourneySessions')
    expect(testerPacketScriptSource).toContain('journeyById')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the week plan command aligned to full-week device coverage', () => {
    expect(packageSource).toContain('"qa:week-dashboard": "node scripts/customer-journey-week-dashboard.mjs"')
    expect(packageSource).toContain('"qa:week-plan": "node scripts/customer-journey-week-plan.mjs"')
    expect(resultsDocSource).toContain('npm run qa:week-dashboard')
    expect(resultsDocSource).toContain('npm run qa:week-plan')
    expect(weekDashboardScriptSource).toContain('TenAceIQ Test Week Dashboard')
    expect(weekDashboardScriptSource).toContain('qa:proof-gaps')
    expect(weekDashboardScriptSource).toContain('customerJourneySessions')
    expect(weekDashboardScriptSource).toContain('customerJourneyDetails')
    expect(weekPlanScriptSource).toContain('TenAceIQ Test Week Plan')
    expect(weekPlanScriptSource).toContain('qa:tester-packet')
    expect(weekPlanScriptSource).toContain('required device pass')
    expect(weekPlanScriptSource).toContain('customerJourneySessions')
    expect(weekPlanScriptSource).toContain('customerJourneyDetails')
    expect(weekPlanScriptSource).toContain('customerJourneyDeviceProfiles')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the device card command aligned to viewport-sensitive testing', () => {
    expect(packageSource).toContain('"qa:device-card": "node scripts/customer-journey-device-card.mjs"')
    expect(resultsDocSource).toContain('npm run qa:device-card')
    expect(deviceJourneyCardScriptSource).toContain('TenAceIQ Device Journey Card')
    expect(deviceJourneyCardScriptSource).toContain('viewport-specific risk')
    expect(deviceJourneyCardScriptSource).toContain('customerJourneyDeviceProfiles')
    expect(deviceJourneyCardScriptSource).toContain('customerJourneyDetails')
    expect(qaDataScriptSource).toContain('Phone')
    expect(qaDataScriptSource).toContain('Tablet / iPad')
    expect(qaDataScriptSource).toContain('Desktop')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the device ledger command aligned to device-specific result rows', () => {
    expect(packageSource).toContain('"qa:device-ledger": "node scripts/customer-journey-device-ledger.mjs"')
    expect(resultsDocSource).toContain('npm run qa:device-ledger')
    expect(deviceLedgerScriptSource).toContain('TenAceIQ Device Ledger Rows')
    expect(deviceLedgerScriptSource).toContain('Paste these rows into docs/customer-journey-test-results.md')
    expect(deviceLedgerScriptSource).toContain('needs-follow-up')
    expect(deviceLedgerScriptSource).toContain('viewport-specific risk')
    expect(deviceLedgerScriptSource).toContain('customerJourneyDeviceProfiles')
    expect(deviceLedgerScriptSource).toContain('customerJourneyDetails')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the device status command aligned to logged device evidence', () => {
    expect(packageSource).toContain('"qa:device-status": "node scripts/customer-journey-device-status.mjs"')
    expect(resultsDocSource).toContain('npm run qa:device-status')
    expect(deviceStatusScriptSource).toContain('TenAceIQ Device Status')
    expect(deviceStatusScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(deviceStatusScriptSource).toContain('Device coverage')
    expect(deviceStatusScriptSource).toContain('device/browser value')
    expect(deviceStatusScriptSource).toContain('customerJourneyDeviceProfiles')
    expect(deviceStatusScriptSource).toContain('customerJourneyDetails')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the fixture review command aligned to fixture-gap evidence', () => {
    expect(packageSource).toContain('"qa:fixture-review": "node scripts/customer-journey-fixture-review.mjs"')
    expect(resultsDocSource).toContain('npm run qa:fixture-review')
    expect(fixtureReviewScriptSource).toContain('TenAceIQ Fixture Review')
    expect(fixtureReviewScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(fixtureReviewScriptSource).toContain('a missing fixture is a fixture-gap')
    expect(fixtureReviewScriptSource).toContain('customerJourneyDetails')
    expect(fixtureReviewScriptSource).toContain('sessionByJourneyId')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the fixture readiness board aligned to setup readiness and fixture-gap evidence', () => {
    expect(packageSource).toContain('"qa:fixture-board": "node scripts/customer-journey-fixture-board.mjs"')
    expect(resultsDocSource).toContain('npm run qa:fixture-board')
    expect(testWeekQuickstartSource).toContain('npm run qa:fixture-board')
    expect(fixtureBoardScriptSource).toContain('TenAceIQ Fixture Readiness Board')
    expect(fixtureBoardScriptSource).toContain('docs/customer-journey-test-fixtures.md')
    expect(fixtureBoardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(fixtureBoardScriptSource).toContain('account access')
    expect(fixtureBoardScriptSource).toContain('player/coach links')
    expect(fixtureBoardScriptSource).toContain('safe data fixtures')
    expect(fixtureBoardScriptSource).toContain('fixture-gap')
    expect(fixtureBoardScriptSource).toContain('Fixture board rule')
    expect(fixtureBoardScriptSource).toContain('customerJourneyDetails')
    expect(fixtureBoardScriptSource).toContain('sessionByJourneyId')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the fixture status command aligned to fixture-gap blockers and retesting', () => {
    expect(packageSource).toContain('"qa:fixture-status": "node scripts/customer-journey-fixture-status.mjs"')
    expect(resultsDocSource).toContain('npm run qa:fixture-status')
    expect(fixtureStatusScriptSource).toContain('TenAceIQ Fixture Status')
    expect(fixtureStatusScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(fixtureStatusScriptSource).toContain('fixture-gap')
    expect(fixtureStatusScriptSource).toContain('npm run qa:fixture-auth-smoke -- --env')
    expect(fixtureStatusScriptSource).toContain('npm run qa:fixture-auth-smoke')
    expect(fixtureStatusScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(fixtureStatusScriptSource).toContain('npm run qa:fixture-review -- <fixture>')
    expect(fixtureStatusScriptSource).toContain('npm run qa:retest -- <day-or-journey>')
    expect(fixtureStatusScriptSource).toContain('customerJourneySessions')
    expect(fixtureStatusScriptSource).toContain('journeyById')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the ledger check command strict enough for launch evidence', () => {
    expect(packageSource).toContain('"qa:ledger-check": "node scripts/customer-journey-ledger-check.mjs"')
    expect(resultsDocSource).toContain('npm run qa:ledger-check')
    expect(ledgerCheckScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(ledgerCheckScriptSource).toContain('Ledger check: not ready.')
    expect(ledgerCheckScriptSource).toContain('Ledger check: valid.')
    expect(ledgerCheckScriptSource).toContain('npm run qa:launch')
    expect(ledgerCheckScriptSource).toContain('Pass rows need screenshot/video evidence.')
    expect(ledgerCheckScriptSource).toContain('Non-pass rows need a concrete next action.')

    for (const status of CUSTOMER_JOURNEY_RESULT_STATUSES) {
      expect(ledgerCheckScriptSource, `${status} missing from ledger check`).toContain(status)
    }

    for (const category of Object.keys(CUSTOMER_JOURNEY_ISSUE_CATEGORIES)) {
      expect(ledgerCheckScriptSource, `${category} missing from ledger check`).toContain(category)
    }

    for (const severity of CUSTOMER_JOURNEY_ISSUE_SEVERITIES) {
      expect(ledgerCheckScriptSource, `${severity} missing from ledger check`).toContain(severity)
    }
  })

  it('keeps the result summary command aligned to every planned journey', () => {
    expect(packageSource).toContain('"qa:results": "node scripts/customer-journey-results-summary.mjs"')
    expect(resultsDocSource).toContain('npm run qa:results')
    expect(resultsSummaryScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(resultsSummaryScriptSource).toContain('Open p0/p1 rows')
    expect(resultsSummaryScriptSource).toContain('Open fixture-gap rows')
    expect(resultsSummaryScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(resultsSummaryScriptSource).toContain('getFixtureAuthSmokeCommand')
    expect(resultsSummaryScriptSource).toContain('Auth smoke: ${command}')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })

  it('keeps the next journey command aligned to ledger rows and sessions', () => {
    expect(packageSource).toContain('"qa:next": "node scripts/customer-journey-next.mjs"')
    expect(resultsDocSource).toContain('npm run qa:next')
    expect(nextJourneyScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(nextJourneyScriptSource).toContain('Fix or decide these p0/p1 items before moving wider')
    expect(nextJourneyScriptSource).toContain('npm run qa:session --')
    expect(nextJourneyScriptSource).toContain('npm run qa:fixture-gate --')
    expect(nextJourneyScriptSource).toContain('npm run qa:fixture-auth-smoke -- --env')
    expect(nextJourneyScriptSource).toContain('npm run qa:fixture-auth-smoke')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })

  it('keeps the retest plan command aligned to open rows and missing pass evidence', () => {
    expect(packageSource).toContain('"qa:retest": "node scripts/customer-journey-retest-plan.mjs"')
    expect(resultsDocSource).toContain('npm run qa:retest')
    expect(retestPlanScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(retestPlanScriptSource).toContain('Retest open rows first')
    expect(retestPlanScriptSource).toContain('Still needs pass evidence')
    expect(retestPlanScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(retestPlanScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(retestPlanScriptSource).toContain('getFixtureAuthSmokeCommand')
    expect(retestPlanScriptSource).toContain('Auth smoke: ${authSmokeCommand')
    expect(retestPlanScriptSource).toContain('npm run qa:session-ledger --')
    expect(resultsDocSource).toContain('fixture-gap retests include the matching `qa:fixture-gate` command')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })

  it('keeps owner board aligned to open ledger rows and named owner lanes', () => {
    expect(packageSource).toContain('"qa:owner-board": "node scripts/customer-journey-owner-board.mjs"')
    expect(resultsDocSource).toContain('npm run qa:owner-board')
    expect(ownerBoardScriptSource).toContain('TenAceIQ Customer Journey Owner Board')
    expect(ownerBoardScriptSource).toContain('named QA lane')
    expect(ownerBoardScriptSource).toContain('Owner load')
    expect(ownerBoardScriptSource).toContain('Journey ownership')
    expect(ownerBoardScriptSource).toContain('backup')
    expect(ownerBoardScriptSource).toContain('open p0/p1')
    expect(ownerBoardScriptSource).toContain('missing next action')
    expect(ownerBoardScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(ownerBoardScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(ownerBoardScriptSource).toContain('getFixtureAuthSmokeCommand')
    expect(ownerBoardScriptSource).toContain('Auth smoke: ${authSmokeCommand')
    expect(ownerBoardScriptSource).toContain('Owner rule')
    expect(ownerBoardScriptSource).toContain('customerJourneyDetails')
    expect(ownerBoardScriptSource).toContain('sessionByJourneyId')
    expect(resultsDocSource).toContain('fixture-gap rows point to the matching `qa:fixture-gate` command')
    expect(resultsDocSource).toContain('npm run qa:action-list -- <day1-day5 | tier | journey | route | fixture | category>')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps tier board aligned to feature pain points and proving journey evidence', () => {
    expect(packageSource).toContain('"qa:tier-board": "node scripts/customer-journey-tier-board.mjs"')
    expect(resultsDocSource).toContain('npm run qa:tier-board')
    expect(tierBoardScriptSource).toContain('TenAceIQ Tier Feature Board')
    expect(tierBoardScriptSource).toContain('docs/customer-journey-process-map.md')
    expect(tierBoardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(tierBoardScriptSource).toContain('Feature pain points')
    expect(tierBoardScriptSource).toContain('Proving journeys')
    expect(tierBoardScriptSource).toContain('Board rule')
    expect(tierBoardScriptSource).toContain('npm run qa:coverage --')
    expect(tierBoardScriptSource).toContain('customerJourneyDetails')
    expect(tierBoardScriptSource).toContain('sessionByJourneyId')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })

  it('keeps change impact aligned to stale evidence and rerun decisions', () => {
    expect(packageSource).toContain('"qa:change-impact": "node scripts/customer-journey-change-impact.mjs"')
    expect(resultsDocSource).toContain('npm run qa:change-impact')
    expect(changeImpactScriptSource).toContain('TenAceIQ Change Impact Review')
    expect(changeImpactScriptSource).toContain('before trusting older pass evidence')
    expect(changeImpactScriptSource).toContain('Product-affecting files')
    expect(changeImpactScriptSource).toContain('Impacted journeys')
    expect(changeImpactScriptSource).toContain('Session rerun queue')
    expect(changeImpactScriptSource).toContain('npm run qa:retest -- <day-or-journey>')
    expect(changeImpactScriptSource).toContain('fresh pass evidence')
    expect(changeImpactScriptSource).toContain('journeyById')
    expect(changeImpactScriptSource).toContain('sessionByJourneyId')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps tester handoff aligned to open rows, evidence, and retest commands', () => {
    expect(packageSource).toContain('"qa:tester-handoff": "node scripts/customer-journey-tester-handoff.mjs"')
    expect(resultsDocSource).toContain('npm run qa:tester-handoff')
    expect(resultsDocSource).toContain('fixture-gap rows include the matching `qa:fixture-gate` command')
    expect(testerHandoffScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(testerHandoffScriptSource).toContain('Carry forward')
    expect(testerHandoffScriptSource).toContain('Open p0/p1')
    expect(testerHandoffScriptSource).toContain('missing screenshot/video')
    expect(testerHandoffScriptSource).toContain('fixture-gap blockers')
    expect(testerHandoffScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(testerHandoffScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(testerHandoffScriptSource).toContain('getFixtureAuthSmokeCommand')
    expect(testerHandoffScriptSource).toContain('Auth smoke: ${authSmokeCommand')
    expect(testerHandoffScriptSource).toContain('npm run qa:retest -- <day-or-journey>')
    expect(testerHandoffScriptSource).toContain('Handoff rule')
    expect(testerHandoffScriptSource).toContain('customerJourneySessions')
    expect(testerHandoffScriptSource).toContain('customerJourneyDetails')

    expect(actionListScriptSource).toContain('sessionByJourneyId')
    expect(actionListScriptSource).toContain('journeyById')
    expect(actionListScriptSource).toContain('tierAliases')
    expect(actionListScriptSource).toContain('Tier:')
    expect(actionListScriptSource).toContain('Session:')
    expect(actionListScriptSource).toContain('if (tierQuery)')
    expect(actionListScriptSource).toContain('aliases.includes(normalizedQuery)')
    expect(qaDataScriptSource).toContain('Full-Court')
    expect(qaDataScriptSource).toContain('day1')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
      expect(qaDataScriptSource, `${plan.personaFixture} missing from shared QA data`).toContain(plan.personaFixture)
    }
  })

  it('keeps the access review command aligned to access and gating result categories', () => {
    expect(packageSource).toContain('"qa:access-review": "node scripts/customer-journey-access-review.mjs"')
    expect(resultsDocSource).toContain('npm run qa:access-review')
    expect(accessReviewScriptSource).toContain('TenAceIQ Tier Access Review')
    expect(accessReviewScriptSource).toContain('protected-control')
    expect(accessReviewScriptSource).toContain('access-gap')
    expect(accessReviewScriptSource).toContain('gating-gap')

    for (const category of ['access-gap', 'gating-gap', 'fixture-gap']) {
      expect(resultsDocSource, `${category} missing from access review guidance`).toContain(category)
    }
  })

  it('keeps the feature review command aligned to feature-specific closeout evidence', () => {
    expect(packageSource).toContain('"qa:feature-review": "node scripts/customer-journey-feature-review.mjs"')
    expect(resultsDocSource).toContain('npm run qa:feature-review')
    expect(featureReviewScriptSource).toContain('TenAceIQ Feature Review')
    expect(featureReviewScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(featureReviewScriptSource).toContain('Closeout rule: a feature is not ready')
    expect(featureReviewScriptSource).toContain('customerJourneyDetails')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })

  it('keeps the traceability command aligned to tier promises and ledger evidence', () => {
    expect(packageSource).toContain('"qa:trace": "node scripts/customer-journey-traceability.mjs"')
    expect(resultsDocSource).toContain('npm run qa:trace')
    expect(traceabilityScriptSource).toContain('TenAceIQ Journey Traceability Map')
    expect(traceabilityScriptSource).toContain('lib/customer-journey-flow-map.json')
    expect(traceabilityScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(traceabilityScriptSource).toContain('Closeout rule: every tier promise')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(traceabilityScriptSource, `${plan.id} missing from traceability`).toContain(plan.id)
    }
  })

  it('keeps the scorecard command aligned to ledger rows and journey evidence', () => {
    expect(packageSource).toContain('"qa:scorecard": "node scripts/customer-journey-scorecard.mjs"')
    expect(resultsDocSource).toContain('npm run qa:scorecard')
    expect(scorecardScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(scorecardScriptSource).toContain('TenAceIQ Customer Journey Scorecard')
    expect(scorecardScriptSource).toContain('fixture blocked')
    expect(scorecardScriptSource).toContain('npm run qa:fixture-gate --')
    expect(scorecardScriptSource).toContain('npm run qa:fixture-auth-smoke -- --env')
    expect(scorecardScriptSource).toContain('getFixtureAuthSmokeCommand')
    expect(scorecardScriptSource).toContain('authSmokeCommand')
    expect(scorecardScriptSource).toContain('Closeout rule: use the scorecard')
    expect(scorecardScriptSource).toContain('customerJourneyDetails')
    expect(scorecardScriptSource).toContain('sessionByJourneyId')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })

  it('keeps the launch blocker board aligned to blocker categories and evidence gaps', () => {
    expect(packageSource).toContain('"qa:launch-board": "node scripts/customer-journey-launch-board.mjs"')
    expect(resultsDocSource).toContain('npm run qa:launch-board')
    expect(launchBoardScriptSource).toContain('TenAceIQ Launch Blocker Board')
    expect(launchBoardScriptSource).toContain('Product launch blockers')
    expect(launchBoardScriptSource).toContain('Fixture/test blockers')
    expect(launchBoardScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(launchBoardScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(launchBoardScriptSource).toContain('getFixtureAuthSmokeCommand')
    expect(launchBoardScriptSource).toContain('Auth smoke: ${authSmokeCommand')
    expect(launchBoardScriptSource).toContain('Quality follow-ups')
    expect(launchBoardScriptSource).toContain('Missing pass evidence')
    expect(launchBoardScriptSource).toContain('Pass rows missing screenshot/video')
    expect(launchBoardScriptSource).toContain('Launch board rule')
    expect(launchBoardScriptSource).toContain('customerJourneyDetails')
    expect(launchBoardScriptSource).toContain('sessionByJourneyId')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
      expect(qaDataScriptSource, `${plan.entryRoute} missing from shared QA data`).toContain(plan.entryRoute)
    }
  })

  it('keeps the launch readiness command strict and aligned to every planned journey', () => {
    expect(packageSource).toContain('"qa:launch": "node scripts/customer-journey-launch-readiness.mjs"')
    expect(resultsDocSource).toContain('npm run qa:launch')
    expect(launchReadinessScriptSource).toContain('Launch readiness: not ready.')
    expect(launchReadinessScriptSource).toContain('Fixture gate: npm run qa:fixture-gate --')
    expect(launchReadinessScriptSource).toContain('Auth env: npm run qa:fixture-auth-smoke -- --env')
    expect(launchReadinessScriptSource).toContain('getFixtureAuthSmokeCommand')
    expect(launchReadinessScriptSource).toContain('Auth smoke: ${authSmokeCommand')
    expect(launchReadinessScriptSource).toContain('process.exit(1)')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaDataScriptSource, `${plan.id} missing from shared QA data`).toContain(plan.id)
    }
  })
})
