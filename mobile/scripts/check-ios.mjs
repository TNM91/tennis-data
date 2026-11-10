import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import sharp from 'sharp'
import { iosIcon } from './ios-icon.mjs'
import {checkFirstPartyBundle,firstPartyAssets,firstPartyCapacitorConfig,firstPartyIosDir,firstPartyWebDir} from './first-party-bundle.mjs'

const root = new URL('../', import.meta.url)
const firstParty = process.argv.includes('--first-party')
const fullApp = process.argv.includes('--first-party-full')
assert.ok(!firstParty||!fullApp,'Choose one first-party iOS profile')
const ios = new URL((firstParty ? firstPartyIosDir : 'ios')+'/App/',root)
const read = path => readFile(new URL(path, ios), 'utf8')
const config = JSON.parse(await read('App/capacitor.config.json'))
assert.equal(config.appId, 'com.tenaceiq.prototype')
assert.equal(config.webDir, firstParty ? firstPartyWebDir : 'bundled')
assert.ok(!config.server, 'iOS must not depend on a development server')
if(firstParty){
  assert.deepEqual(config,{...firstPartyCapacitorConfig,packageClassList:[]},'Unexpected configuration or native plugin registration in the offline app')
  await checkFirstPartyBundle(fileURLToPath(new URL(firstPartyWebDir+'/',root)))
  const packedDir = new URL('App/public/',ios)
  const packedEntries = await readdir(packedDir,{recursive:true,withFileTypes:true})
  const packedFiles = packedEntries.filter(entry=>!entry.isDirectory())
  // Capacitor generates these two empty shims even when no plugins are included.
  const emptyShims = ['cordova.js','cordova_plugins.js']
  assert.ok(packedFiles.every(entry=>entry.isFile()),'Unexpected link or device in offline app resources')
  assert.equal(packedFiles.length,firstPartyAssets.length+emptyShims.length,'Unexpected files in offline app resources')
  for(const file of firstPartyAssets){
    const packed = await readFile(new URL(file,packedDir))
    const source = await readFile(new URL(firstPartyWebDir+'/'+file,root))
    assert.deepEqual(packed,source,'Packaged first-party asset differs: '+file)
  }
  for(const shim of emptyShims)assert.equal((await readFile(new URL(shim,packedDir))).length,0,`Unexpected Cordova code in ${shim}`)
}
const spm = await read('CapApp-SPM/Package.swift')
const scheme = await read('App.xcodeproj/xcshareddata/xcschemes/App.xcscheme')
assert.ok(scheme.includes('BlueprintName="App"') && scheme.includes('container:App.xcodeproj'), 'Expected a shared App scheme for CI')
const app = await read('App/public/app.js')
assert.ok(app.length > (firstParty ? 1000 : 10000), 'Expected bundled client code')
assert.match(await read('App/public/index.html'), /href="\.\/app\.css"/)
assert.ok((await read('App/public/app.css')).length > 1000, 'Expected bundled client styles')
const contents = JSON.parse(await read('App/Assets.xcassets/AppIcon.appiconset/Contents.json'))
assert.equal(contents.images[0].filename, 'tenaceiq-app-icon.png')
const actualIcon = await readFile(new URL('App/Assets.xcassets/AppIcon.appiconset/tenaceiq-app-icon.png', ios))
assert.equal((await sharp(actualIcon).metadata()).hasAlpha, false, 'App Store icon must not contain alpha')
assert.deepEqual(await sharp(actualIcon).raw().toBuffer(), await sharp(await iosIcon()).raw().toBuffer(), 'Icon must preserve approved artwork on the brand navy tile')
const project = await read('App.xcodeproj/project.pbxproj')
const storyboard = await read('App/Base.lproj/Main.storyboard')
const sceneDelegate = await read('App/SceneDelegate.swift')

