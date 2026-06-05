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
const closeoutQaSource = readFileSync(join(process.cwd(), 'docs/platform-closeout-qa.md'), 'utf8')
const ledgerTemplateScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-ledger-template.mjs'), 'utf8')
const sessionLedgerScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-session-ledger.mjs'), 'utf8')
const liveJourneyCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-live-card.mjs'), 'utf8')
const deviceJourneyCardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-card.mjs'), 'utf8')
const deviceStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-device-status.mjs'), 'utf8')
const routeReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-route-review.mjs'), 'utf8')
const fixtureReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-review.mjs'), 'utf8')
const ledgerCheckScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-ledger-check.mjs'), 'utf8')
const resultsSummaryScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-results-summary.mjs'), 'utf8')
const nextJourneyScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-next.mjs'), 'utf8')
const retestPlanScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-retest-plan.mjs'), 'utf8')
const accessReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-access-review.mjs'), 'utf8')
const featureReviewScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-feature-review.mjs'), 'utf8')
const scorecardScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-scorecard.mjs'), 'utf8')
const launchReadinessScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-launch-readiness.mjs'), 'utf8')
const triageGuideScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-triage-guide.mjs'), 'utf8')
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
    expect(closeoutQaSource).toContain('docs/customer-journey-test-results.md')
    expect(resultsDocSource).toContain('Result Ledger')
    expect(resultsDocSource).toContain('Daily Summary')
    expect(resultsDocSource).toContain('npm run qa:live-card')
    expect(resultsDocSource).toContain('npm run qa:device-card')
    expect(resultsDocSource).toContain('npm run qa:device-status')
    expect(resultsDocSource).toContain('npm run qa:route-review')
    expect(resultsDocSource).toContain('npm run qa:fixture-review')
    expect(resultsDocSource).toContain('npm run qa:access-review')
    expect(resultsDocSource).toContain('npm run qa:feature-review')
    expect(resultsDocSource).toContain('npm run qa:scorecard')
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
