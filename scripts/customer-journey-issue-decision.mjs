const rows = [
  {
    when: 'Fixture, linked state, or safe data is missing.',
    result: 'blocked',
    category: 'fixture-gap',
    severity: 'p2 unless access/data risk is present',
    action: 'Create or repair the fixture, then rerun the same journey.',
  },
  {
    when: 'Correct-tier user cannot reach the promised workspace or control.',
    result: 'fail',
    category: 'access-gap',
    severity: 'p0 or p1',
    action: 'Fix entitlement/access mapping and retest the tier journey.',
  },
  {
    when: 'Lower-tier user can use paid or protected controls.',
    result: 'fail',
    category: 'gating-gap',
    severity: 'p0',
    action: 'Fix gating and retest both lower-tier and correct-tier states.',
  },
  {
    when: 'Assignment, proof, result, or access change does not appear where expected.',
    result: 'fail',
    category: 'data-propagation-gap',
    severity: 'p1',
    action: 'Trace source of truth, refresh behavior, cache, and destination surface.',
  },
  {
    when: 'UI implies sync but the value only exists locally.',
    result: 'needs-follow-up or fail',
    category: 'sync-gap',
    severity: 'p1 for coach/player or access flows, otherwise p2',
    action: 'Clarify the UI or connect real sync, then retest the handoff.',
  },
  {
    when: 'Phone flow works but the next action is hidden by scrolling or hierarchy.',
    result: 'needs-follow-up',
    category: 'mobile-ux-gap',
    severity: 'p1 for Level Up mobile, otherwise p2',
    action: 'Simplify the screen, move the action forward, and retest the viewport.',
  },
  {
    when: 'Copy, drill, planner, or recommendation feels generic.',
    result: 'needs-follow-up',
    category: 'content-quality-gap',
    severity: 'p2',
    action: 'Rewrite around the tennis behavior, proof signal, and next rep.',
  },
  {
    when: 'User returns later and cannot tell what changed or what to do next.',
    result: 'needs-follow-up',
    category: 'return-state-gap',
    severity: 'p1 for paid journeys, otherwise p2',
    action: 'Pull recent status, next action, and proof forward.',
  },
  {
    when: 'Spacing, wrapping, or hierarchy makes a working feature feel rough.',
    result: 'needs-follow-up',
    category: 'visual-polish',
    severity: 'p2 if usability suffers, otherwise p3',
    action: 'Fix layout and rerun the affected viewport.',
  },
  {
    when: 'The flow solves the wrong job or creates tier confusion.',
    result: 'fail',
    category: 'product-logic',
    severity: 'p1',
    action: 'Rework the flow against the tier pain point before visual polish.',
  },
]

console.log('TenAceIQ Issue Decision Guide')
console.log('')
console.log('Use this when a tester finds something and needs to decide result, category, severity, next action, and retest path.')
console.log('Command: npm run qa:issue')
console.log('Full guide: docs/customer-journey-issue-decision-guide.md')
console.log('Ledger: docs/customer-journey-test-results.md')
console.log('')

console.log('Decision table:')
for (const row of rows) {
  console.log(`- ${row.category}`)
  console.log(`  If: ${row.when}`)
  console.log(`  Result: ${row.result}`)
  console.log(`  Severity: ${row.severity}`)
  console.log(`  Next action: ${row.action}`)
}

console.log('')
console.log('Stop wider testing when:')
console.log('- Any p0 is open.')
console.log('- A p1 exists in the Day 1 player/coach trust loop.')
console.log('- Access, gating, data visibility, or cross-role sync is affected.')
console.log('- The fixture is missing for the journey you are trying to prove.')

console.log('')
console.log('Ledger Row Formula:')
console.log('- Result: pass | fail | blocked | needs-follow-up')
console.log('- Category: one issue category only')
console.log('- Severity: p0 | p1 | p2 | p3')
console.log('- Screenshot/video: evidence filename, even for visible fail/follow-up rows')
console.log('- Notes: what happened, where, and why it matters')
console.log('- Next action: owner-style action plus retest command')

console.log('')
console.log('Next commands:')
console.log('- npm run qa:triage')
console.log('- npm run qa:live-card -- <journey-id>')
console.log('- npm run qa:ledger-check')
console.log('- npm run qa:action-list')
console.log('- npm run qa:retest -- <day-or-journey>')

console.log('')
console.log('Closeout rule: every issue row should tell the next tester what broke, why it matters, what to fix or decide, and which journey proves the fix.')
