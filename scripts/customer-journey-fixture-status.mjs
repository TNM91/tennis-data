import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneySessions, fixtureGateJourneyIds, getFixtureAuthSmokeCommand, journeyById } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const fixtureGuidePath = 'docs/customer-journey-test-fixtures.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = normalize(rawQuery)

const fixtureLabels = {
  free_viewer: 'Free/public tester',
  player_plus_linked: 'Player+ linked account',
  coach_primary: 'Coach account',
  captain_primary: 'Captain account',
  league_coordinator: 'League coordinator account',
  full_court_operator: 'Full-Court account',
  admin_test: 'Admin test account',
  'linked-player-profile': 'Linked player profile',
  'coach-invite-token': 'Coach invite token',
  'level-up-assignment': 'Level Up assignment',
  'level-up-completion': 'Level Up completion',
  'captain-team-week': 'Captain team week',
  'league-week': 'League week',
  'data-assist-upload': 'Data Assist upload',
  'full-court-access-state': 'Full-Court access state',
  'admin-access-repair': 'Admin access repair',
}

const rows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)

const filteredSessions = customerJourneySessions.filter(matchesQuery)

console.log('TenAceIQ Fixture Status')
console.log('')
console.log(`Sources: ${fixtureGuidePath}; ${resultsPath}`)
console.log('Use this before a testing block to confirm required fixtures, dependent journeys, and fixture-gap blockers.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!filteredSessions.length) {
  console.log(`No session matched "${rawQuery}".`)
  console.log('Usage: npm run qa:fixture-status -- <day1-day5 | fixture | journey | route>')
  process.exit(1)
}

for (const session of filteredSessions) {
  printSession(session)
}

console.log('Use with:')
console.log('- npm run qa:fixtures')
console.log('- npm run qa:fixture-auth-smoke -- --env')
console.log('- npm run qa:fixture-auth-smoke')
console.log('- npm run qa:fixture-gate -- <journey | fixture | route | search>')
console.log('- npm run qa:fixture-review -- <fixture>')
console.log('- npm run qa:tester-packet -- <day1-day5> --device=<phone|tablet|desktop>')
console.log('- npm run qa:issue')
console.log('- npm run qa:retest -- <day-or-journey>')
console.log('')
console.log('Closeout rule: a missing fixture is fixture-gap, not a product pass. Repair the fixture, then rerun the dependent journey.')

function printSession(session) {
  const sessionJourneys = session.journeyIds.map((journeyId) => journeyById.get(journeyId)).filter(Boolean)
  const fixtureIds = [...new Set(sessionJourneys.flatMap((journey) => journey.fixtureIds))]
  const fixtureGapRows = rows.filter((row) => session.journeyIds.includes(row.journeyId) && row.category === 'fixture-gap' && row.result !== 'pass')

  console.log(session.label)
  console.log(`  Question: ${session.closeoutQuestion}`)
  console.log(`  Fixture blockers in ledger: ${fixtureGapRows.length}`)
  console.log('  Required fixtures:')
  for (const fixtureId of fixtureIds) {
    const label = fixtureLabels[fixtureId] ?? fixtureId
    const fixtureRows = rows.filter((row) => row.accountFixture === fixtureId || row.notes.includes(fixtureId) || row.nextAction.includes(fixtureId))
    const hasOpenFixtureGap = fixtureRows.some((row) => row.category === 'fixture-gap' && row.result !== 'pass')
    const state = hasOpenFixtureGap ? 'open fixture-gap' : fixtureRows.length ? 'seen in ledger' : 'confirm before test'
    console.log(`  - ${state}: ${fixtureId} (${label})`)
    console.log(`    Review: npm run qa:fixture-review -- ${fixtureId}`)
  }
  console.log('  Journeys:')
  for (const journey of sessionJourneys) {
    const journeyRows = rows.filter((row) => row.journeyId === journey.id)
    const latest = journeyRows.at(-1)
    const hasOpenFixtureGap = journeyRows.some((row) => row.category === 'fixture-gap' && row.result !== 'pass')
    const state = latest ? `${latest.result || 'logged'}${latest.category ? `/${latest.category}` : ''}` : 'not logged'
    console.log(`  - ${state}: ${journey.label} (${journey.id})`)
    console.log(`    Route: ${journey.entryRoute}`)
    console.log(`    Fixtures: ${journey.fixtureIds.join(', ')}`)
    const authSmokeCommand = getFixtureAuthSmokeCommand(journey.accountFixture)
    if (hasOpenFixtureGap && (fixtureGateJourneyIds.has(journey.id) || authSmokeCommand)) {
      console.log(`    Fixture gate: npm run qa:fixture-gate -- ${journey.id}`)
      console.log(`    Auth env: npm run qa:fixture-auth-smoke -- --env`)
      console.log(`    Auth smoke: ${authSmokeCommand || 'npm run qa:fixture-auth-smoke'}`)
      console.log(`    Command: npm run qa:fixture-gate -- ${journey.id}; npm run qa:fixture-auth-smoke -- --env; ${authSmokeCommand || 'npm run qa:fixture-auth-smoke'}`)
    } else {
      console.log(`    Command: npm run qa:journey -- ${journey.id}`)
    }
  }
  if (fixtureGapRows.length) {
    console.log('  Open fixture-gap rows:')
    for (const row of fixtureGapRows) {
      console.log(`  - ${row.journeyId}: ${row.notes || 'missing note'}; next: ${row.nextAction || 'missing next action'}`)
      const authSmokeCommand = getFixtureAuthSmokeCommand(row.accountFixture)
      if (fixtureGateJourneyIds.has(row.journeyId) || authSmokeCommand) {
        console.log(`    Fixture gate: npm run qa:fixture-gate -- ${row.journeyId}`)
        console.log(`    Auth env: npm run qa:fixture-auth-smoke -- --env`)
        console.log(`    Auth smoke: ${authSmokeCommand || 'npm run qa:fixture-auth-smoke'}`)
      }
    }
  }
  console.log(`  Start: npm run qa:tester-packet -- ${session.id} --device=<phone|tablet|desktop>`)
  console.log('')
}

function matchesQuery(session) {
  if (!rawQuery) return true
  const sessionJourneys = session.journeyIds.map((journeyId) => journeyById.get(journeyId)).filter(Boolean)
  const haystack = [
    session.id,
    session.label,
    session.closeoutQuestion,
    ...sessionJourneys.flatMap((journey) => [journey.id, journey.label, journey.entryRoute, ...journey.fixtureIds]),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(rawQuery) || haystack.includes(normalizedQuery)
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

function normalize(value) {
  return value.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
