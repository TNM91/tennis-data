import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {appLockPrivacyPlist,faceIDPurpose} from './ios-app-lock.mjs'
import {instrumentAppLockSmoke,verifyAppLockSmoke} from './ios-app-lock-runtime-smoke.mjs'

test('Face ID purpose is top-level, idempotent and refuses unknown permission copy',()=>{
 const source='<plist><dict><key>Scene</key><dict><key>Name</key><string>Main</string></dict></dict></plist>'
 const result=appLockPrivacyPlist(source)
 assert.equal(appLockPrivacyPlist(result),result)
 const parsed=spawnSync(process.platform==='win32'?'python':'python3',['-c','import plistlib,sys,json; print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))'],{input:result,encoding:'utf8'})
 assert.equal(parsed.status,0,parsed.stderr)
 assert.equal(JSON.parse(parsed.stdout).NSFaceIDUsageDescription,faceIDPurpose)
 assert.equal(JSON.parse(parsed.stdout).Scene.NSFaceIDUsageDescription,undefined)
 assert.throws(()=>appLockPrivacyPlist(result.replace(faceIDPurpose,'Custom purpose')))
 assert.throws(()=>appLockPrivacyPlist('<plist><string>Invalid</string></plist>'))
})
test('native lock authenticates setting changes and ships no simulator evaluator',()=>{
 const source=readFileSync(new URL('../native/TenAceIQPurchases.swift',import.meta.url),'utf8')
 assert.match(source,/registerPluginInstance\(TenAceIQAppLock\(\)\)/)
 assert.match(source,/evaluatePolicy\(\.deviceOwnerAuthentication/)
 assert.match(source,/self.context === candidate, visit == self.generation/)
 assert.doesNotMatch(source,/TiqSmokeLAContext|tiqAppLockProbe/)
 const generated=instrumentAppLockSmoke(source)
 assert.match(generated,/#if DEBUG\s+private final class TiqSmokeLAContext/)
 assert.throws(()=>instrumentAppLockSmoke(generated))
 assert.throws(()=>instrumentAppLockSmoke('unrecognized source'))
 assert.equal(verifyAppLockSmoke({nativeAppLockLifecycleVerified:true,nativeAppLockBridgeVerified:true}),true)
 for(const report of [{},{nativeAppLockLifecycleVerified:true},{nativeAppLockBridgeVerified:true}])assert.throws(()=>verifyAppLockSmoke(report))
})
