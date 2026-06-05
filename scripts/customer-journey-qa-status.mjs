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
  'qa:status',
  'qa:week',
  'qa:day1',
  'qa:ledger',
  'qa:matrix',
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
console.log('- npm run qa:week')
console.log('- npm run qa:day1')
console.log('- npm run qa:ledger')
console.log('- npm run qa:matrix')
console.log('- npm run verify:closeout:live')

if (missingDocs.length || missingCommands.length) {
  process.exitCode = 1
}
