import {pushEntitlements} from './ios-push.mjs'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

// Apply the store identity only to the generated native project. The simulator
// source/configuration stays a prototype, and a fresh CI checkout is required.
const root = new URL('../', import.meta.url)
const configPath = new URL('ios/App/App/capacitor.config.json', root)
const config = JSON.parse(await readFile(configPath, 'utf8'))
assert.equal(config.appId, 'com.tenaceiq.prototype')
assert.equal(config.webDir, 'bundled')
assert.ok(!config.server, 'Store builds must use bundled assets')
const build = process.env.TIQ_BUILD_NUMBER
assert.match(build || '', /^[1-9][0-9]{0,8}$/, 'Provide a positive build number of at most nine digits')
const projectPath = new URL('ios/App/App.xcodeproj/project.pbxproj', root)
const project = await readFile(projectPath, 'utf8')
assert.equal((project.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.tenaceiq\.prototype;/g) || []).length, 2)
const infoPath = new URL('ios/App/App/Info.plist', root)
const info = await readFile(infoPath, 'utf8')
assert.doesNotMatch(info, /ITSAppUsesNonExemptEncryption|ITSEncryptionExportComplianceCode/, 'Review an existing encryption declaration instead of overwriting it')
assert.match(info, /<key>CFBundleDisplayName<\/key>\s*<string>TenAceIQ Prototype<\/string>/)
await writeFile(projectPath, project.replaceAll('PRODUCT_BUNDLE_IDENTIFIER = com.tenaceiq.prototype;', 'PRODUCT_BUNDLE_IDENTIFIER = com.tenaceiq.app;')
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`)
  .replace(/MARKETING_VERSION = [^;]+;/g, 'MARKETING_VERSION = 1.0;'))
// Standing beta declaration: current native dependencies use only exempt OS HTTPS/Keychain encryption.
// https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption
await writeFile(infoPath, info.replace('<key>CFBundleDisplayName</key>', '<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n\t<key>CFBundleDisplayName</key>').replace(/(<key>CFBundleDisplayName<\/key>\s*)<string>TenAceIQ Prototype<\/string>/, '$1<string>TenAceIQ</string>'))
await writeFile(configPath, JSON.stringify({...config, appId: 'com.tenaceiq.app', appName: 'TenAceIQ'}, null, 2) + '\n')
console.log('Prepared generated iOS project for TenAceIQ 1.0. Signing and device verification are still required.')

await writeFile(new URL('ios/App/App/Push.entitlements',root),pushEntitlements('production'))
