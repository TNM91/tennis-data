import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const resultsPath = 'docs/customer-journey-test-results.md'
const docsPath = 'docs/customer-journey-test-fixtures.md'
const rawQuery = process.argv.slice(2).join(' ').trim().toLowerCase()

const gates = [
  {
    id: 'coach-player-assigned-challenge',
    label: 'Day 1 Coach-Player Fixture Gate',
    journeyId: 'coach-player-assigned-challenge',
    route: '/coach',
    authCommands: ['npm run qa:fixture-auth-smoke -- coach_primary', 'npm run qa:fixture-auth-smoke -- player_plus_linked'],
    passCommand: 'npm run qa:live-card -- coach-player-assigned-challenge --date=2026-06-29 --tester=<name> --device=phone',
    rows: [
      {
        fixture: 'coach_primary',
        action: 'Sign in as the coach test account and open /coach; if you land on /login?next=/coach, authenticate before scoring readiness.',
        ready: 'Coach Hub loads with student management, assignment creation, and review queue controls.',
        evidence: 'Coach Hub screen with no stale upgrade lock.',
        blocked: 'Repair coach authentication, access, or Coach Hub entitlement before creating invites or assignments.',
      },
      {
        fixture: 'player_plus_linked',
        action: 'Sign in as the intended player and confirm the profile link used by My Lab and Level Up.',
        ready: 'Player can open /mylab and /player-development/relentless-competitor-4-0/level-up.',
        evidence: 'My Lab linked-player cue or Level Up player context.',
        blocked: 'Repair Player access or linked-player profile before accepting a coach invite.',
      },
      {
        fixture: 'coach-invite-token',
        action: 'From coach_primary, create a disposable invite and accept it as player_plus_linked.',
        ready: 'The invite page names the relationship and the coach sees the linked player.',
        evidence: 'Invite/link state, Linking proof privacy cue, Invite acceptance proof cue, and Coach invite account proof cue.',
        blocked: 'Create a fresh invite token, accept it with the intended player account, and confirm Coach Hub linked-player state.',
      },
      {
        fixture: 'level-up-assignment',
        action: 'From coach_primary, assign one exact Level Up card with a due date, coach note, and proof requirement.',
        ready: 'My Lab shows the assignment for the linked player only, with the exact card handoff.',
        evidence: 'Assignment id or assignment card with proof required.',
        blocked: 'Create one exact assigned card after the coach-player link exists; do not substitute a generic drill screenshot.',
      },
      {
        fixture: 'level-up-completion',
        action: 'As player_plus_linked, open the assigned card, save a 0-5 proof rating, and add one tiny note.',
        ready: 'Save status is honest: local, Player+ synced, or coach-invited synced.',
        evidence: 'Player challenge screen and proof rating/note state.',
        blocked: 'Complete the assigned card as the linked player and capture the save/sync status before coach review.',
      },
      {
        fixture: 'coach-review-proof',
        action: 'Return to coach_primary after completion.',
        ready: 'Coach review queue shows the same proof signal, note, due state, and next lesson implication.',
        evidence: 'Coach review proof sync cue and next-focus/next-assignment handoff.',
        blocked: 'If the player UI says synced but Coach Hub cannot review it, log sync-gap or data-propagation-gap instead of fixture-gap.',
      },
    ],
  },
]

const ledgerRows = readFileSync(join(process.cwd(), resultsPath), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('| ') && !line.includes('---'))
  .map(parseMarkdownRow)
  .filter((row) => row.journeyId && row.journeyId !== 'Journey ID')

const matchingGates = gates.filter((gate) => {
  if (!rawQuery) return true
  return [gate.id, gate.label, gate.journeyId, gate.route, ...gate.rows.flatMap((row) => [row.fixture, row.action, row.ready, row.evidence])]
    .join(' ')
    .toLowerCase()
    .includes(rawQuery)
})

console.log('TenAceIQ Fixture Gate')
console.log('')
console.log(`Sources: ${docsPath}; ${resultsPath}`)
console.log('Use this when a fixture-gap row needs to become a concrete browser setup pass.')
console.log('')

if (rawQuery) {
  console.log(`Filter: ${rawQuery}`)
  console.log('')
}

if (!matchingGates.length) {
  console.log(`No fixture gate matched "${rawQuery}".`)
  console.log('Usage: npm run qa:fixture-gate -- <journey | fixture | route | search>')
  process.exit(1)
}

for (const gate of matchingGates) {
  const rowsForJourney = ledgerRows.filter((row) => row.journeyId === gate.journeyId)
  const latestRow = rowsForJourney.at(-1)
  const hasPass = rowsForJourney.some((row) => row.result === 'pass' && row.screenshotOrVideo)
  const openFixtureGap = rowsForJourney.find((row) => row.result !== 'pass' && row.category === 'fixture-gap')

  console.log(`${gate.label} (${gate.journeyId})`)
  console.log(`Route: ${gate.route}`)
  console.log(`Ledger state: ${hasPass ? 'pass evidence logged' : openFixtureGap ? 'open fixture-gap' : latestRow ? latestRow.result : 'missing row'}`)
  if (openFixtureGap?.notes) console.log(`Current blocker: ${openFixtureGap.notes}`)
  console.log('')
  console.log('| Fixture | Provisioning action | Ready signal | Evidence to capture |')
  console.log('| --- | --- | --- | --- |')
  for (const row of gate.rows) {
    console.log(`| ${row.fixture} | ${row.action} | ${row.ready} | ${row.evidence} |`)
  }
  console.log('')
  console.log('If a ready signal is missing:')
  console.log('| Fixture | Keep blocked until this is repaired | Ledger category |')
  console.log('| --- | --- | --- |')
  for (const row of gate.rows) {
    const category = row.fixture === 'coach-review-proof' ? 'sync-gap or data-propagation-gap when sync is claimed; otherwise fixture-gap' : 'fixture-gap'
    console.log(`| ${row.fixture} | ${row.blocked} | ${category} |`)
  }
  console.log('')
  console.log('Pass command:')
  console.log('- npm run qa:fixture-auth-smoke -- --env')
  for (const command of gate.authCommands) console.log(`- ${command}`)
  console.log(`- ${gate.passCommand}`)
  console.log('')
}

console.log('Closeout rule: if a ready signal is missing, keep the journey blocked as fixture-gap. If proof says synced but the coach cannot review it, log sync-gap or data-propagation-gap.')

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
