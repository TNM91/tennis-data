import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = rawQuery.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const tiers = [
  {
    id: 'free',
    aliases: ['free', 'visitor', 'public'],
    label: 'Free',
    fixture: 'free_viewer',
    journeys: ['free-public-discovery'],
  },
  {
    id: 'player_plus',
    aliases: ['player', 'player-plus', 'playerplus', 'player_plus'],
    label: 'Player',
    fixture: 'player_plus_linked',
    journeys: ['player-level-up-mobile-loop', 'player-my-lab-return-state'],
  },
  {
    id: 'coach',
    aliases: ['coach', 'coaches'],
    label: 'Coach',
    fixture: 'coach_primary',
    journeys: ['coach-player-assigned-challenge', 'coach-lesson-support'],
  },
  {
    id: 'captain',
    aliases: ['captain', 'team-captain'],
    label: 'Captain',
    fixture: 'captain_primary',
    journeys: ['captain-week-flow'],
  },
  {
    id: 'league',
    aliases: ['league', 'coordinator', 'league-coordinator'],
    label: 'League',
    fixture: 'league_coordinator',
    journeys: ['league-result-to-public-context'],
  },
  {
    id: 'full_court',
    aliases: ['full-court', 'fullcourt', 'full_court', 'all-access'],
    label: 'Full-Court',
    fixture: 'full_court_operator',
    journeys: ['full-court-access-pass'],
  },
  {
    id: 'admin_internal',
    aliases: ['admin', 'internal', 'admin-internal', 'admin_internal'],
    label: 'Admin/Internal',
    fixture: 'admin_test',
    journeys: ['admin-access-and-data-quality'],
  },
]

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

  const tier = tiers.find((item) => item.aliases.includes(normalizedQuery) || item.id.replace(/_/g, '-') === normalizedQuery)

  return tier ? [tier] : []
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
