import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneyDetails, normalizeQaQuery, tierAliases } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalizeQaQuery(rawQuery)

const tierOrder = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court', 'admin_internal']
const tiers = tierOrder.map(buildTier).filter((tier) => tier.journeys.length)

const plannedJourneyIds = tiers.flatMap((tier) => tier.journeys)
const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const rows = source
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))

const selectedTiers = getSelectedTiers()

console.log('TenAceIQ Customer Journey Tier Status')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Closeout rule: a tier is ready only when every listed journey has pass evidence and no open p0/p1 row remains for that tier.')
console.log('')

for (const tier of selectedTiers) {
  printTierStatus(tier)
}

if (!selectedTiers.length) {
  console.log(`No tier matched "${rawQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:tier-status -- <free | player | coach | captain | league | full-court | admin>')
  process.exit(1)
}

console.log('Use with:')
console.log('- npm run qa:tier -- <tier>')
console.log('- npm run qa:journey -- <journey-id>')
console.log('- npm run qa:results')
console.log('- npm run qa:launch')

function getSelectedTiers() {
  if (!rawQuery) return tiers

  const tierLabel = tierAliases.get(normalizedQuery)
  const tier = tiers.find((item) => item.aliases.includes(normalizedQuery) || item.label === tierLabel)

  return tier ? [tier] : []
}

function buildTier(id) {
  const journeys = customerJourneyDetails.filter((journey) => journey.tierId === id)
  const label = journeys[0]?.tier ?? id
  const aliases = new Set([normalizeQaQuery(id), normalizeQaQuery(id.replace(/_/g, '-')), normalizeQaQuery(label)])

  for (const [alias, aliasLabel] of tierAliases) {
    if (aliasLabel === label) aliases.add(alias)
  }

  return {
    id,
    aliases: [...aliases],
    label,
    fixture: journeys[0]?.accountFixture ?? 'missing fixture',
    journeys: journeys.map((journey) => journey.id),
  }
}

function printTierStatus(tier) {
  const tierRows = rows.filter((row) => tier.journeys.includes(row.journeyId))
  const passJourneyIds = new Set(tierRows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
  const testedJourneyIds = new Set(tierRows.map((row) => row.journeyId))
  const missingPassJourneyIds = tier.journeys.filter((journeyId) => !passJourneyIds.has(journeyId))
  const missingAnyResultJourneyIds = tier.journeys.filter((journeyId) => !testedJourneyIds.has(journeyId))
  const openHighPriorityRows = tierRows.filter((row) => (row.severity === 'p0' || row.severity === 'p1') && row.result !== 'pass')
  const status = missingPassJourneyIds.length || openHighPriorityRows.length ? 'not ready' : 'ready'

  console.log(`${tier.label}: ${status}`)
  console.log(`  Fixture: ${tier.fixture}`)
  console.log(`  Pass journeys: ${passJourneyIds.size}/${tier.journeys.length}`)
  console.log(`  Ledger rows: ${tierRows.length}`)
  console.log(`  Open p0/p1: ${openHighPriorityRows.length}`)

  console.log('  Journeys:')
  for (const journeyId of tier.journeys) {
    const marker = passJourneyIds.has(journeyId) ? 'pass' : testedJourneyIds.has(journeyId) ? 'needs review' : 'missing'
    console.log(`  - ${marker}: ${journeyId}`)
  }

  if (missingAnyResultJourneyIds.length) {
    console.log(`  Missing result rows: ${missingAnyResultJourneyIds.join(', ')}`)
  }

  if (openHighPriorityRows.length) {
    console.log('  Blocking p0/p1 rows:')
    for (const row of openHighPriorityRows) {
      console.log(`  - ${row.severity} ${row.result}: ${row.journeyId}`)
      console.log(`    Category: ${row.category || 'uncategorized'}`)
      console.log(`    Next action: ${row.nextAction || 'missing next action'}`)
    }
  }

  console.log('')
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