if(firstParty){
  const packages = spm.match(/\.package\([^\r\n)]*\)/g) ?? []
  assert.equal(packages.length,1,'The offline project must use only the pinned Capacitor Swift package')
  assert.match(packages[0],/^\.package\(url: "https:\/\/github\.com\/ionic-team\/capacitor-swift-pm\.git", exact: "\d+\.\d+\.\d+"\)$/)
  assert.deepEqual(spm.match(/\.product\([^\r\n)]*\)/g),[
    '.product(name: "Capacitor", package: "capacitor-swift-pm")',
    '.product(name: "Cordova", package: "capacitor-swift-pm")',
  ],'The offline target must link only the core Capacitor products')
  assert.doesNotMatch(project,/CODE_SIGN_ENTITLEMENTS|SystemCapabilities|TenAceIQPurchases|PrivacyInfo\.xcprivacy/)
  assert.doesNotMatch(await read('App/Info.plist'),/<key>(?:[^<]*UsageDescription|UIBackgroundModes|CFBundleURLTypes|TiqApplePurchaseChannel)<\/key>/)
  assert.doesNotMatch(await read('App/AppDelegate.swift'),/didRegisterForRemoteNotifications|didFailToRegisterForRemoteNotifications/)
  assert.match(storyboard,/customClass="CAPBridgeViewController" customModule="Capacitor"/)
  assert.match(sceneDelegate,/rootViewController = CAPBridgeViewController\(\)/)
  assert.doesNotMatch(storyboard+sceneDelegate,/TenAceIQBridgeViewController/)
  const targetFiles = await readdir(new URL('App/',ios))
  assert.ok(!targetFiles.some(name=>name.endsWith('.entitlements') || name==='TenAceIQPurchases.swift' || name==='PrivacyInfo.xcprivacy'),'Unexpected beta files in the offline target')
  console.log('Offline iOS source checks passed: exact bundled assets, core Capacitor only, default bridge, no app entitlements or permission strings, and approved icon.')
}else{
  const scope = await read('App/public/release-scope.json').catch(error=>{if(error.code!=='ENOENT')throw error;return null})
  if(fullApp){
    assert.deepEqual(JSON.parse(scope),{profile:'first-party-full',version:1})
    for(const file of ['app.js','release-scope.json'])assert.equal(await read('App/public/'+file),await readFile(new URL('bundled/'+file,root),'utf8'))
    for(const route of ['competitions','tournaments','team-rooms','team-invites','calendar','updates'])assert.ok(app.includes('/api/mobile/first-party/'+route),'Missing scoped '+route+' route')
  }else assert.equal(scope,null,'A first-party bundle must use its dedicated signing profile')
  for (const name of ['AparajitaCapacitorSecureStorage', 'CapacitorApp', 'CapacitorBrowser', 'CapacitorPushNotifications', 'CapacitorCamera', 'CapacitorShare', 'CapacitorClipboard']) assert.ok(spm.includes(name), `Missing ${name}`)
  assert.match(await read('App/Push.entitlements'), /<key>aps-environment<\/key><string>development<\/string>/)
  assert.match(await read('App/AppDelegate.swift'), /capacitorDidRegisterForRemoteNotifications/)
  assert.equal((project.match(/CODE_SIGN_ENTITLEMENTS = App\/Push.entitlements;/g) || []).length,2)

  const privacy=spawnSync(process.platform==='win32'?'python':'python3',[fileURLToPath(new URL('scripts/validate-ios-privacy.py',root)),fileURLToPath(new URL('App/Info.plist',ios))],{encoding:'utf8'})
  assert.equal(privacy.status,0,privacy.stderr || privacy.error?.message || 'Camera privacy plist validation failed')
  console.log(privacy.stdout.trim())

  assert.match(storyboard,/customClass="TenAceIQBridgeViewController"/)
  assert.deepEqual(await readFile(new URL('App/TenAceIQPurchases.swift',ios)),await readFile(new URL('native/TenAceIQPurchases.swift',root)))
  assert.deepEqual(await readFile(new URL('App/PrivacyInfo.xcprivacy',ios)),await readFile(new URL('native/PrivacyInfo.xcprivacy',root)))
  assert.match(project,/PrivacyInfo.xcprivacy in Resources/)
  assert.match(project,/TenAceIQPurchases.swift in Sources/)
  assert.equal((sceneDelegate.match(/window\?\.rootViewController = TenAceIQBridgeViewController\(\)/g)||[]).length,1,'The launched scene must use the StoreKit bridge controller')
  assert.doesNotMatch(sceneDelegate,/rootViewController = CAPBridgeViewController\(/,'The default scene controller skips local StoreKit registration')
  console.log('Standard iOS source checks passed: bundled assets, seven SPM plugins, StoreKit bridge, and approved icon.')
}
