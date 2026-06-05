import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredDocs = [
  'docs/customer-journey-qa-index.md',
  'docs/customer-journey-weekly-runbook.md',
  'docs/customer-journey-day-one-runbook.md',
  'docs/customer-journey-test-plan.md',
  'docs/customer-journey-test-results.md',
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
  'qa:next',
  'qa:session',
  'qa:journey',
  'qa:tier',
  'qa:tier-status',
  'qa:week',
  'qa:day1',
  'qa:fixtures',
  'qa:ledger',
  'qa:flows',
  'qa:focus',
  'qa:handoffs',
  'qa:matrix',
  'qa:gaps',
  'qa:evidence',
  'qa:triage',
  'qa:results',
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
console.log('')
console.log('Recommended command order:')
console.log('- npm run qa:prep')
console.log('- npm run qa:next')
console.log('- npm run qa:session -- <day1-day5>')
console.log('- npm run qa:journey -- <journey-id | tier | search>')
console.log('- npm run qa:tier -- <tier>')
console.log('- npm run qa:tier-status -- <tier>')
console.log('- npm run qa:week')
console.log('- npm run qa:day1')
console.log('- npm run qa:fixtures')
console.log('- npm run qa:ledger')
console.log('- npm run qa:flows')
console.log('- npm run qa:focus -- <tier-or-journey>')
console.log('- npm run qa:handoffs')
console.log('- npm run qa:matrix')
console.log('- npm run qa:gaps')
console.log('- npm run qa:evidence')
console.log('- npm run qa:triage')
console.log('- npm run qa:results')
console.log('- npm run qa:launch')
console.log('- npm run verify:closeout:live')

if (missingDocs.length || missingCommands.length) {
  process.exitCode = 1
}
