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
const weekPlanScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-week-plan.mjs'), 'utf8')
const testerPacketScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-tester-packet.mjs'), 'utf8')
const liveJourneyCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-live-card.mjs'), 'utf8')
const deviceJourneyCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-card.mjs'), 'utf8')
const deviceLedgerScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-ledger.mjs'), 'utf8')
const deviceStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-status.mjs'), 'utf8')
const evidencePackScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-evidence-pack.mjs'), 'utf8')
const routeReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-route-review.mjs'), 'utf8')
const fixtureStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-status.mjs'), 'utf8')
const fixtureReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-review.mjs'), 'utf8')
const ledgerCheckScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-ledger-check.mjs'), 'utf8')
const resultsSummaryScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-results-summary.mjs'), 'utf8')
const nextJourneyScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-next.mjs'), 'utf8')
const retestPlanScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-retest-plan.mjs'), 'utf8')
const accessReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-access-review.mjs'), 'utf8')
const featureReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-feature-review.mjs'), 'utf8')
const traceabilityScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-traceability.mjs'), 'utf8')
const scorecardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-scorecard.mjs'), 'utf8')
const launchReadinessScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-launch-readiness.mjs'), 'utf8')
const triageGuideScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-triage-guide.mjs'), 'utf8')
const issueDecisionScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-issue-decision.mjs'), 'utf8')
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
    expect(resultsDocSource).toContain('npm run qa:week-plan')
    expect(resultsDocSource).toContain('npm run qa:tester-packet')
    expect(resultsDocSource).toContain('npm run qa:live-card')
    expect(resultsDocSource).toContain('npm run qa:device-card')
    expect(resultsDocSource).toContain('npm run qa:device-ledger')
    expect(resultsDocSource).toContain('npm run qa:device-status')
    expect(resultsDocSource).toContain('npm run qa:evidence-index')
    expect(resultsDocSource).toContain('npm run qa:route-review')
    expect(resultsDocSource).toContain('npm run qa:fixture-status')
    expect(resultsDocSource).toContain('npm run qa:fixture-review')
    expect(resultsDocSource).toContain('npm run qa:access-review')
    expect(resultsDocSource).toContain('npm run qa:feature-review')
    expect(resultsDocSource).toContain('npm run qa:trace')
    expect(resultsDocSource).toContain('npm run qa:scorecard')
    expect(resultsDocSource).toContain('npm run qa:issue')
  })

  it('keeps the test week quickstart aligned to ledger closeout and launch evidence', () => {
    for (const anchor of [
      'docs/customer-journey-test-results.md',
      'npm run qa:control',
      'npm run qa:today',
      'npm run qa:tester-packet',
      'npm run qa:evidence-index',
      'npm run qa:issue',
      'npm run qa:ledger-check',
      'npm run qa:close-day',
      'npm run qa:scorecard',
      'npm run qa:signoff',
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

  it('keeps the QA start command aligned to the first manual testing block', () => {
    expect(packageSource).toContain('"qa:start": "node scripts/customer-journey-start.mjs"')
    expect(resultsDocSource).toContain('npm run qa:start')
    expect(qaStartScriptSource).toContain('TenAceIQ QA Start')
    expect(qaStartScriptSource).toContain('qa:readiness')
    expect(qaStartScriptSource).toContain('qa:tester-packet')
    expect(qaStartScriptSource).toContain('qa:next')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaStartScriptSource, `${plan.id} missing from QA start`).toContain(plan.id)
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

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(missionControlScriptSource, `${plan.id} missing from mission control`).toContain(plan.id)
    }
  })

  it('keeps the QA today command aligned to active testing-day closeout', () => {
    expect(packageSource).toContain('"qa:today": "node scripts/customer-journey-today.mjs"')
    expect(resultsDocSource).toContain('npm run qa:today')
    expect(qaTodayScriptSource).toContain('TenAceIQ Today QA Sheet')
    expect(qaTodayScriptSource).toContain('qa:tester-packet')
    expect(qaTodayScriptSource).toContain('qa:ledger-check')
    expect(qaTodayScriptSource).toContain('qa:close-day')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(qaTodayScriptSource, `${plan.id} missing from QA today`).toContain(plan.id)
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

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(ledgerTemplateScriptSource, `${plan.id} missing from ledger template script`).toContain(plan.id)
      expect(ledgerTemplateScriptSource, `${plan.entryRoute} missing from ledger template script`).toContain(plan.entryRoute)
      expect(sessionLedgerScriptSource, `${plan.id} missing from session ledger script`).toContain(plan.id)
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
      expect(readinessBriefScriptSource, `${plan.id} missing from readiness brief`).toContain(plan.id)
      expect(readinessBriefScriptSource, `${plan.entryRoute} missing from readiness brief`).toContain(plan.entryRoute)
      expect(readinessBriefScriptSource, `${plan.personaFixture} missing from readiness brief`).toContain(plan.personaFixture)
    }
  })

  it('keeps the route review command aligned to page-level evidence checks', () => {
    expect(packageSource).toContain('"qa:route-review": "node scripts/customer-journey-route-review.mjs"')
    expect(resultsDocSource).toContain('npm run qa:route-review')
    expect(routeReviewScriptSource).toContain('TenAceIQ Route Review')
    expect(routeReviewScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(routeReviewScriptSource).toContain('a route is not proven by loading')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(routeReviewScriptSource, `${plan.id} missing from route review`).toContain(plan.id)
      expect(routeReviewScriptSource, `${plan.entryRoute} missing from route review`).toContain(plan.entryRoute)
    }
  })

  it('keeps the live card command aligned to active manual testing', () => {
    expect(packageSource).toContain('"qa:live-card": "node scripts/customer-journey-live-card.mjs"')
    expect(resultsDocSource).toContain('npm run qa:live-card')
    expect(liveJourneyCardScriptSource).toContain('TenAceIQ Live Journey Test Card')
    expect(liveJourneyCardScriptSource).toContain('Paste-ready ledger row')
    expect(liveJourneyCardScriptSource).toContain('blocked-state commands')
    expect(liveJourneyCardScriptSource).toContain('docs/customer-journey-test-results.md')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(liveJourneyCardScriptSource, `${plan.id} missing from live card`).toContain(plan.id)
      expect(liveJourneyCardScriptSource, `${plan.entryRoute} missing from live card`).toContain(plan.entryRoute)
      expect(liveJourneyCardScriptSource, `${plan.personaFixture} missing from live card`).toContain(plan.personaFixture)
    }
  })

  it('keeps the tester packet command aligned to session and device testing', () => {
    expect(packageSource).toContain('"qa:tester-packet": "node scripts/customer-journey-tester-packet.mjs"')
    expect(resultsDocSource).toContain('npm run qa:tester-packet')
    expect(testerPacketScriptSource).toContain('TenAceIQ Tester Packet')
    expect(testerPacketScriptSource).toContain('qa:device-ledger')
    expect(testerPacketScriptSource).toContain('qa:evidence-pack')
    expect(testerPacketScriptSource).toContain('mobile-ux-gap')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(testerPacketScriptSource, `${plan.id} missing from tester packet`).toContain(plan.id)
      expect(testerPacketScriptSource, `${plan.entryRoute} missing from tester packet`).toContain(plan.entryRoute)
      expect(testerPacketScriptSource, `${plan.personaFixture} missing from tester packet`).toContain(plan.personaFixture)
    }
  })

  it('keeps the week plan command aligned to full-week device coverage', () => {
    expect(packageSource).toContain('"qa:week-plan": "node scripts/customer-journey-week-plan.mjs"')
    expect(resultsDocSource).toContain('npm run qa:week-plan')
    expect(weekPlanScriptSource).toContain('TenAceIQ Test Week Plan')
    expect(weekPlanScriptSource).toContain('qa:tester-packet')
    expect(weekPlanScriptSource).toContain('required device pass')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(weekPlanScriptSource, `${plan.id} missing from week plan`).toContain(plan.id)
      expect(weekPlanScriptSource, `${plan.entryRoute} missing from week plan`).toContain(plan.entryRoute)
      expect(weekPlanScriptSource, `${plan.personaFixture} missing from week plan`).toContain(plan.personaFixture)
    }
  })

  it('keeps the device card command aligned to viewport-sensitive testing', () => {
    expect(packageSource).toContain('"qa:device-card": "node scripts/customer-journey-device-card.mjs"')
    expect(resultsDocSource).toContain('npm run qa:device-card')
    expect(deviceJourneyCardScriptSource).toContain('TenAceIQ Device Journey Card')
    expect(deviceJourneyCardScriptSource).toContain('viewport-specific risk')
    expect(deviceJourneyCardScriptSource).toContain('Phone')
    expect(deviceJourneyCardScriptSource).toContain('Tablet / iPad')
    expect(deviceJourneyCardScriptSource).toContain('Desktop')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(deviceJourneyCardScriptSource, `${plan.id} missing from device card`).toContain(plan.id)
      expect(deviceJourneyCardScriptSource, `${plan.entryRoute} missing from device card`).toContain(plan.entryRoute)
      expect(deviceJourneyCardScriptSource, `${plan.personaFixture} missing from device card`).toContain(plan.personaFixture)
    }
  })

  it('keeps the device ledger command aligned to device-specific result rows', () => {
    expect(packageSource).toContain('"qa:device-ledger": "node scripts/customer-journey-device-ledger.mjs"')
    expect(resultsDocSource).toContain('npm run qa:device-ledger')
    expect(deviceLedgerScriptSource).toContain('TenAceIQ Device Ledger Rows')
    expect(deviceLedgerScriptSource).toContain('Paste these rows into docs/customer-journey-test-results.md')
    expect(deviceLedgerScriptSource).toContain('needs-follow-up')
    expect(deviceLedgerScriptSource).toContain('viewport-specific risk')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(deviceLedgerScriptSource, `${plan.id} missing from device ledger`).toContain(plan.id)
      expect(deviceLedgerScriptSource, `${plan.entryRoute} missing from device ledger`).toContain(plan.entryRoute)
      expect(deviceLedgerScriptSource, `${plan.personaFixture} missing from device ledger`).toContain(plan.personaFixture)
    }
  })

  it('keeps the device status command aligned to logged device evidence', () => {
    expect(packageSource).toContain('"qa:device-status": "node scripts/customer-journey-device-status.mjs"')
    expect(resultsDocSource).toContain('npm run qa:device-status')
    expect(deviceStatusScriptSource).toContain('TenAceIQ Device Status')
    expect(deviceStatusScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(deviceStatusScriptSource).toContain('Device coverage')
    expect(deviceStatusScriptSource).toContain('device/browser value')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(deviceStatusScriptSource, `${plan.id} missing from device status`).toContain(plan.id)
      expect(deviceStatusScriptSource, `${plan.entryRoute} missing from device status`).toContain(plan.entryRoute)
      expect(deviceStatusScriptSource, `${plan.personaFixture} missing from device status`).toContain(plan.personaFixture)
    }
  })

  it('keeps the fixture review command aligned to fixture-gap evidence', () => {
    expect(packageSource).toContain('"qa:fixture-review": "node scripts/customer-journey-fixture-review.mjs"')
    expect(resultsDocSource).toContain('npm run qa:fixture-review')
    expect(fixtureReviewScriptSource).toContain('TenAceIQ Fixture Review')
    expect(fixtureReviewScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(fixtureReviewScriptSource).toContain('a missing fixture is a fixture-gap')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(fixtureReviewScriptSource, `${plan.id} missing from fixture review`).toContain(plan.id)
      expect(fixtureReviewScriptSource, `${plan.entryRoute} missing from fixture review`).toContain(plan.entryRoute)
      expect(fixtureReviewScriptSource, `${plan.personaFixture} missing from fixture review`).toContain(plan.personaFixture)
    }
  })

  it('keeps the fixture status command aligned to fixture-gap blockers and retesting', () => {
    expect(packageSource).toContain('"qa:fixture-status": "node scripts/customer-journey-fixture-status.mjs"')
    expect(resultsDocSource).toContain('npm run qa:fixture-status')
    expect(fixtureStatusScriptSource).toContain('TenAceIQ Fixture Status')
    expect(fixtureStatusScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(fixtureStatusScriptSource).toContain('fixture-gap')
    expect(fixtureStatusScriptSource).toContain('npm run qa:fixture-review -- <fixture>')
    expect(fixtureStatusScriptSource).toContain('npm run qa:retest -- <day-or-journey>')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(fixtureStatusScriptSource, `${plan.id} missing from fixture status`).toContain(plan.id)
      expect(fixtureStatusScriptSource, `${plan.entryRoute} missing from fixture status`).toContain(plan.entryRoute)
      expect(fixtureStatusScriptSource, `${plan.personaFixture} missing from fixture status`).toContain(plan.personaFixture)
    }
  })

  it('keeps the ledger check command strict enough for launch evidence', () => {
    expect(packageSource).toContain('"qa:ledger-check": "node scripts/customer-journey-ledger-check.mjs"')
    expect(resultsDocSource).toContain('npm run qa:ledger-check')
    expect(ledgerCheckScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(ledgerCheckScriptSource).toContain('Ledger check: not ready.')
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

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(resultsSummaryScriptSource, `${plan.id} missing from result summary script`).toContain(plan.id)
    }
  })

  it('keeps the next journey command aligned to ledger rows and sessions', () => {
    expect(packageSource).toContain('"qa:next": "node scripts/customer-journey-next.mjs"')
    expect(resultsDocSource).toContain('npm run qa:next')
    expect(nextJourneyScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(nextJourneyScriptSource).toContain('Fix or decide these p0/p1 items before moving wider')
    expect(nextJourneyScriptSource).toContain('npm run qa:session --')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(nextJourneyScriptSource, `${plan.id} missing from next journey script`).toContain(plan.id)
    }
  })

  it('keeps the retest plan command aligned to open rows and missing pass evidence', () => {
    expect(packageSource).toContain('"qa:retest": "node scripts/customer-journey-retest-plan.mjs"')
    expect(resultsDocSource).toContain('npm run qa:retest')
    expect(retestPlanScriptSource).toContain('docs/customer-journey-test-results.md')
    expect(retestPlanScriptSource).toContain('Retest open rows first')
    expect(retestPlanScriptSource).toContain('Still needs pass evidence')
    expect(retestPlanScriptSource).toContain('npm run qa:session-ledger --')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(retestPlanScriptSource, `${plan.id} missing from retest plan script`).toContain(plan.id)
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

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(featureReviewScriptSource, `${plan.id} missing from feature review`).toContain(plan.id)
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
    expect(scorecardScriptSource).toContain('Closeout rule: use the scorecard')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(scorecardScriptSource, `${plan.id} missing from scorecard`).toContain(plan.id)
    }
  })

  it('keeps the launch readiness command strict and aligned to every planned journey', () => {
    expect(packageSource).toContain('"qa:launch": "node scripts/customer-journey-launch-readiness.mjs"')
    expect(resultsDocSource).toContain('npm run qa:launch')
    expect(launchReadinessScriptSource).toContain('Launch readiness: not ready.')
    expect(launchReadinessScriptSource).toContain('process.exit(1)')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(launchReadinessScriptSource, `${plan.id} missing from launch readiness script`).toContain(plan.id)
    }
  })
})
