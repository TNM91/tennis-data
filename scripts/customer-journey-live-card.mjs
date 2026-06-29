import {
  customerJourneyDetails,
  fixtureGateJourneyIds,
  getFixtureAuthSmokeCommand,
  normalizeQaQuery,
  sessionByJourneyId,
} from './customer-journey-qa-data.mjs'

const options = parseArgs(process.argv.slice(2))
const rawQuery = options.query.trim().toLowerCase()
const normalizedQuery = normalizeQaQuery(rawQuery)

const resultsPath = 'docs/customer-journey-test-results.md'

const tierLabels = {
  free: 'Free',
  player_plus: 'Player+',
  coach: 'Coach',
  captain: 'Captain',
  league: 'TIQ League Coordinator/Admin',
  full_court: 'Full-Court',
  admin_internal: 'Admin/Internal',
}

const journeys = customerJourneyDetails

console.log('TenAceIQ Live Journey Test Card')
console.log('')
console.log('Use this for one active manual pass: route, task, evidence filenames, ledger row, and blocked-state commands.')
console.log('')

const matches = getMatches()

if (!matches.length) {
  if (rawQuery) {
    console.log(`No journey matched "${rawQuery}".`)
    console.log('')
  }
  printList()
  process.exit(rawQuery ? 1 : 0)
}

if (matches.length > 1) {
  console.log(`Matched ${matches.length} journeys for "${rawQuery}":`)
  console.log('')
  for (const journey of matches) {
    console.log(`- ${journey.id} (${tierLabels[journey.tierId]}, ${sessionByJourneyId.get(journey.id)?.id ?? 'unassigned'})`)
    console.log(`  Route: ${journey.entryRoute}`)
  }
  console.log('')
  console.log('Run again with a specific journey id for the one-screen live test card.')
  process.exit(0)
}

printLiveCard(matches[0])

function printLiveCard(journey) {
  const session = sessionByJourneyId.get(journey.id)
  const sessionId = session?.id ?? 'unassigned'
  const sessionLabel = session?.label ?? 'Unassigned'
  const defaults = {
    date: options.date || 'yyyy-mm-dd',
    tester: options.tester || '<tester>',
    deviceBrowser: options.deviceBrowser || '<device/browser>',
  }
  const evidenceFolder = `docs/qa-evidence/${defaults.date}/${sessionId}`
  const evidenceFiles = journey.evidenceSlugs.map((item) => `${defaults.date}-${sessionId}-${journey.id}-${item}-${slug(defaults.deviceBrowser)}-${slug(defaults.tester)}.png`)
  const fixtureAuthSmokeCommand = getFixtureAuthSmokeCommand(journey.accountFixture)

  console.log(`${journey.label} (${journey.id})`)
  console.log(`Session: ${sessionLabel} | Tier: ${tierLabels[journey.tierId]} | Risk: ${journey.risk}`)
  console.log(`Account fixture: ${journey.accountFixture}`)
  console.log(`Data fixtures: ${journey.fixtureIds.join(', ')}`)
  console.log(`Open: ${journey.entryRoute}`)
  console.log('')
  if (fixtureGateJourneyIds.has(journey.id)) {
    console.log('Fixture preflight:')
    console.log(`- npm run qa:fixture-gate -- ${journey.id}`)
    console.log('- npm run qa:fixture-auth-smoke -- --env')
    console.log(`- ${fixtureAuthSmokeCommand || 'npm run qa:fixture-auth-smoke'}`)
    console.log('')
  }
  console.log('Do this:')
  console.log(`- ${journey.liveTask}`)
  console.log('')
  console.log('Pass means:')
  console.log(`- ${journey.passSignal}`)
  console.log('')
  console.log('Stop and log an issue if:')
  for (const signal of journey.failFastSignals) console.log(`- ${signal}`)
  console.log('')
  console.log('Capture:')
  console.log(`Folder: ${evidenceFolder}`)
  for (const file of evidenceFiles) console.log(`- ${file}`)
  console.log('')
  console.log('Paste-ready ledger row:')
  console.log('| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |')
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  console.log(
    `| ${formatCell(defaults.date)} | ${formatCell(defaults.tester)} | ${formatCell(defaults.deviceBrowser)} | ${journey.accountFixture} | ${journey.id} | ${journey.entryRoute} | needs-follow-up |  |  | ${evidenceFiles.join('; ')} |  |  |`
  )
  console.log('')
  console.log('If blocked:')
  console.log('- redirected to login: sign in as `' + journey.accountFixture + '` first; run `npm run qa:fixture-auth-smoke -- --env` if local credential keys are unclear' + (fixtureAuthSmokeCommand ? ', then run `' + fixtureAuthSmokeCommand + '`.' : '.'))
  if (fixtureGateJourneyIds.has(journey.id)) {
    console.log('- auth smoke blocked: keep Result `blocked`, set Category `fixture-gap`, run `npm run qa:fixture-gate -- ' + journey.id + '`, then rerun this card after fixture repair.')
  }
  console.log('- fixture missing: set Category `fixture-gap`, run `npm run qa:fixture-gate -- ' + journey.id + '`, then rerun this card.')
  console.log('- fixture shape unclear: run `npm run qa:fixture-review -- ' + journey.accountFixture + '` before changing the ledger row.')
  console.log('- wrong tier access: set Category `access-gap` or `gating-gap`, run `npm run qa:access-review -- ' + journey.tierId + '`.')
  console.log('- page loads but does not solve the job: run `npm run qa:route-review -- ' + journey.entryRoute + '` and log the product gap.')
  console.log('')
  console.log('Close with:')
  console.log('- npm run qa:ledger-check')
  console.log(`- npm run qa:session-status -- ${sessionId}`)
  console.log(`- npm run qa:retest -- ${journey.id}`)
  console.log('')
  console.log(`Closeout rule: this live card is not done until ${resultsPath} has a real row and the evidence proves the pass signal.`)
}

