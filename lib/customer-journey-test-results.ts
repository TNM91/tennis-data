import type { CustomerJourneyTestPlan } from './customer-journey-test-plan'

export type CustomerJourneyResultStatus = 'pass' | 'fail' | 'blocked' | 'needs-follow-up'

export type CustomerJourneyIssueCategory =
  | 'sync-gap'
  | 'access-gap'
  | 'gating-gap'
  | 'fixture-gap'
  | 'data-propagation-gap'
  | 'mobile-ux-gap'
  | 'content-quality-gap'
  | 'return-state-gap'
  | 'visual-polish'
  | 'product-logic'

export type CustomerJourneyIssueSeverity = 'p0' | 'p1' | 'p2' | 'p3'

export type CustomerJourneyEvidenceField =
  | 'date'
  | 'tester'
  | 'deviceBrowser'
  | 'accountFixture'
  | 'journeyId'
  | 'entryRoute'
  | 'result'
  | 'issueCategory'
  | 'severity'
  | 'screenshotOrVideo'
  | 'notes'
  | 'nextAction'

export type CustomerJourneyResultDraft = {
  journeyId: string
  label: string
  entryRoute: string
  result: CustomerJourneyResultStatus
  issueCategory?: CustomerJourneyIssueCategory
  severity?: CustomerJourneyIssueSeverity
  evidenceFields: CustomerJourneyEvidenceField[]
  passQuestion: string
}

export const CUSTOMER_JOURNEY_RESULT_STATUSES: CustomerJourneyResultStatus[] = ['pass', 'fail', 'blocked', 'needs-follow-up']

export const CUSTOMER_JOURNEY_ISSUE_CATEGORIES: Record<
  CustomerJourneyIssueCategory,
  {
    label: string
    useWhen: string
    closeoutAction: string
  }
> = {
  'sync-gap': {
    label: 'Sync gap',
    useWhen: 'The UI implies account, coach, or cross-device sync but the signal only exists locally.',
    closeoutAction: 'Clarify the UI language or connect the workflow to backend sync before launch.',
  },
  'access-gap': {
    label: 'Access gap',
    useWhen: 'A user with the correct tier sees a lock, redirect, or missing workspace.',
    closeoutAction: 'Fix entitlement checks, access model mapping, or protected-route behavior.',
  },
  'gating-gap': {
    label: 'Gating gap',
    useWhen: 'A user without the required tier can use paid controls or protected workflows.',
    closeoutAction: 'Fix route/component gating and verify the lower-tier state again.',
  },
  'fixture-gap': {
    label: 'Fixture gap',
    useWhen: 'The test cannot run because the account, linked state, or safe data fixture is missing.',
    closeoutAction: 'Create the fixture and rerun the journey before marking product status.',
  },
  'data-propagation-gap': {
    label: 'Data propagation gap',
    useWhen: 'A saved result, access change, assignment, or import does not appear in the expected surface.',
    closeoutAction: 'Trace source-of-truth, API, cache, and UI refresh behavior.',
  },
  'mobile-ux-gap': {
    label: 'Mobile UX gap',
    useWhen: 'The journey works technically but takes too much scrolling, has awkward tap targets, or hides the next action.',
    closeoutAction: 'Simplify the mobile step, collapse prior context, and retest phone viewport.',
  },
  'content-quality-gap': {
    label: 'Content quality gap',
    useWhen: 'The copy, drill, planner, or recommendation feels generic or does not help a tennis user act.',
    closeoutAction: 'Rewrite toward a specific tennis behavior, proof signal, and next rep.',
  },
  'return-state-gap': {
    label: 'Return state gap',
    useWhen: 'The user comes back later and cannot tell what happened, what changed, or what to do next.',
    closeoutAction: 'Pull recent activity, status, and next action forward on the relevant workspace.',
  },
  'visual-polish': {
    label: 'Visual polish',
    useWhen: 'Spacing, alignment, wrapping, or visual hierarchy makes an otherwise working feature feel rough.',
    closeoutAction: 'Fix layout and rerun browser/viewport smoke if the issue affects usability.',
  },
  'product-logic': {
    label: 'Product logic',
    useWhen: 'The workflow solves the wrong job, creates tier confusion, or asks the user to do unnecessary work.',
    closeoutAction: 'Rework the flow against the customer journey pain point before polishing UI.',
  },
}

export const CUSTOMER_JOURNEY_EVIDENCE_FIELDS: CustomerJourneyEvidenceField[] = [
  'date',
  'tester',
  'deviceBrowser',
  'accountFixture',
  'journeyId',
  'entryRoute',
  'result',
  'issueCategory',
  'severity',
  'screenshotOrVideo',
  'notes',
  'nextAction',
]

export function buildCustomerJourneyResultDraft(plan: CustomerJourneyTestPlan): CustomerJourneyResultDraft {
  return {
    journeyId: plan.id,
    label: plan.label,
    entryRoute: plan.entryRoute,
    result: 'needs-follow-up',
    evidenceFields: CUSTOMER_JOURNEY_EVIDENCE_FIELDS,
    passQuestion: plan.primaryQuestion,
  }
}

export function getCustomerJourneyIssueCategory(category: CustomerJourneyIssueCategory) {
  return CUSTOMER_JOURNEY_ISSUE_CATEGORIES[category]
}
