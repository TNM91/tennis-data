import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { customerJourneySessions, journeyById, normalizeQaQuery } from './customer-journey-qa-data.mjs'

const resultsPath = 'docs/customer-journey-test-results.md'
const options = parseArgs(process.argv.slice(2))
const rawQuery = options.session.trim().toLowerCase()
const normalizedQuery = normalizeQaQuery(rawQuery)
const ledgerRows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => journeyById.has(row.journeyId))

const session = customerJourneySessions.find((item) => item.aliases.includes(normalizedQuery)) ?? chooseNextSession()
const rankedSessionJourneys = session.journeyIds
  .map((journeyId) => scoreJourney(journeyById.get(journeyId)))
  .filter(Boolean)
  .sort((a, b) => b.score - a.score)
const topRisk = rankedSessionJourneys[0]

console.log('TenAceIQ Customer Journey Morning Brief')
console.log('')

if (!session) {
  console.log('Usage: npm run qa:brief -- <day1 | day2 | day3 | day4 | day5>')
  console.log('       npm run qa:brief -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
  process.exit(1)
}

console.log(`${session.shortLabel}: ${session.focus}`)
console.log(`Question: ${session.closeoutQuestion}`)
if (options.date || options.tester || options.deviceBrowser) {
  console.log(`Defaults: date=${options.date || 'blank'}, tester=${options.tester || 'blank'}, device/browser=${options.deviceBrowser || 'blank'}`)
}
console.log('')

console.log('Start Here:')
console.log(`- Top risk: ${topRisk ? `${topRisk.journey.label} (${topRisk.journey.id})` : 'No ranked journey found'}`)
console.log(`- Field card: npm run qa:journey -- ${topRisk?.journey.id ?? session.journeyIds[0]}`)
console.log(`- Session card: npm run qa:day -- ${session.id}${formatDefaultsForCommand()}`)
console.log(`- Risk board: npm run qa:risk-board -- ${session.id}`)
console.log('')

console.log('Fixture Check:')
for (const fixture of session.fixtureIds) console.log(`- ${fixture}`)
console.log('')

console.log('Journeys To Walk:')
for (const item of rankedSessionJourneys) {
  console.log(`- ${item.state}: ${item.journey.label}`)
  console.log(`  Route: ${item.journey.entryRoute}`)
  console.log(`  Pass: ${item.journey.passSignal}`)
}
console.log('')

console.log('Paste-ready ledger rows:')
console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
for (const journeyId of session.journeyIds) {
  const journey = journeyById.get(journeyId)
  if (!journey) continue

  console.log(
    `| ${formatCell(options.date)} | ${formatCell(options.tester)} | ${formatCell(options.deviceBrowser)} | ${journey.accountFixture} | ${journey.id} | ${journey.entryRoute} | needs-follow-up |  |  |  |  |  |`
  )
}
console.log('')

console.log('End The Block:')
console.log('- npm run qa:ledger-check')
console.log(`- npm run qa:session-status -- ${session.id}`)
console.log(options.date ? `- npm run qa:daily-summary -- ${options.date}` : '- npm run qa:daily-summary -- <yyyy-mm-dd>')
console.log(`- npm run qa:close-day -- ${session.id}${options.date ? ` --date=${options.date}` : ''}`)
console.log(`- npm run qa:retest -- ${session.id}`)
console.log('')
console.log('Closeout rule: begin with one high-risk proof gap, end with a ledger check and a close-day gate.')

function chooseNextSession() {
  const passedJourneyIds = new Set(ledgerRows.filter((row) => row.result === 'pass').map((row) => row.journeyId))

  return customerJourneySessions.find((item) => item.journeyIds.some((journeyId) => !passedJourneyIds.has(journeyId))) ?? customerJourneySessions[0]
}

function scoreJourney(journey) {
  if (!journey) return null

  const rows = ledgerRows.filter((row) => row.journeyId === journey.id)
  const hasPass = rows.some((row) => row.result === 'pass')
  const hasEvidence = rows.some((row) => row.screenshotOrVideo)
  const hasOpenHighPriority = rows.some((row) => row.result !== 'pass' && (row.severity === 'p0' || row.severity === 'p1'))
  const score =
    (hasOpenHighPriority ? 120 : 0) +
    (!hasPass ? 40 : 0) +
    (!hasEvidence ? 15 : 0) +
    (!rows.length ? 20 : 0) +
    riskScore(journey.risk) +
    journey.proofGapCount * 8
  const state = hasOpenHighPriority ? 'blocked' : !rows.length ? 'untested' : !hasPass ? 'needs pass' : !hasEvidence ? 'needs evidence' : 'pass logged'

  return { journey, score, state }
}

function riskScore(risk) {
  if (risk === 'critical') return 70
  if (risk === 'high') return 45
  return 20
}

function parseArgs(args) {
  const parsed = {
    session: '',
    date: '',
    tester: '',
    deviceBrowser: '',
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? ''

    if (!arg.startsWith('--')) {
      if (!parsed.session) parsed.session = arg
      continue
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=')
    const key = rawKey.trim().toLowerCase()
    const nextValue = args[index + 1] ?? ''
    const value = inlineValue ?? (nextValue.startsWith('--') ? '' : nextValue)

    if (inlineValue === undefined && value) index += 1

    if (key === 'date') parsed.date = value
    if (key === 'tester') parsed.tester = value
    if (key === 'device' || key === 'browser' || key === 'device-browser') parsed.deviceBrowser = value
  }

  return parsed
}

function formatDefaultsForCommand() {
  const parts = []
  if (options.date) parts.push(`--date=${options.date}`)
  if (options.tester) parts.push(`--tester=${options.tester}`)
  if (options.deviceBrowser) parts.push(`--device="${options.deviceBrowser}"`)

  return parts.length ? ` ${parts.join(' ')}` : ''
}

function formatCell(value) {
  return value.trim().replace(/\|/g, '/')
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
