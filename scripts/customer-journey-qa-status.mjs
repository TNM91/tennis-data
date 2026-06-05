import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredDocs = [
  'docs/customer-journey-qa-index.md',
  'docs/customer-journey-test-week-quickstart.md',
  'docs/customer-journey-issue-decision-guide.md',
  'docs/customer-journey-weekly-runbook.md',
  'docs/customer-journey-day-one-runbook.md',
  'docs/customer-journey-test-plan.md',
  'docs/customer-journey-test-results.md',
  'docs/qa-evidence/README.md',
  'docs/customer-journey-test-fixtures.md',
  'docs/customer-journey-test-scripts.md',
  'docs/customer-journey-process-map.md',
  'docs/level-up-sync-audit.md',
  'docs/platform-closeout-verification-log.md',
  'docs/platform-closeout-qa.md',
]

const requiredCommands = [
  'qa:prep',
  'qa:status',
  'qa:control',
  'qa:start',
  'qa:today',
  'qa:readiness',
  'qa:brief',
  'qa:next',
  'qa:session',
  'qa:session-status',
  'qa:day',
  'qa:tester-packet',
  'qa:journey',
  'qa:live-card',
  'qa:device-card',
  'qa:device-ledger',
  'qa:device-status',
  'qa:route-review',
  'qa:tier',
  'qa:tier-status',
  'qa:tier-board',
  'qa:access-review',
  'qa:week',
  'qa:day1',
  'qa:week-plan',
  'qa:fixtures',
  'qa:fixture-status',
  'qa:fixture-review',
  'qa:ledger',
  'qa:session-ledger',
  'qa:flows',
  'qa:trace',
  'qa:focus',
  'qa:handoffs',
  'qa:matrix',
  'qa:feature-review',
  'qa:coverage',
  'qa:risk-board',
  'qa:change-impact',
  'qa:gaps',
  'qa:evidence',
  'qa:evidence-index',
  'qa:evidence-pack',
  'qa:triage',
  'qa:issue',
  'qa:ledger-check',
  'qa:results',
  'qa:action-list',
  'qa:owner-board',
  'qa:retest',
  'qa:daily-summary',
  'qa:close-day',
  'qa:tester-handoff',
  'qa:scorecard',
  'qa:signoff',
  'qa:launch',
  'verify:closeout',
  'verify:closeout:live',
]

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const missingDocs = requiredDocs.filter((doc) => !existsSync(join(root, doc)))
const missingCommands = requiredCommands.filter((command) => !packageJson.scripts?.[command])

console.log('TenAceIQ Customer Journey QA Status')
console.log('')
console.log(`Docs: ${requiredDocs.length - missingDocs.length}/${requiredDocs.length} present`)
console.log(`Commands: ${requiredCommands.length - missingCommands.length}/${requiredCommands.length} registered`)

if (missingDocs.length) {
  console.log('')
  console.log('Missing docs:')
  for (const doc of missingDocs) console.log(`- ${doc}`)
}

if (missingCommands.length) {
  console.log('')
  console.log('Missing commands:')
  for (const command of missingCommands) console.log(`- npm run ${command}`)
}

console.log('')
console.log('Start here:')
console.log('- docs/customer-journey-qa-index.md')
console.log('- docs/customer-journey-test-week-quickstart.md')
console.log('')
console.log('Recommended command order:')
console.log('- npm run qa:prep')
console.log('- npm run qa:control')
console.log('- npm run qa:start -- --date=yyyy-mm-dd --tester=<name>')
console.log('- npm run qa:today -- --date=yyyy-mm-dd --tester=<name>')
console.log('- npm run qa:readiness')
console.log('- npm run qa:brief -- <day1-day5>')
console.log('- npm run qa:next')
console.log('- npm run qa:session -- <day1-day5>')
console.log('- npm run qa:session-status -- <day1-day5>')
console.log('- npm run qa:day -- <day1-day5>')
console.log('- npm run qa:tester-packet -- <day1-day5> --device=<phone | tablet | desktop> --date=yyyy-mm-dd --tester=<name>')
console.log('- npm run qa:journey -- <journey-id | tier | search>')
console.log('- npm run qa:live-card -- <journey-id> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
console.log('- npm run qa:device-card -- <phone | tablet | desktop | journey-id>')
console.log('- npm run qa:device-ledger -- <phone | tablet | desktop | journey-id> --date=yyyy-mm-dd --tester=<name>')
console.log('- npm run qa:device-status -- <phone | tablet | desktop | journey-id>')
console.log('- npm run qa:route-review -- </route | tier | feature | journey>')
console.log('- npm run qa:tier -- <tier>')
console.log('- npm run qa:tier-status -- <tier>')
console.log('- npm run qa:tier-board -- <tier | feature | journey | route>')
console.log('- npm run qa:access-review -- <tier>')
console.log('- npm run qa:week')
console.log('- npm run qa:day1')
console.log('- npm run qa:week-plan -- <day1-day5> --date=yyyy-mm-dd --tester=<name>')
console.log('- npm run qa:fixtures')
console.log('- npm run qa:fixture-status -- <day1-day5 | fixture | journey | route>')
console.log('- npm run qa:fixture-review -- <fixture | tier | journey | route>')
console.log('- npm run qa:ledger')
console.log('- npm run qa:session-ledger -- <day1-day5>')
console.log('- npm run qa:flows')
console.log('- npm run qa:trace -- <tier | journey | feature | route>')
console.log('- npm run qa:focus -- <tier-or-journey>')
console.log('- npm run qa:handoffs')
console.log('- npm run qa:matrix')
console.log('- npm run qa:feature-review -- <feature | tier | route>')
console.log('- npm run qa:coverage -- <tier>')
console.log('- npm run qa:risk-board -- <tier | day | journey>')
console.log('- npm run qa:change-impact -- --files=<comma-separated-files>')
console.log('- npm run qa:gaps')
console.log('- npm run qa:evidence')
console.log('- npm run qa:evidence-index')
console.log('- npm run qa:evidence-pack -- <day1-day5>')
console.log('- npm run qa:triage')
console.log('- npm run qa:issue')
console.log('- npm run qa:ledger-check')
console.log('- npm run qa:results')
console.log('- npm run qa:action-list')
console.log('- npm run qa:owner-board -- <owner | tier | day1-day5 | journey>')
console.log('- npm run qa:retest -- <day-or-journey>')
console.log('- npm run qa:daily-summary -- <yyyy-mm-dd>')
console.log('- npm run qa:close-day -- <day1-day5>')
console.log('- npm run qa:tester-handoff -- <day1-day5 | journey | tier>')
console.log('- npm run qa:scorecard')
console.log('- npm run qa:signoff')
console.log('- npm run qa:launch')
console.log('- npm run verify:closeout:live')

if (missingDocs.length || missingCommands.length) {
  process.exitCode = 1
}
