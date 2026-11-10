import {pushEntitlements} from './ios-push.mjs'
import {firstPartyCapacitorConfig,firstPartyIosDir} from './first-party-bundle.mjs'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

// Apply the store identity only to the generated native project. The simulator
// source/configuration stays a prototype, and a fresh CI checkout is required.
const root = new URL('../', import.meta.url)
const args = process.argv.slice(2)
const firstParty = args.length === 1 && args[0] === '--first-party'
assert.ok(args.length === 0 || firstParty, 'Unknown iOS store preparation option')
const ios = new URL((firstParty ? firstPartyIosDir : 'ios')+'/App/',root)
const configPath = new URL('App/capacitor.config.json', ios)
const config = JSON.parse(await readFile(configPath, 'utf8'))
assert.equal(config.appId, 'com.tenaceiq.prototype')
if(firstParty){
  assert.deepEqual(config,{...firstPartyCapacitorConfig,packageClassList:[]},'Expected the verified offline Capacitor configuration')
}else{
  assert.equal(config.webDir, 'bundled')
}
assert.ok(!config.server, 'Store builds must use bundled assets')
const build = process.env.TIQ_BUILD_NUMBER
assert.match(build || '', /^[1-9][0-9]{0,8}$/, 'Provide a positive build number of at most nine digits')
const distribution = process.env.TIQ_IOS_DISTRIBUTION ?? 'internal'
assert.ok(['internal','app-store'].includes(distribution), 'Unknown iOS distribution')
assert.ok(!firstParty || distribution === 'internal', 'The offline device candidate is internal-only')
const purchaseChannel = distribution === 'app-store' ? 'AppStore' : 'TestFlightInternalSandbox'
const projectPath = new URL('App.xcodeproj/project.pbxproj', ios)
const project = await readFile(projectPath, 'utf8')
assert.equal((project.match(/CODE_SIGN_STYLE = Automatic;/g) || []).length, 2, 'Expected only the two app signing configurations')
assert.equal((project.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.tenaceiq\.prototype;/g) || []).length, 2)
const infoPath = new URL('App/Info.plist', ios)
const info = await readFile(infoPath, 'utf8')
assert.doesNotMatch(info, /ITSAppUsesNonExemptEncryption|ITSEncryptionExportComplianceCode|TiqApplePurchaseChannel/, 'Review an existing encryption declaration instead of overwriting it')
assert.match(info, /<key>CFBundleDisplayName<\/key>\s*<string>TenAceIQ Prototype<\/string>/)
if(firstParty){
  assert.doesNotMatch(project,/CODE_SIGN_ENTITLEMENTS|SystemCapabilities|TenAceIQPurchases/,'Unexpected beta capabilities in the offline project')
  assert.doesNotMatch(info,/<key>(?:[^<]*UsageDescription|UIBackgroundModes|CFBundleURLTypes)<\/key>/,'Unexpected beta permissions in the offline project')
}
await writeFile(projectPath, project.replaceAll('PRODUCT_BUNDLE_IDENTIFIER = com.tenaceiq.prototype;', 'PRODUCT_BUNDLE_IDENTIFIER = com.tenaceiq.app;')
  .replaceAll('CODE_SIGN_STYLE = Automatic;', 'CODE_SIGN_STYLE = Manual;\n\t\t\t\tDEVELOPMENT_TEAM = "$(TIQ_APP_TEAM)";\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "$(TIQ_APP_PROFILE)";\n\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";')
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`)
  .replace(/MARKETING_VERSION = [^;]+;/g, 'MARKETING_VERSION = 1.0;'))
// The standard beta uses exempt OS encryption. The offline build has no custom encryption.
// https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption
const purchaseInfo = firstParty ? '' : `<key>TiqApplePurchaseChannel</key>\n\t<string>${purchaseChannel}</string>\n\t`
await writeFile(infoPath, info.replace('<key>CFBundleDisplayName</key>', `${purchaseInfo}<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n\t<key>CFBundleDisplayName</key>`).replace(/(<key>CFBundleDisplayName<\/key>\s*)<string>TenAceIQ Prototype<\/string>/, '$1<string>TenAceIQ</string>'))
await writeFile(configPath, JSON.stringify({...config, appId: 'com.tenaceiq.app', appName: 'TenAceIQ'}, null, 2) + '\n')
console.log('Prepared generated iOS project for TenAceIQ 1.0. Signing and device verification are still required.')

if(!firstParty)await writeFile(new URL('App/Push.entitlements',ios),pushEntitlements('production'))
