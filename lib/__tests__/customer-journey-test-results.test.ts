import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_JOURNEY_TEST_PLANS } from '../customer-journey-test-plan'
import {
  CUSTOMER_JOURNEY_EVIDENCE_FIELDS,
  CUSTOMER_JOURNEY_ISSUE_CATEGORIES,
  CUSTOMER_JOURNEY_RESULT_STATUSES,
  buildCustomerJourneyResultDraft,
  getCustomerJourneyIssueCategory,
  type CustomerJourneyIssueCategory,
} from '../customer-journey-test-results'

const resultsDocSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-results.md'), 'utf8')
const scriptsDocSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-scripts.md'), 'utf8')
const closeoutQaSource = readFileSync(join(process.cwd(), 'docs/platform-closeout-qa.md'), 'utf8')

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
})
