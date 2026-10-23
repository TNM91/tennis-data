import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const config = JSON.parse(await read('ios/App/App/capacitor.config.json'))
assert.equal(config.appId, 'com.tenaceiq.prototype')
assert.equal(config.webDir, 'bundled')
assert.ok(!config.server, 'iOS must not depend on a development server')
const spm = await read('ios/App/CapApp-SPM/Package.swift')
const scheme = await read('ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme')
assert.ok(scheme.includes('BlueprintName="App"') && scheme.includes('container:App.xcodeproj'), 'Expected a shared App scheme for CI')
for (const name of ['AparajitaCapacitorSecureStorage', 'CapacitorApp', 'CapacitorBrowser']) assert.ok(spm.includes(name), `Missing ${name}`)
const app = await read('ios/App/App/public/app.js')
assert.ok(app.length > 10000, 'Expected bundled client code')
const contents = JSON.parse(await read('ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json'))
assert.equal(contents.images[0].filename, 'tenaceiq-app-icon.png')
const hash = async url => createHash('sha256').update(await readFile(url)).digest('hex')
assert.equal(await hash(new URL('ios/App/App/Assets.xcassets/AppIcon.appiconset/tenaceiq-app-icon.png', root)),
  await hash(new URL('../../public/brand/icons/app-icon-1024.png', import.meta.url)), 'Icon must match approved source byte-for-byte')
console.log('iOS source checks passed: bundled assets, three SPM plugins, prototype ID, approved icon. This is not an Xcode build or device test.')
