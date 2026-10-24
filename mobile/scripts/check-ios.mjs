import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { iosIcon } from './ios-icon.mjs'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const config = JSON.parse(await read('ios/App/App/capacitor.config.json'))
assert.equal(config.appId, 'com.tenaceiq.prototype')
assert.equal(config.webDir, 'bundled')
assert.ok(!config.server, 'iOS must not depend on a development server')
const spm = await read('ios/App/CapApp-SPM/Package.swift')
const scheme = await read('ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme')
assert.ok(scheme.includes('BlueprintName="App"') && scheme.includes('container:App.xcodeproj'), 'Expected a shared App scheme for CI')
for (const name of ['AparajitaCapacitorSecureStorage', 'CapacitorApp', 'CapacitorBrowser', 'CapacitorPushNotifications', 'CapacitorCamera']) assert.ok(spm.includes(name), `Missing ${name}`)
const app = await read('ios/App/App/public/app.js')
assert.ok(app.length > 10000, 'Expected bundled client code')
const contents = JSON.parse(await read('ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json'))
assert.equal(contents.images[0].filename, 'tenaceiq-app-icon.png')
const actualIcon = await readFile(new URL('ios/App/App/Assets.xcassets/AppIcon.appiconset/tenaceiq-app-icon.png', root))
assert.equal((await sharp(actualIcon).metadata()).hasAlpha, false, 'App Store icon must not contain alpha')
assert.deepEqual(await sharp(actualIcon).raw().toBuffer(), await sharp(await iosIcon()).raw().toBuffer(), 'Icon must preserve approved artwork on the brand navy tile')
console.log('iOS source checks passed: bundled assets, five SPM plugins, prototype ID, approved icon. This is not an Xcode build or device test.')

assert.match(await read('ios/App/App/Push.entitlements'), /<key>aps-environment<\/key><string>development<\/string>/)
assert.match(await read('ios/App/App/AppDelegate.swift'), /capacitorDidRegisterForRemoteNotifications/)
assert.equal(((await read('ios/App/App.xcodeproj/project.pbxproj')).match(/CODE_SIGN_ENTITLEMENTS = App\/Push.entitlements;/g) || []).length,2)

for(const key of ['NSCameraUsageDescription','NSPhotoLibraryUsageDescription','NSPhotoLibraryAddUsageDescription'])assert.ok((await read('ios/App/App/Info.plist')).includes('<key>'+key+'</key>'))
