import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, tierAliases } from './customer-journey-qa-data.mjs'

const processMapPath = 'docs/customer-journey-process-map.md'
const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = rawQuery.replace(/\s+/g, '-').replaceAll('_', '-')

const journeyPlans = customerJourneyDetails.map((journey) => ({
  id: journey.id,
  fixture: journey.accountFixture,
  featureLabels: journey.riskFeatureLabels,
}))

const processMapSource = readFileSync(join(process.cwd(), processMapPath), 'utf8')
const resultsSource = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const features = parseFeatureRows(processMapSource).filter(matchesQuery)
const ledgerRows = resultsSource
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => journeyPlans.some((plan) => plan.id === row.journeyId))

console.log('TenAceIQ Customer Journey Coverage Report')
console.log('')
console.log(`Feature source: ${processMapPath}`)
console.log(`Result source: ${resultsPath}`)
console.log('Use this to verify every tier feature has a proving journey and logged evidence.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!features.length) {
  console.log('No features matched the filter.')
  console.log('')
  console.log('Usage: npm run qa:coverage -- <free | player | coach | captain | league | full-court | admin>')
  process.exit(1)
}

const coveredFeatures = features.filter((feature) => getPlansForFeature(feature).length)
const passCoveredFeatures = features.filter((feature) => getPlansForFeature(feature).some((plan) => hasPassEvidence(plan.id)))
const featuresWithOpenHighPriority = features.filter((feature) =>
  getPlansForFeature(feature).some((plan) => getOpenHighPriorityRows(plan.id).length),
)

console.log(`Features mapped to journeys: ${coveredFeatures.length}/${features.length}`)
console.log(`Features with logged pass evidence: ${passCoveredFeatures.length}/${features.length}`)
console.log(`Features with open p0/p1 rows: ${featuresWithOpenHighPriority.length}`)
console.log('')

let activeTier = ''
for (const feature of features) {
  if (feature.tier !== activeTier) {
    activeTier = feature.tier
    console.log(activeTier)
  }

  printFeatureCoverage(feature)
}

console.log('')
console.log('Use with:')
console.log('- npm run qa:matrix')
console.log('- npm run qa:journey -- <journey-id>')
console.log('- npm run qa:tier-status -- <tier>')
console.log('- npm run qa:close-day -- <day1-day5>')
console.log('- npm run qa:launch')
console.log('')
console.log('Closeout rule: every feature should have a proving journey, pass evidence, and no open p0/p1 row before the tier is considered ready.')

function printFeatureCoverage(feature) {
  const plans = getPlansForFeature(feature)
  const passPlans = plans.filter((plan) => hasPassEvidence(plan.id))
  const openHighPriorityRows = plans.flatMap((plan) => getOpenHighPriorityRows(plan.id))
  const status = !plans.length ? 'missing journey' : passPlans.length && !openHighPriorityRows.length ? 'has pass evidence' : 'needs evidence'

  console.log(`- ${feature.feature} (${feature.stage}) - ${status}`)
  console.log(`  Route: ${feature.route}`)
  console.log(`  Pain point: ${feature.painPoint}`)
  console.log(`  Status: ${feature.status}; verification: ${feature.verification}`)

  if (!plans.length) {
    console.log('  Proving journey: missing')
    console.log('  Next: add this feature to a customer journey test plan.')
    return
  }

  console.log('  Proving journeys:')
  for (const plan of plans) {
    const planRows = ledgerRows.filter((row) => row.journeyId === plan.id)
    const latestRow = planRows.at(-1)
    const marker = hasPassEvidence(plan.id) ? 'pass logged' : planRows.length ? 'needs retest' : 'missing result'

    console.log(`  - ${marker}: ${plan.id}`)
    console.log(`    Fixture: ${plan.fixture}`)
    console.log(`    Evidence: ${latestRow?.screenshotOrVideo || 'missing screenshot/video'}`)
    console.log(`    Command: npm run qa:journey -- ${plan.id}`)
  }

  if (openHighPriorityRows.length) {
    console.log('  Open p0/p1:')
    for (const row of openHighPriorityRows) {
      console.log(`  - ${row.severity} ${row.result}: ${row.category || 'uncategorized'}; ${row.nextAction || 'missing next action'}`)
    }
  }
}

function getPlansForFeature(feature) {
  return journeyPlans.filter((plan) => plan.featureLabels.includes(feature.feature))
}

function hasPassEvidence(journeyId) {
  return ledgerRows.some((row) => row.journeyId === journeyId && row.result === 'pass' && row.screenshotOrVideo)
}

function getOpenHighPriorityRows(journeyId) {
  return ledgerRows.filter((row) => row.journeyId === journeyId && row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
}

function matchesQuery(feature) {
  if (!rawQuery) return true

  const tierLabel = tierAliases.get(normalizedQuery.replace(/-/g, '')) ?? tierAliases.get(normalizedQuery)
  if (tierLabel) return feature.tier === tierLabel

  const haystack = [feature.tier, feature.feature, feature.stage, feature.route, feature.painPoint, feature.status, feature.verification]
    .join(' ')
    .toLowerCase()

  return haystack.includes(rawQuery)
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
