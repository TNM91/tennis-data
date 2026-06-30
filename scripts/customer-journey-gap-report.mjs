import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, plannedJourneyIds } from './customer-journey-qa-data.mjs'

const processMapPath = 'docs/customer-journey-process-map.md'
const resultsPath = 'docs/customer-journey-test-results.md'
const processMapSource = readFileSync(join(process.cwd(), processMapPath), 'utf8')
const resultsSource = readFileSync(join(process.cwd(), resultsPath), 'utf8')

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

const featureProofByLabel = buildFeatureProofByLabel()
const gaps = rows
  .filter((row) => row.status !== 'backend-backed' || row.verification !== 'automated')
  .map((row) => ({ ...row, proof: getClosedFeatureProof(row) }))
  .filter((row) => !row.proof)
  .sort((a, b) => gapPriority(b) - gapPriority(a))
const closedProofs = rows
  .filter((row) => row.status !== 'backend-backed' || row.verification !== 'automated')
  .map((row) => ({ ...row, proof: getClosedFeatureProof(row) }))
  .filter((row) => row.proof)
  .sort((a, b) => a.tier.localeCompare(b.tier) || a.feature.localeCompare(b.feature))

console.log('TenAceIQ Journey QA Gap Report')
console.log('')
console.log(`Sources: ${processMapPath}; ${resultsPath}`)
console.log('Use this to decide what still needs real-account, fixture, mobile, or manual evidence after signed-off pass rows are applied.')
console.log('')

console.log('Active evidence gaps:')
if (gaps.length) {
  for (const row of gaps) {
    console.log(`- ${gapLabel(row)} - ${row.tier}: ${row.feature}`)
    console.log(`  Stage: ${row.stage}`)
    console.log(`  Route: ${row.route}`)
    console.log(`  Status: ${row.status}; verification: ${row.verification}`)
    console.log(`  Prove this: ${row.painPoint}`)
    console.log(`  Next evidence: ${evidencePrompt(row)}`)
  }
} else {
  console.log('- None')
}

console.log('')
console.log('Closed by signed-off pass evidence:')
if (closedProofs.length) {
  for (const row of closedProofs) {
    console.log(`- ${row.tier}: ${row.feature}`)
    console.log(`  Proven by: ${row.proof.journeyId} (${row.proof.date || 'undated'})`)
  }
} else {
  console.log('- None')
}

console.log('')
console.log(`${gaps.length} active feature gaps need manual, account, fixture, or local-sync evidence before the loop is fully closed.`)

function buildFeatureProofByLabel() {
  const latestPassRows = resultsSource
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.includes('---'))
    .map((line, ledgerIndex) => ({ ...parseMarkdownRow(line), ledgerIndex }))
    .filter((row) => plannedJourneyIds.includes(row.journeyId))
    .filter((row) => row.result === 'pass')
    .reduce((acc, row) => {
      const existing = acc.get(row.journeyId)
      if (!existing || row.ledgerIndex > existing.ledgerIndex) acc.set(row.journeyId, row)
      return acc
    }, new Map())

  return customerJourneyDetails.reduce((acc, journey) => {
    const proof = latestPassRows.get(journey.id)
    if (!proof?.screenshotOrVideo) return acc

    for (const label of journey.riskFeatureLabels) {
      const proofs = acc.get(label) ?? []
      proofs.push({ ...proof, tier: journey.tier })
      acc.set(label, proofs)
    }

    return acc
  }, new Map())
}

function getClosedFeatureProof(row) {
  const proofs = featureProofByLabel.get(row.feature) ?? []
  return proofs.find((proof) => proof.tier === row.tier) ?? proofs[0]
}

function parseMarkdownRow(line) {
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())

  return {
    date: cells[0] ?? '',
    tester: cells[1] ?? '',
    deviceBrowser: cells[2] ?? '',
    accountFixture: cells[3] ?? '',
    journeyId: cells[4] ?? '',
    entryRoute: cells[5] ?? '',
    result: cells[6] ?? '',
    category: cells[7] ?? '',
    severity: cells[8] ?? '',
    screenshotOrVideo: cells[9] ?? '',
    notes: cells[10] ?? '',
    nextAction: cells[11] ?? '',
  }
}

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
  if (row.feature === 'Coach Invite Link') return 'Use the matching test account and capture invite acceptance, linked-player state, the Linking proof privacy cue, the Invite acceptance proof cue, and the Coach invite account proof cue.'
  if (row.verification === 'needs-account') return 'Use the matching test account and capture access, route state, and handoff behavior.'
  if (row.feature === 'Coach Lesson Planner') return 'Capture the one-hour plan blocks, Coach lesson support proof cue, and Level Up assignment handoff cue so lesson support does not end as paper-only work.'
  if (row.feature === 'Level Up Portal') return 'Capture the Level Up local sync proof cue, what is saved locally, what is not synced yet, and whether the UI says that honestly.'
  if (row.tier === 'Captain' && row.status === 'local') return 'Capture the Captain Save status cue, Captain local sync proof cue, Captain decision handoff proof cue, what is browser-saved, and whether it avoids implying account sync.'
  if (row.status === 'local') return 'Capture what is saved locally, what is not synced yet, and whether the UI says that honestly.'
  if (row.feature === 'My Lab') return 'Capture the My Lab refresh proof cue, linked profile state, next action, and Level Up return-state panel after refresh.'
  if (row.tier === 'Admin/Internal') return 'Use fixture data only, capture the Fixture safety, Admin access repair, Data trust guard, and Admin import outcome proof cues, before/after state, and rollback or audit notes.'
  if (row.feature === 'Data Assist Entry') return 'Capture the Data Assist review-first handoff cue, Data Assist upload state proof cue, and whether unreviewed data stays out of trusted records.'
  if (row.tier === 'League') return 'Use seeded league data, capture the League Office operation proof cue and source-to-public proof cue, then capture coordinator source state and member-facing context.'
  if (row.tier === 'Captain') return 'Capture the weekly decision path plus the Compete Bridge captain handoff cue from context to lineup or team communication.'
  if (row.tier === 'Full-Court') return 'Use a full-access test account, capture the Full-Court access pass cue, Full-Court tool fit proof cue, Full-Court role switching proof cue, and each paid tool without stale locks.'
  return 'Capture the journey evidence that proves the pain point is solved, not just that the route loads.'
}
