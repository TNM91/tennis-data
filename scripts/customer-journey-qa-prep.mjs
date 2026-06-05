import { spawnSync } from 'node:child_process'

const steps = [
  {
    label: 'QA packet status',
    command: 'node',
    args: ['scripts/customer-journey-qa-status.mjs'],
  },
  {
    label: 'Weekly testing sequence',
    command: 'node',
    args: ['scripts/customer-journey-weekly-readiness.mjs'],
  },
  {
    label: 'Session status rollup',
    command: 'node',
    args: ['scripts/customer-journey-session-status.mjs'],
  },
  {
    label: 'Sample day driver',
    command: 'node',
    args: ['scripts/customer-journey-day-brief.mjs', 'day1'],
  },
  {
    label: 'Fixture setup checklist',
    command: 'node',
    args: ['scripts/customer-journey-fixture-checklist.mjs'],
  },
  {
    label: 'Sample journey field card',
    command: 'node',
    args: ['scripts/customer-journey-card.mjs', 'player-level-up-mobile-loop'],
  },
  {
    label: 'Sample tier readiness card',
    command: 'node',
    args: ['scripts/customer-journey-tier-card.mjs', 'player'],
  },
  {
    label: 'Sample session ledger rows',
    command: 'node',
    args: ['scripts/customer-journey-session-ledger.mjs', 'day1'],
  },
  {
    label: 'Tier status rollup',
    command: 'node',
    args: ['scripts/customer-journey-tier-status.mjs'],
  },
  {
    label: 'Customer journey flow map',
    command: 'node',
    args: ['scripts/customer-journey-flow-map.mjs'],
  },
  {
    label: 'Customer journey handoff map',
    command: 'node',
    args: ['scripts/customer-journey-handoffs.mjs'],
  },
  {
    label: 'Tier feature matrix',
    command: 'node',
    args: ['scripts/customer-journey-feature-matrix.mjs'],
  },
  {
    label: 'Tier feature coverage report',
    command: 'node',
    args: ['scripts/customer-journey-coverage-report.mjs'],
  },
  {
    label: 'Journey risk board',
    command: 'node',
    args: ['scripts/customer-journey-risk-board.mjs'],
  },
  {
    label: 'Evidence gap report',
    command: 'node',
    args: ['scripts/customer-journey-gap-report.mjs'],
  },
  {
    label: 'Journey evidence checklist',
    command: 'node',
    args: ['scripts/customer-journey-evidence-checklist.mjs'],
  },
  {
    label: 'Issue triage guide',
    command: 'node',
    args: ['scripts/customer-journey-triage-guide.mjs'],
  },
  {
    label: 'Result ledger integrity check',
    command: 'node',
    args: ['scripts/customer-journey-ledger-check.mjs'],
  },
  {
    label: 'Result ledger summary',
    command: 'node',
    args: ['scripts/customer-journey-results-summary.mjs'],
  },
  {
    label: 'Open action list',
    command: 'node',
    args: ['scripts/customer-journey-action-list.mjs'],
  },
  {
    label: 'Retest plan',
    command: 'node',
    args: ['scripts/customer-journey-retest-plan.mjs'],
  },
  {
    label: 'Daily result recap',
    command: 'node',
    args: ['scripts/customer-journey-daily-summary.mjs'],
  },
  {
    label: 'Day closeout gate',
    command: 'node',
    args: ['scripts/customer-journey-day-closeout.mjs'],
  },
  {
    label: 'Closeout inventory guard',
    command: 'node',
    args: ['scripts/verify-platform-closeout-inventory.mjs'],
  },
]

console.log('TenAceIQ Customer Journey QA Prep')
console.log('')
console.log('Runs the prep packet in order. Use `npm run qa:ledger` separately when you are ready to paste rows into the result ledger.')

for (const step of steps) {
  console.log('')
  console.log(`== ${step.label} ==`)

  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    console.error('')
    console.error(`QA prep stopped at: ${step.label}`)
    process.exit(result.status ?? 1)
  }
}

console.log('')
console.log('QA prep passed. Next: run `npm run qa:ledger`, record results in docs/customer-journey-test-results.md, then run `npm run verify:closeout:live` after deploy.')
