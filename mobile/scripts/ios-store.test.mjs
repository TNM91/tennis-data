import {cameraPrivacyPlist,cameraPurposeStrings} from './ios-camera.mjs'
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
    const project = 'CODE_SIGN_STYLE = Automatic; PRODUCT_BUNDLE_IDENTIFIER = com.tenaceiq.prototype; CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 1.0;\n'.repeat(2)
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
    const storeProject=await readFile(join(root,'ios/App/App.xcodeproj/project.pbxproj'),'utf8')
    assert.equal((storeProject.match(/PROVISIONING_PROFILE_SPECIFIER = \"\$\(TIQ_APP_PROFILE\)\";/g) || []).length,2)
    assert.equal((storeProject.match(/DEVELOPMENT_TEAM = \"\$\(TIQ_APP_TEAM\)\";/g) || []).length,2)
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
  const archive=steps.find(s=>s.name==='Archive and export signed IPA')
  assert.match(archive.run,/TIQ_APP_TEAM=\"\$TEAM\" TIQ_APP_PROFILE=\"\$UUID\" archive/)
  assert.doesNotMatch(archive.run,/\s(?:PROVISIONING_PROFILE_SPECIFIER|DEVELOPMENT_TEAM|CODE_SIGN_STYLE|CODE_SIGN_IDENTITY)=/)
  const upload = steps.find(s=>s.name==='Upload to App Store Connect')
  assert.equal(upload.if,'inputs.upload')
  assert.match(upload.run, /--output-format json/)
  assert.match(upload.run, /validate-altool-upload\.py/)
  const artifact = steps.find(s=>s.uses?.startsWith('actions/upload-artifact@'))
  assert.equal(artifact.with.path, '${{ runner.temp }}/tiq-export/App.ipa')
  assert.equal(steps.at(-1).if,'always()')
  assert.doesNotMatch(JSON.stringify(workflow), /-allowProvisioningUpdates|pull_request_target/)
})

test('camera purposes are top-level plist values even with nested scene dictionaries',()=>{
 const nested='<?xml version="1.0"?><plist version="1.0"><dict><key>UIApplicationSceneManifest</key><dict><key>Scene</key><array><dict><key>Name</key><string>Main</string></dict></array></dict></dict></plist>'
 const previous=nested.replace('</dict>',Object.entries(cameraPurposeStrings).map(([key,value])=>'<key>'+key+'</key><string>'+value+'</string>').join('')+'</dict>')
 for(const source of [nested,previous]){
  const result=cameraPrivacyPlist(source)
  assert.equal(cameraPrivacyPlist(result),result)
  const parsed=spawnSync(process.platform==='win32'?'python':'python3',['-c','import plistlib,sys,json; print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))'],{input:result,encoding:'utf8'})
  assert.equal(parsed.status,0,parsed.stderr)
  const root=JSON.parse(parsed.stdout)
  for(const [key,value] of Object.entries(cameraPurposeStrings)){assert.equal(root[key],value);assert.equal(root.UIApplicationSceneManifest.Scene[0][key],undefined)}
 }
 assert.throws(()=>cameraPrivacyPlist('<plist><string>Unexpected</string></plist>'))
})
