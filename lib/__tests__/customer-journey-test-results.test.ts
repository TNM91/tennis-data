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
const resultsSummaryScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-results-summary.mjs'), 'utf8')
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
  })

  it('keeps the ledger template command aligned to every planned journey', () => {
    expect(packageSource).toContain('"qa:ledger": "node scripts/customer-journey-ledger-template.mjs"')
    expect(resultsDocSource).toContain('npm run qa:ledger')

    for (const plan of CUSTOMER_JOURNEY_TEST_PLANS) {
      expect(ledgerTemplateScriptSource, `${plan.id} missing from ledger template script`).toContain(plan.id)
      expect(ledgerTemplateScriptSource, `${plan.entryRoute} missing from ledger template script`).toContain(plan.entryRoute)
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
