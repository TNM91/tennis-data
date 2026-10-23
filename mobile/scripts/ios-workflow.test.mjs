import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Root npm ci supplies the YAML parser used by the repository's lint tools.
const require = createRequire(new URL('../../package.json', import.meta.url))
const { load } = require('js-yaml')
const workflow = load(readFileSync(new URL('../../.github/workflows/mobile-ios-simulator.yml', import.meta.url), 'utf8'))

test('Mac builds remain manual, bounded, and read-only', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch', 'pull_request'])
  assert.deepEqual(workflow.on.pull_request.types, ['labeled'])
  assert.equal(workflow.jobs.simulator.if, "github.event_name == 'workflow_dispatch' || github.event.label.name == 'ios-simulator'")
  assert.deepEqual(workflow.permissions, {contents: 'read'})
  assert.deepEqual(Object.keys(workflow.jobs), ['simulator'])
  assert.ok(workflow.jobs.simulator['timeout-minutes'] <= 25)
  assert.equal(workflow.concurrency['cancel-in-progress'], true)
  const artifact = workflow.jobs.simulator.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))
  assert.equal(artifact.with.path, 'mobile/ios-simulator.zip')
  assert.ok(artifact.with['retention-days'] <= 3)
})

test('the simulator lane cannot archive, sign, or upload to Apple', () => {
  const commands = workflow.jobs.simulator.steps.map(step => step.run || '').join('\n')
  assert.match(commands, /-sdk iphonesimulator/)
  assert.match(commands, /CODE_SIGNING_ALLOWED=NO build/)
  assert.doesNotMatch(commands, /-allowProvisioningUpdates|-exportArchive|\baltool\b|\bfastlane\b|\barchive\b/)
  assert.doesNotMatch(JSON.stringify(workflow), /secrets\./)
})
