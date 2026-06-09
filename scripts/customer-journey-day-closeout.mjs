import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customerJourneySessions, fixtureGateJourneyIds } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const args = parseArgs(process.argv.slice(2))
const rawDayQuery = args.positionals[0]?.trim().toLowerCase() ?? ''
const normalizedDayQuery = rawDayQuery.replace(/\s+/g, '').replace('-', '')
const dateFilter = args.flags.date ?? ''

const sessions = customerJourneySessions.map((session) => ({
  id: session.id,
  aliases: session.aliases,
  label: session.shortLabel,
  focus: session.focus,
  journeyIds: session.journeyIds,
}))

const plannedJourneyIds = sessions.flatMap((session) => session.journeyIds)
const source = readFileSync(join(process.cwd(), resultsPath), 'utf8')
const ledgerRows = source
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => plannedJourneyIds.includes(row.journeyId))
  .filter((row) => !dateFilter || row.date === dateFilter)

const selectedSessions = selectSessions()

console.log('TenAceIQ Customer Journey Day Closeout')
console.log('')
console.log(`Source: ${resultsPath}`)
console.log('Use this at the end of a testing block before you call the day finished.')

if (dateFilter) {
  console.log(`Date filter: ${dateFilter}`)
}

console.log('')

if (!selectedSessions.length) {
  console.log(`No day matched "${rawDayQuery}".`)
  console.log('')
  console.log('Usage: npm run qa:close-day -- <day1 | day2 | day3 | day4 | day5> [--date=yyyy-mm-dd]')
  process.exit(1)
}

for (const session of selectedSessions) {
  printSessionCloseout(session)
}

console.log('Use with:')
console.log('- npm run qa:ledger-check')
console.log('- npm run qa:daily-summary -- <yyyy-mm-dd>')
console.log('- npm run qa:action-list')
console.log('- npm run qa:retest -- <day-or-journey>')
console.log('- npm run qa:next')
console.log('')
console.log('Closeout rule: a testing day is not closed until every journey has pass evidence, screenshots/video are recorded, and every open row has a next action or retest command.')

function selectSessions() {
  if (!rawDayQuery) return sessions

  return sessions.filter((session) => session.aliases.includes(normalizedDayQuery))
}

function printSessionCloseout(session) {
  const sessionRows = ledgerRows.filter((row) => session.journeyIds.includes(row.journeyId))
  const passJourneyIds = new Set(sessionRows.filter((row) => row.result === 'pass').map((row) => row.journeyId))
  const testedJourneyIds = new Set(sessionRows.map((row) => row.journeyId))
  const missingResultJourneyIds = session.journeyIds.filter((journeyId) => !testedJourneyIds.has(journeyId))
  const missingPassJourneyIds = session.journeyIds.filter((journeyId) => !passJourneyIds.has(journeyId))
  const openRows = sessionRows.filter((row) => row.result !== 'pass')
  const openFixtureRows = openRows.filter((row) => row.category === 'fixture-gap')
  const openHighPriorityRows = openRows.filter((row) => row.severity === 'p0' || row.severity === 'p1')
  const missingEvidenceRows = sessionRows.filter((row) => !row.screenshotOrVideo)
  const missingNextActionRows = openRows.filter((row) => !row.nextAction)
  const canClose =
    sessionRows.length > 0 &&
    missingResultJourneyIds.length === 0 &&
    missingPassJourneyIds.length === 0 &&
    missingEvidenceRows.length === 0 &&
    openHighPriorityRows.length === 0 &&
    missingNextActionRows.length === 0

  console.log(`${session.label}: ${canClose ? 'ready to close' : 'not ready to close'}`)
  console.log(`  Focus: ${session.focus}`)
  console.log(`  Rows logged: ${sessionRows.length}`)
  console.log(`  Pass journeys: ${passJourneyIds.size}/${session.journeyIds.length}`)
  console.log(`  Missing result rows: ${missingResultJourneyIds.length}`)
  console.log(`  Missing pass evidence: ${missingPassJourneyIds.length}`)
  console.log(`  Missing screenshot/video: ${missingEvidenceRows.length}`)
  console.log(`  Fixture blockers: ${openFixtureRows.length}`)
  console.log(`  Open p0/p1: ${openHighPriorityRows.length}`)
  console.log(`  Open rows missing next action: ${missingNextActionRows.length}`)
  console.log('  Journey closeout:')

  for (const journeyId of session.journeyIds) {
    const journeyRows = sessionRows.filter((row) => row.journeyId === journeyId)
    const hasPass = journeyRows.some((row) => row.result === 'pass')
    const hasEvidence = journeyRows.some((row) => row.screenshotOrVideo)
    const openJourneyRows = journeyRows.filter((row) => row.result !== 'pass')
    const marker = hasPass && hasEvidence && !openJourneyRows.some((row) => row.severity === 'p0' || row.severity === 'p1') ? 'closeable' : 'needs attention'

    console.log(`  - ${marker}: ${journeyId}`)

    if (!journeyRows.length) {
      console.log('    Need: log a real result row.')
    } else {
      if (!hasPass) console.log('    Need: fresh pass evidence.')
      if (!hasEvidence) console.log('    Need: screenshot/video evidence.')

      for (const row of openJourneyRows) {
        console.log(`    Open: ${row.severity || 'unscored'} ${row.result || 'unknown'} ${row.category || 'uncategorized'}`)
        if (row.category === 'fixture-gap') {
          console.log(`    Fixture gate: npm run qa:fixture-gate -- ${journeyId}`)
          if (fixtureGateJourneyIds.has(journeyId)) {
            console.log('    Auth env: npm run qa:fixture-auth-smoke -- --env')
            console.log('    Auth smoke: npm run qa:fixture-auth-smoke')
          }
        }
        console.log(`    Next: ${row.nextAction || 'add a next action before closeout'}`)
      }
    }
  }

  const retestJourneyIds = [...new Set([...missingPassJourneyIds, ...openRows.map((row) => row.journeyId)])]

  if (retestJourneyIds.length) {
    console.log('  Retest queue:')
    for (const journeyId of retestJourneyIds) {
      const hasFixtureBlocker = openFixtureRows.some((row) => row.journeyId === journeyId)
      if (hasFixtureBlocker && fixtureGateJourneyIds.has(journeyId)) {
        console.log(`  - npm run qa:fixture-gate -- ${journeyId}`)
        console.log('  - npm run qa:fixture-auth-smoke -- --env')
        console.log('  - npm run qa:fixture-auth-smoke')
        continue
      }
      console.log(`  - ${hasFixtureBlocker ? `npm run qa:fixture-gate -- ${journeyId}` : `npm run qa:retest -- ${journeyId}`}`)
    }
    console.log(`  - npm run qa:retest -- ${session.id}`)
  }

  console.log('')
}

function parseArgs(rawArgs) {
  const flags = {}
  const positionals = []

  for (const arg of rawArgs) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=')
      flags[key] = valueParts.join('=') || 'true'
    } else {
      positionals.push(arg)
    }
  }

  return { flags, positionals }
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
