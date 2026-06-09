import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, sessionByJourneyId, tierAliases } from './customer-journey-qa-data.mjs'

const processMapPath = 'docs/customer-journey-process-map.md'
const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = rawQuery.replace(/\s+/g, '-').replaceAll('_', '-')

const journeyPlans = customerJourneyDetails.map((journey) => ({
  id: journey.id,
  label: journey.label,
  day: sessionByJourneyId.get(journey.id)?.id ?? 'unassigned',
  tier: journey.tier,
  risk: journey.risk,
  fixture: journey.accountFixture,
  route: journey.entryRoute,
  features: journey.riskFeatureLabels,
}))

const featureRows = parseFeatureRows(readFileSync(join(process.cwd(), processMapPath), 'utf8'))
const ledgerRows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => journeyPlans.some((plan) => plan.id === row.journeyId))

const selectedPlans = journeyPlans.filter(matchesQuery)
const scoredPlans = selectedPlans.map(scorePlan).sort((a, b) => b.score - a.score)

console.log('TenAceIQ Customer Journey Risk Board')
console.log('')
console.log(`Feature source: ${processMapPath}`)
console.log(`Result source: ${resultsPath}`)
console.log('Use this before a testing block to choose the highest-value journey to prove or fix first.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!scoredPlans.length) {
  console.log('No journeys matched the filter.')
  console.log('')
  console.log('Usage: npm run qa:risk-board -- <tier | day1-day5 | journey-id | search>')
  process.exit(1)
}

const openHighPriorityCount = scoredPlans.reduce((count, item) => count + item.openHighPriorityRows.length, 0)
const missingPassCount = scoredPlans.filter((item) => !item.hasPassEvidence).length
const missingEvidenceCount = scoredPlans.filter((item) => !item.hasScreenshotOrVideo).length

console.log(`Journeys ranked: ${scoredPlans.length}`)
console.log(`Open p0/p1 rows: ${openHighPriorityCount}`)
console.log(`Missing pass evidence: ${missingPassCount}`)
console.log(`Missing screenshot/video evidence: ${missingEvidenceCount}`)
console.log('')

for (const item of scoredPlans) {
  printRiskItem(item)
}

console.log('Use with:')
console.log('- npm run qa:journey -- <journey-id>')
console.log('- npm run qa:session -- <day1-day5>')
console.log('- npm run qa:coverage -- <tier>')
console.log('- npm run qa:action-list')
console.log('- npm run qa:retest -- <day-or-journey>')
console.log('')
console.log('Closeout rule: start with open p0/p1 trust issues, then critical journeys missing pass evidence, then manual/account/local-sync proof gaps.')

function printRiskItem(item) {
  const { plan } = item
  console.log(`${item.score} - ${plan.label} (${plan.id})`)
  console.log(`  Tier: ${plan.tier}; session: ${plan.day}; risk: ${plan.risk}`)
  console.log(`  Route: ${plan.route}`)
  console.log(`  Fixture: ${plan.fixture}`)
  console.log(`  State: ${item.state}`)
  console.log(`  Why now: ${item.reasons.join('; ')}`)
  console.log(`  Commands: npm run qa:journey -- ${plan.id}; npm run qa:session -- ${plan.day}; npm run qa:coverage -- ${plan.tier.toLowerCase()}`)

  if (item.openHighPriorityRows.length) {
    console.log('  Open p0/p1:')
    for (const row of item.openHighPriorityRows) {
      console.log(`  - ${row.severity} ${row.result}: ${row.category || 'uncategorized'}; ${row.nextAction || 'missing next action'}`)
    }
  }
}

function scorePlan(plan) {
  const rows = ledgerRows.filter((row) => row.journeyId === plan.id)
  const hasPassEvidence = rows.some((row) => row.result === 'pass')
  const hasScreenshotOrVideo = rows.some((row) => row.screenshotOrVideo)
  const openHighPriorityRows = rows.filter((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
  const features = plan.features.map((featureLabel) => featureRows.find((feature) => feature.feature === featureLabel)).filter(Boolean)
  const fragileFeatures = features.filter((feature) => feature.status === 'local' || feature.status === 'manual' || feature.verification === 'manual' || feature.verification === 'needs-account')
  const reasons = []

  let score = 0

  if (openHighPriorityRows.length) {
    score += 120
    reasons.push('open p0/p1 row')
  }

  if (!hasPassEvidence) {
    score += 40
    reasons.push('missing pass evidence')
  }

  if (!hasScreenshotOrVideo) {
    score += 15
    reasons.push('missing screenshot/video evidence')
  }

  if (!rows.length) {
    score += 20
    reasons.push('no real ledger row yet')
  }

  if (plan.risk === 'critical') {
    score += 70
    reasons.push('critical trust journey')
  } else if (plan.risk === 'high') {
    score += 45
    reasons.push('high-risk journey')
  } else {
    score += 20
    reasons.push('medium-risk regression')
  }

  if (fragileFeatures.length) {
    score += fragileFeatures.length * 8
    reasons.push(`manual/account/local proof: ${fragileFeatures.map((feature) => feature.feature).join(', ')}`)
  }

  score += Math.max(0, 8 - Number(plan.day.replace('day', '')))

  return {
    plan,
    score,
    rows,
    hasPassEvidence,
    hasScreenshotOrVideo,
    openHighPriorityRows,
    reasons,
    state: getState({ rows, hasPassEvidence, hasScreenshotOrVideo, openHighPriorityRows }),
  }
}

function getState({ rows, hasPassEvidence, hasScreenshotOrVideo, openHighPriorityRows }) {
  if (openHighPriorityRows.length) return 'blocked by high-priority issue'
  if (!rows.length) return 'untested'
  if (!hasPassEvidence) return 'needs fresh pass'
  if (!hasScreenshotOrVideo) return 'needs evidence attachment'
  return 'pass evidence logged'
}

function matchesQuery(plan) {
  if (!rawQuery) return true

  const tierLabel = tierAliases.get(normalizedQuery.replace(/-/g, '')) ?? tierAliases.get(normalizedQuery)

  if (tierLabel) return plan.tier === tierLabel
  if (normalizedQuery === plan.day) return true

  const haystack = [plan.id, plan.label, plan.tier, plan.risk, plan.fixture, plan.route, plan.features.join(' ')]
    .join(' ')
    .toLowerCase()

  return haystack.includes(rawQuery) || haystack.replace(/\s+/g, '-').includes(normalizedQuery)
}

function parseFeatureRows(source) {
  const matrixStart = source.indexOf('## Feature Access And Pain Point Matrix')
  const matrixEnd = source.indexOf('## Next Week Test Order')

  if (matrixStart === -1 || matrixEnd === -1 || matrixEnd <= matrixStart) {
    console.error(`Could not find the feature matrix in ${processMapPath}.`)
    process.exit(1)
  }

  return source
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
