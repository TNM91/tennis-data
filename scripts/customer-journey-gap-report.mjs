import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const processMapPath = 'docs/customer-journey-process-map.md'
const processMapSource = readFileSync(join(process.cwd(), processMapPath), 'utf8')

const matrixStart = processMapSource.indexOf('## Feature Access And Pain Point Matrix')
const matrixEnd = processMapSource.indexOf('## Next Week Test Order')

if (matrixStart === -1 || matrixEnd === -1 || matrixEnd <= matrixStart) {
  console.error(`Could not find the feature matrix in ${processMapPath}.`)
  process.exit(1)
}

const rows = processMapSource
  .slice(matrixStart, matrixEnd)
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .slice(1)
  .map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim().replaceAll('`', '')),
  )
  .map(([tier, feature, stage, route, painPoint, status, verification]) => ({
    tier,
    feature,
    stage,
    route,
    painPoint,
    status,
    verification,
  }))

const gaps = rows
  .filter((row) => row.status !== 'backend-backed' || row.verification !== 'automated')
  .sort((a, b) => gapPriority(b) - gapPriority(a))

console.log('TenAceIQ Journey QA Gap Report')
console.log('')
console.log(`Source: ${processMapPath}`)
console.log('Use this to decide what still needs real-account, fixture, mobile, or manual evidence.')
console.log('')

for (const row of gaps) {
  console.log(`${gapLabel(row)} - ${row.tier}: ${row.feature}`)
  console.log(`  Stage: ${row.stage}`)
  console.log(`  Route: ${row.route}`)
  console.log(`  Status: ${row.status}; verification: ${row.verification}`)
  console.log(`  Prove this: ${row.painPoint}`)
  console.log(`  Next evidence: ${evidencePrompt(row)}`)
}

console.log('')
console.log(`${gaps.length} feature gaps need manual, account, fixture, or local-sync evidence before the loop is fully closed.`)

function gapPriority(row) {
  const verificationScore = {
    'needs-account': 200,
    manual: 20,
    blocked: 50,
    automated: 0,
  }
  const statusScore = {
    local: 150,
    mock: 130,
    manual: 90,
    blocked: 50,
    'backend-backed': 20,
  }

  return (verificationScore[row.verification] ?? 0) + (statusScore[row.status] ?? 0)
}

function gapLabel(row) {
  if (row.verification === 'needs-account') return 'Account proof'
  if (row.status === 'local') return 'Sync proof'
  if (row.status === 'mock') return 'Mock proof'
  if (row.status === 'manual' || row.verification === 'manual') return 'Manual proof'
  return 'Evidence proof'
}

function evidencePrompt(row) {
  if (row.verification === 'needs-account') return 'Use the matching test account and capture access, route state, and handoff behavior.'
  if (row.status === 'local') return 'Capture what is saved locally, what is not synced yet, and whether the UI says that honestly.'
  if (row.tier === 'Admin/Internal') return 'Use fixture data only, capture before/after state, and record rollback or audit notes.'
  if (row.tier === 'League') return 'Use seeded league data, then capture coordinator source state and member-facing context.'
  if (row.tier === 'Captain') return 'Capture the weekly decision path from context to lineup or team communication.'
  if (row.tier === 'Full-Court') return 'Use a full-access test account and capture each paid workspace without stale locks.'
  return 'Capture the journey evidence that proves the pain point is solved, not just that the route loads.'
}
