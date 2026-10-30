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


test('the simulator launches and exercises StoreKit before saving its artifact',()=>{
 const steps=workflow.jobs.simulator.steps
 const prepare=steps.findIndex(s=>s.name==='Add unsigned Debug runtime probe'),compile=steps.findIndex(s=>s.name==='Compile simulator app without signing'),runtime=steps.findIndex(s=>s.name==='Verify the launched StoreKit bridge'),pack=steps.findIndex(s=>s.name==='Package simulator app')
 assert.ok(prepare>=0&&prepare<compile&&compile<runtime&&runtime<pack)
 const boot=steps.findIndex(s=>s.name==='Boot iPhone simulator before compiling')
 assert.ok(boot>prepare&&boot<compile)
 assert.ok(steps[boot]['timeout-minutes']<=4)
 assert.match(steps[boot].run,/TIQ_SIMULATOR_UDID/)
 assert.match(steps[runtime].run,/DEVICE="\$TIQ_SIMULATOR_UDID"/)
 assert.doesNotMatch(steps[runtime].run,/simctl bootstatus/)
 assert.ok(steps.find(s=>s.name==='Capture simulator diagnostics')['timeout-minutes']<=2)
 assert.match(steps[runtime].run,/simctl launch .*com\.tenaceiq\.prototype --tiq-storekit-smoke/)
 assert.match(steps[runtime].run,/ios-purchases-runtime-smoke\.mjs --verify/)
 assert.ok(steps[runtime]['timeout-minutes']<=6)
 assert.match(steps[pack].run,/ios-storekit-smoke\.json/)
})
