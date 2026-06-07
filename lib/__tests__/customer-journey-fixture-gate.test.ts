import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const packageSource = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
const qaStatusScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-qa-status.mjs'), 'utf8')
const gateScriptSource = readFileSync(join(process.cwd(), 'scripts/customer-journey-fixture-gate.mjs'), 'utf8')
const qaIndexSource = readFileSync(join(process.cwd(), 'docs/customer-journey-qa-index.md'), 'utf8')
const fixturesDocSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-fixtures.md'), 'utf8')
const resultsDocSource = readFileSync(join(process.cwd(), 'docs/customer-journey-test-results.md'), 'utf8')

describe('customer journey fixture gate', () => {
  it('adds an executable Day 1 coach-player fixture gate command', () => {
    expect(packageSource).toContain('"qa:fixture-gate": "node scripts/customer-journey-fixture-gate.mjs"')
    expect(qaStatusScriptSource).toContain('qa:fixture-gate')
    expect(qaIndexSource).toContain('npm run qa:fixture-gate')
    expect(fixturesDocSource).toContain('npm run qa:fixture-gate -- coach-player-assigned-challenge')
    expect(resultsDocSource).toContain('npm run qa:fixture-gate -- <journey|fixture|route|search>')
    expect(gateScriptSource).toContain('Day 1 Coach-Player Fixture Gate')
    expect(gateScriptSource).toContain('coach-player-assigned-challenge')
    expect(gateScriptSource).toContain('coach_primary')
    expect(gateScriptSource).toContain('player_plus_linked')
    expect(gateScriptSource).toContain('coach-invite-token')
    expect(gateScriptSource).toContain('level-up-assignment')
    expect(gateScriptSource).toContain('level-up-completion')
    expect(gateScriptSource).toContain('Coach review queue shows the same proof signal')
    expect(gateScriptSource).toContain('npm run qa:live-card -- coach-player-assigned-challenge')
  })

  it('keeps fixture-gap and sync-gap closeout rules visible', () => {
    expect(gateScriptSource).toContain('open fixture-gap')
    expect(gateScriptSource).toContain('if a ready signal is missing')
    expect(gateScriptSource).toContain('sync-gap or data-propagation-gap')
  })
})