function getMatches() {
  if (!rawQuery) return []

  const exact = journeys.find((journey) => normalizeQaQuery(journey.id) === normalizedQuery || normalizeQaQuery(journey.label) === normalizedQuery)
  if (exact) return [exact]

  const tierId = Object.entries(tierLabels).find(([id, label]) => normalizeQaQuery(id.replace(/_/g, '')) === normalizedQuery || normalizeQaQuery(label) === normalizedQuery)?.[0]
  if (tierId) return journeys.filter((journey) => journey.tierId === tierId)

  return journeys.filter((journey) => searchableText(journey).includes(rawQuery) || searchableText(journey).includes(normalizedQuery))
}

function printList() {
  console.log('Usage: npm run qa:live-card -- <journey-id | tier | search> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>')
  console.log('')
  console.log('Available live cards:')
  for (const journey of journeys) {
    console.log(`- ${journey.id} (${tierLabels[journey.tierId]}, ${sessionByJourneyId.get(journey.id)?.id ?? 'unassigned'})`)
  }
}

function searchableText(journey) {
  return [
    journey.id,
    journey.label,
    sessionByJourneyId.get(journey.id)?.id ?? '',
    journey.tierId,
    tierLabels[journey.tierId],
    journey.risk,
    journey.accountFixture,
    journey.entryRoute,
    journey.liveTask,
    journey.passSignal,
    ...journey.fixtureIds,
    ...journey.failFastSignals,
    ...journey.evidenceSlugs,
  ]
    .join(' ')
    .toLowerCase()
}

function parseArgs(args) {
  const parsed = {
    query: '',
    date: '',
    tester: '',
    deviceBrowser: '',
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? ''

    if (!arg.startsWith('--')) {
      parsed.query = [parsed.query, arg].filter(Boolean).join(' ')
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

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function slug(value) {
  return normalize(value || 'device')
}

function formatCell(value) {
  return value.trim().replace(/\|/g, '/')
}
