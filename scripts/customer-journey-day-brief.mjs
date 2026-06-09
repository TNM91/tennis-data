import { customerJourneySessions, journeyById, normalizeQaQuery } from './customer-journey-qa-data.mjs'

const options = parseArgs(process.argv.slice(2))
const rawQuery = options.session.trim().toLowerCase()
const normalizedQuery = normalizeQaQuery(rawQuery)
const session = customerJourneySessions.find((item) => item.aliases.includes(normalizedQuery))

console.log('TenAceIQ Customer Journey Day Driver')
console.log('')

if (!session) {
  console.log('Usage: npm run qa:day -- <day1 | day2 | day3 | day4 | day5>')
  console.log('       npm run qa:day -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
  console.log('')
  console.log('Available sessions:')
  for (const item of customerJourneySessions) {
    console.log(`- ${item.id}: ${item.shortLabel} - ${item.focus}`)
  }
  process.exit(rawQuery ? 1 : 0)
}

console.log(`${session.shortLabel}: ${session.focus}`)
console.log(`Question: ${session.closeoutQuestion}`)
if (options.date || options.tester || options.deviceBrowser) {
  console.log(
    `Defaults: date=${options.date || 'blank'}, tester=${options.tester || 'blank'}, device/browser=${options.deviceBrowser || 'blank'}`
  )
}
console.log('')

console.log('Fixtures:')
for (const fixture of session.fixtureIds) console.log(`- ${fixture}`)
console.log('')

console.log('Walk these journeys:')
for (const journeyId of session.journeyIds) {
  const journey = journeyById.get(journeyId)
  if (!journey) continue

  console.log(`- ${journey.label} (${journey.id})`)
  console.log(`  Route: ${journey.entryRoute}`)
  console.log(`  Fixture: ${journey.accountFixture}`)
  console.log(`  Pass: ${journey.passSignal}`)
  console.log(`  Evidence: ${journey.evidence.join('; ')}`)
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

console.log('After testing:')
console.log('- npm run qa:ledger-check')
console.log(`- npm run qa:session-status -- ${session.id}`)
console.log(`- npm run qa:retest -- ${session.id}`)
console.log(options.date ? `- npm run qa:daily-summary -- ${options.date}` : '- npm run qa:daily-summary -- <yyyy-mm-dd>')
console.log('- npm run qa:results')
console.log('')
console.log('Closeout rule: do not mark pass unless the evidence proves the pain point was solved, not just that the page loaded.')

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

function formatCell(value) {
  return value.trim().replace(/\|/g, '/')
}
