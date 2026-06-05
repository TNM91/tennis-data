const categories = [
  {
    id: 'sync-gap',
    useWhen: 'UI implies account, coach, or cross-device sync but the signal only exists locally.',
    closeoutAction: 'Clarify the UI language or connect the workflow to backend sync before launch.',
  },
  {
    id: 'access-gap',
    useWhen: 'A user with the correct tier sees a lock, redirect, or missing workspace.',
    closeoutAction: 'Fix entitlement checks, access model mapping, or protected-route behavior.',
  },
  {
    id: 'gating-gap',
    useWhen: 'A user without the required tier can use paid controls or protected workflows.',
    closeoutAction: 'Fix route/component gating and verify the lower-tier state again.',
  },
  {
    id: 'fixture-gap',
    useWhen: 'The test cannot run because the account, linked state, or safe data fixture is missing.',
    closeoutAction: 'Create the fixture and rerun the journey before marking product status.',
  },
  {
    id: 'data-propagation-gap',
    useWhen: 'A saved result, access change, assignment, or import does not appear in the expected surface.',
    closeoutAction: 'Trace source-of-truth, API, cache, and UI refresh behavior.',
  },
  {
    id: 'mobile-ux-gap',
    useWhen: 'The journey works technically but takes too much scrolling, has awkward tap targets, or hides the next action.',
    closeoutAction: 'Simplify the mobile step, collapse prior context, and retest phone viewport.',
  },
  {
    id: 'content-quality-gap',
    useWhen: 'The copy, drill, planner, or recommendation feels generic or does not help a tennis user act.',
    closeoutAction: 'Rewrite toward a specific tennis behavior, proof signal, and next rep.',
  },
  {
    id: 'return-state-gap',
    useWhen: 'The user comes back later and cannot tell what happened, what changed, or what to do next.',
    closeoutAction: 'Pull recent activity, status, and next action forward on the relevant workspace.',
  },
  {
    id: 'visual-polish',
    useWhen: 'Spacing, alignment, wrapping, or visual hierarchy makes an otherwise working feature feel rough.',
    closeoutAction: 'Fix layout and rerun browser/viewport smoke if the issue affects usability.',
  },
  {
    id: 'product-logic',
    useWhen: 'The workflow solves the wrong job, creates tier confusion, or asks the user to do unnecessary work.',
    closeoutAction: 'Rework the flow against the customer journey pain point before polishing UI.',
  },
]

const severities = [
  ['p0', 'Blocks launch or risks wrong access/data visibility.'],
  ['p1', 'Breaks a core paid journey or trust loop.'],
  ['p2', 'Important usability/content issue that should be fixed before broad testing ends.'],
  ['p3', 'Polish or follow-up improvement that does not block the journey.'],
]

console.log('TenAceIQ Customer Journey Issue Triage Guide')
console.log('')
console.log('Use this while filling Category, Severity, Notes, and Next action in docs/customer-journey-test-results.md.')
console.log('')

console.log('Categories:')
for (const category of categories) {
  console.log(`- ${category.id}`)
  console.log(`  Use when: ${category.useWhen}`)
  console.log(`  Closeout action: ${category.closeoutAction}`)
}

console.log('')
console.log('Severity:')
for (const [severity, meaning] of severities) {
  console.log(`- ${severity}: ${meaning}`)
}

console.log('')
console.log('Triage rules:')
console.log('- p0/p1 needs a fix or explicit launch decision before qa:launch can pass.')
console.log('- fixture-gap is blocked, not product pass.')
console.log('- sync-gap, access-gap, gating-gap, and data-propagation-gap are product logic until proven otherwise.')
console.log('- content-quality-gap should be fixed against the tennis behavior, proof signal, and next action.')
