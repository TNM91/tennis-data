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

test('the first-party profile builds and launches the isolated unsigned app',()=>{
 const profile = workflow.on.workflow_dispatch.inputs.profile
 assert.equal(profile.type,'choice')
 assert.deepEqual(profile.options,['standard','first-party'])
 assert.equal(profile.default,'standard')
 const simulator = workflow.jobs.simulator
 assert.match(simulator.env.TIQ_SIMULATOR_PROJECT,/inputs\.profile == 'first-party' && 'mobile\/ios-first-party\/App\/App\.xcodeproj' \|\| 'mobile\/ios\/App\/App\.xcodeproj'/)
 const find = name => simulator.steps.find(step=>step.name===name)
 const bundle = find('Bundle and verify first-party iOS project')
 const compile = find('Compile simulator app without signing')
 const pack = find('Package first-party simulator app')
 const boot = find('Boot a fresh first-party iPhone simulator')
 const install = find('Install first-party simulator app')
 const launch = find('Launch and capture first-party simulator app')
 const artifact = find('Save first-party simulator artifact')
 const stages = [bundle,compile,pack,boot,install,launch,artifact].map(step=>simulator.steps.indexOf(step))
 assert.ok(stages.every((index,stage)=>index>(stages[stage-1] ?? -1)))
 for(const command of ['build','prepare','check'])assert.ok(bundle.run.includes(`npm run ${command}:ios:first-party --prefix mobile`))
 assert.match(compile.run,/-project "\$TIQ_SIMULATOR_PROJECT"/)
 assert.match(boot.run,/simctl create 'TenAceIQ Offline'/)
 assert.match(install.run,/simctl install "\$TIQ_SIMULATOR_UDID"/)
 assert.match(launch.run,/simctl launch --terminate-running-process "\$DEVICE" com\.tenaceiq\.prototype\s/)
 assert.match(launch.run,/simctl io "\$DEVICE" screenshot/)
 assert.match(launch.run,/for attempt in \{1\.\.10\}/)
 assert.match(launch.run,/if node mobile\/scripts\/check-ios-first-party-launch\.mjs "\$SCREENSHOT"; then\s+exit 0/)
 assert.ok(boot['timeout-minutes']<=5)
 assert.ok(install['timeout-minutes']<=2)
 assert.ok(launch['timeout-minutes']<=3)
 assert.equal(artifact.with['retention-days'],3)
 assert.equal(bundle.if,"inputs.profile == 'first-party'")
 assert.equal(compile.if,'!inputs.device_only')
 for(const step of [pack,boot,install,launch])assert.equal(step.if,"inputs.profile == 'first-party' && !inputs.device_only")
 assert.equal(artifact.if,"(success() || failure()) && inputs.profile == 'first-party' && !inputs.device_only")
 for(const name of ['Bundle and generate iOS project','Add unsigned Debug runtime probe','Verify the launched StoreKit bridge','Save simulator artifact']){
  assert.match(find(name).if,/inputs\.profile != 'first-party'/)
 }
})

test('the optional iPhone SDK check compiles the offline Release without signing',()=>{
 const deviceOnly = workflow.on.workflow_dispatch.inputs.device_only
 assert.equal(deviceOnly.type,'boolean')
 assert.equal(deviceOnly.default,false)
 const steps = workflow.jobs.simulator.steps
 const reject = steps.find(step=>step.name==='Validate requested target')
 const device = steps.find(step=>step.name==='Compile and verify first-party iPhone target')
 assert.equal(reject.if,"inputs.device_only && inputs.profile != 'first-party'")
 assert.match(reject.run,/exit 1/)
 assert.equal(device.if,"inputs.profile == 'first-party' && inputs.device_only")
 assert.match(device.run,/prepare-ios-store\.mjs --first-party/)
 assert.match(device.run,/-configuration Release -sdk iphoneos -destination 'generic\/platform=iOS'/)
 assert.match(device.run,/CODE_SIGNING_ALLOWED=NO build/)
 assert.match(device.run,/lipo -archs .* = arm64/)
 assert.match(device.run,/diff -qr "\$APP\/public" mobile\/ios-first-party\/App\/App\/public/)
 assert.doesNotMatch(device.run,/simctl|altool|secrets\./)
 assert.ok(device['timeout-minutes']<=10)
})
