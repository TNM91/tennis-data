import { customerJourneyDetails, normalizeQaQuery } from './customer-journey-qa-data.mjs'

const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()
const normalizedQuery = rawQuery.replace(/\s+/g, '-')

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

function searchableText(journey) {
  return [
    journey.id,
    journey.label,
    journey.tierId,
    tierLabels[journey.tierId],
    journey.risk,
    journey.accountFixture,
    journey.entryRoute,
    ...journey.featureIds,
    ...journey.fixtureIds,
    ...journey.failFastSignals,
    ...journey.evidence,
  ]
    .join(' ')
    .toLowerCase()
}

function getMatches() {
  if (!rawQuery) return []

  const exact = journeys.find((journey) => normalizeQaQuery(journey.id) === normalizeQaQuery(rawQuery) || journey.label.toLowerCase() === rawQuery)
  if (exact) return [exact]

  const tierId = Object.entries(tierLabels).find(([id, label]) => {
    const normalizedLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    return id.replace(/_/g, '-') === normalizedQuery || normalizedLabel === normalizedQuery
  })?.[0]

  if (tierId) return journeys.filter((journey) => journey.tierId === tierId)

  return journeys.filter((journey) => searchableText(journey).includes(rawQuery))
}

function printList() {
  console.log('Usage: npm run qa:journey -- <journey-id | tier | search>')
  console.log('')
  console.log('Available journey cards:')
  for (const journey of journeys) {
    console.log(`- ${journey.id} (${tierLabels[journey.tierId]}, ${journey.risk})`)
  }
}

function printJourneyCard(journey) {
  console.log(`${journey.label} (${journey.id})`)
  console.log(`Tier: ${tierLabels[journey.tierId]} | Risk: ${journey.risk}`)
  console.log(`Persona fixture: ${journey.accountFixture}`)
  console.log(`Entry route: ${journey.entryRoute}`)
  console.log('')
  console.log(`Question: ${journey.primaryQuestion}`)
  console.log(`Pass signal: ${journey.passSignal}`)
  console.log('')
  console.log('Fail fast:')
  for (const signal of journey.failFastSignals) console.log(`- ${signal}`)
  console.log('')
  console.log('Evidence to capture:')
  for (const evidence of journey.evidence) console.log(`- ${evidence}`)
  console.log('')
  console.log(`Fixtures: ${journey.fixtureIds.join(', ')}`)
  console.log(`Features: ${journey.featureIds.join(', ')}`)
  console.log('')
  console.log('Use with:')
  console.log(`- npm run qa:focus -- ${journey.tierId}`)
  console.log('- npm run qa:fixtures')
  console.log('- npm run qa:evidence')
  console.log('- npm run qa:triage')
  console.log('- npm run qa:results')
  console.log('')
  console.log('Closeout rule: record every attempt in docs/customer-journey-test-results.md and do not mark pass until the evidence proves the pain point was solved.')
}

console.log('TenAceIQ Customer Journey Card')
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
  console.log(`Matched ${matches.length} journey cards for "${rawQuery}":`)
  console.log('')
  for (const journey of matches) {
    console.log(`- ${journey.id} (${tierLabels[journey.tierId]}, ${journey.risk})`)
    console.log(`  ${journey.label}`)
    console.log(`  Route: ${journey.entryRoute}`)
  }
  console.log('')
  console.log('Run again with a specific journey id for the full field card.')
  process.exit(0)
}

printJourneyCard(matches[0])
