import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../package.json', import.meta.url))
const { load } = require('js-yaml')

test('store preparation updates generated app identity and rejects unsafe input', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tiq-store-'))
  try {
    await mkdir(join(root, 'scripts'))
    await mkdir(join(root, 'ios/App/App.xcodeproj'), {recursive:true})
    await mkdir(join(root, 'ios/App/App'), {recursive:true})
    await copyFile(new URL('prepare-ios-store.mjs', import.meta.url), join(root, 'scripts/prepare-ios-store.mjs'))
    await copyFile(new URL('ios-push.mjs', import.meta.url), join(root, 'scripts/ios-push.mjs'))
    const config = {appId:'com.tenaceiq.prototype', webDir:'bundled', loggingBehavior:'none'}
    const configPath = join(root, 'ios/App/App/capacitor.config.json')
    await writeFile(configPath, JSON.stringify(config))
    const project = 'PRODUCT_BUNDLE_IDENTIFIER = com.tenaceiq.prototype; CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 1.0;\n'.repeat(2)
    await writeFile(join(root, 'ios/App/App.xcodeproj/project.pbxproj'), project)
    await writeFile(join(root, 'ios/App/App/Info.plist'), '<key>CFBundleDisplayName</key><string>TenAceIQ Prototype</string>')
    const run = number => spawnSync(process.execPath, [join(root,'scripts/prepare-ios-store.mjs')], {env:{...process.env, TIQ_BUILD_NUMBER:number}, encoding:'utf8'})
    assert.notEqual(run('1; echo unsafe').status, 0)
    assert.deepEqual(JSON.parse(await readFile(configPath, 'utf8')), config)
    await writeFile(configPath, JSON.stringify({...config, server:{url:'http://localhost'}}))
    assert.notEqual(run('12').status, 0)
    await writeFile(configPath, JSON.stringify(config))
    const result = run('12')
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(await readFile(configPath,'utf8')).appId, 'com.tenaceiq.app')
    assert.equal((await readFile(join(root,'ios/App/App.xcodeproj/project.pbxproj'),'utf8')).includes('CURRENT_PROJECT_VERSION = 12;'), true)
    assert.match(await readFile(join(root, 'ios/App/App/Info.plist'),'utf8'), /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/)
    assert.match(await readFile(join(root,'ios/App/App/Push.entitlements'),'utf8'), /<string>production<\/string>/)
    assert.notEqual(run('13').status, 0, 'Refuse reusing a modified store project')
  } finally { await rm(root, {recursive:true, force:true}) }
})

test('signed workflow restricts secret use and defaults to no upload', async () => {
  const workflow = load(await readFile(new URL('../../.github/workflows/mobile-ios-signed.yml',import.meta.url),'utf8'))
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch'])
  assert.equal(workflow.on.workflow_dispatch.inputs.upload.default, false)
  assert.equal(workflow.jobs.signed.environment, 'apple-testflight')
  assert.match(workflow.jobs.signed.if, /github\.repository == 'TNM91\/tennis-data'/)
  assert.deepEqual(workflow.permissions, {contents:'read'})
  assert.equal(workflow.concurrency['cancel-in-progress'], false)
  const steps = workflow.jobs.signed.steps
  assert.equal(steps.find(s=>s.uses?.startsWith('actions/checkout@')).with['persist-credentials'],false)
  const upload = steps.find(s=>s.name==='Upload to App Store Connect')
  assert.equal(upload.if,'inputs.upload')
  assert.match(upload.run, /--output-format json/)
  assert.match(upload.run, /validate-altool-upload\.py/)
  const artifact = steps.find(s=>s.uses?.startsWith('actions/upload-artifact@'))
  assert.equal(artifact.with.path, '${{ runner.temp }}/tiq-export/App.ipa')
  assert.equal(steps.at(-1).if,'always()')
  assert.doesNotMatch(JSON.stringify(workflow), /-allowProvisioningUpdates|pull_request_target/)
})
