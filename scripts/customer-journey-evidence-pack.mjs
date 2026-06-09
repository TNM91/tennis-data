import { customerJourneySessions, journeyById, normalizeQaQuery } from './customer-journey-qa-data.mjs'

const options = parseArgs(process.argv.slice(2))
const rawQuery = options.session.trim().toLowerCase()
const normalizedQuery = normalizeQaQuery(rawQuery)
const session = customerJourneySessions.find((item) => item.aliases.includes(normalizedQuery))

console.log('TenAceIQ Customer Journey Evidence Pack')
console.log('')

if (!session) {
  console.log('Usage: npm run qa:evidence-pack -- <day1 | day2 | day3 | day4 | day5>')
  console.log('       npm run qa:evidence-pack -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
  console.log('')
  console.log('Available sessions:')
  for (const item of customerJourneySessions) {
    console.log(`- ${item.id}: ${item.shortLabel} - ${item.focus}`)
  }
  process.exit(rawQuery ? 1 : 0)
}

const datePrefix = options.date || 'yyyy-mm-dd'
const deviceSlug = slugify(options.deviceBrowser || 'device')
const testerSlug = slugify(options.tester || 'tester')
const folder = `docs/qa-evidence/${datePrefix}/${session.id}`

console.log(`${session.shortLabel}: ${session.focus}`)
console.log(`Evidence folder: ${folder}`)
console.log('Evidence guide: docs/qa-evidence/README.md')
if (options.date || options.tester || options.deviceBrowser) {
  console.log(`Defaults: date=${options.date || 'blank'}, tester=${options.tester || 'blank'}, device/browser=${options.deviceBrowser || 'blank'}`)
}
console.log('')

console.log('Capture Names:')
for (const journeyId of session.journeyIds) {
  const journey = journeyById.get(journeyId)
  if (!journey) continue

  console.log(`- ${journey.label} (${journey.id})`)
  console.log(`  Route: ${journey.entryRoute}`)
  console.log(`  Fixture: ${journey.accountFixture}`)
  for (const evidenceName of journey.evidenceSlugs) {
    console.log(`  - ${folder}/${datePrefix}-${session.id}-${journey.id}-${evidenceName}-${deviceSlug}-${testerSlug}.png`)
  }
}
console.log('')

console.log('Ledger Evidence Cells:')
for (const journeyId of session.journeyIds) {
  const journey = journeyById.get(journeyId)
  if (!journey) continue

  const evidenceCell = journey.evidenceSlugs
    .map((evidenceName) => `${datePrefix}-${session.id}-${journey.id}-${evidenceName}-${deviceSlug}-${testerSlug}.png`)
    .join('; ')

  console.log(`- ${journey.id}: ${evidenceCell}`)
}
console.log('')

console.log('Use With:')
console.log('- npm run qa:evidence-index')
console.log(`- npm run qa:brief -- ${session.id}${formatDefaultsForCommand()}`)
console.log(`- npm run qa:day -- ${session.id}${formatDefaultsForCommand()}`)
console.log(`- npm run qa:close-day -- ${session.id}${options.date ? ` --date=${options.date}` : ''}`)
console.log('')
console.log('Closeout rule: evidence names should prove the journey signal, not just show that the route loaded.')

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

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
