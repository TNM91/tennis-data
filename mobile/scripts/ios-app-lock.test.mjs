import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {appLockPrivacyPlist,appLockPrivacyResource,faceIDPurpose} from './ios-app-lock.mjs'
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
test('native sign-in is explicit, device-local and ships no simulator evaluator',()=>{
 const source=readFileSync(new URL('../native/TenAceIQPurchases.swift',import.meta.url),'utf8')
 assert.match(source,/registerPluginInstance\(TenAceIQBiometricSignIn\(\)\)/)
 assert.doesNotMatch(source,/privacyWindow|tenaceiq-app-lock|willResignActiveNotification|didBecomeActiveNotification/)
 assert.match(source,/kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, \.biometryCurrentSet/)
 assert.match(source,/kSecAttrSynchronizable as String: false/)
 assert.match(source,/removeObject\(forKey: "tenaceiq.requireDeviceUnlock"\)/)
 assert.match(source,/evaluatePolicy\(\.deviceOwnerAuthenticationWithBiometrics/)
 assert.match(source,/self.context === candidate, self.generation == visit/)
 assert.doesNotMatch(source,/TiqSmokeLAContext|tiqBiometricSignInProbe/)
 const generated=instrumentAppLockSmoke(source)
 assert.match(generated,/#if DEBUG\s+private enum TiqSmokeBiometricVault/)
 assert.throws(()=>instrumentAppLockSmoke(generated))
 assert.throws(()=>instrumentAppLockSmoke('unrecognized source'))
 assert.equal(verifyAppLockSmoke({nativeBiometricSignInLifecycleVerified:true,nativeBiometricSignInBridgeVerified:true}),true)
 for(const report of [{},{nativeBiometricSignInLifecycleVerified:true},{nativeBiometricSignInBridgeVerified:true},{nativeBiometricSignInLifecycleVerified:false,nativeBiometricSignInBridgeVerified:true},{nativeBiometricSignInLifecycleVerified:true,nativeBiometricSignInBridgeVerified:false}])assert.throws(()=>verifyAppLockSmoke(report))
})

test('the app-owned settings privacy manifest is an idempotent app resource',()=>{
 const fixture=`/* Begin PBXBuildFile section */
/* Begin PBXFileReference section */
504EC3061FED79650016851F /* App */ = {
 isa = PBXGroup;
 children = (
 );
};
RESOURCES = {
 isa = PBXResourcesBuildPhase;
 files = (
 );
};`
 const result=appLockPrivacyResource(fixture)
 assert.equal(appLockPrivacyResource(result),result)
 assert.match(result,/PrivacyInfo.xcprivacy in Resources/)
 assert.throws(()=>appLockPrivacyResource('unknown'))
 assert.throws(()=>appLockPrivacyResource(fixture+'\nisa = PBXResourcesBuildPhase;'))
 assert.throws(()=>appLockPrivacyResource(result.replace('715100012026103000000011 /* PrivacyInfo.xcprivacy */,','')))
 const manifest=readFileSync(new URL('../native/PrivacyInfo.xcprivacy',import.meta.url),'utf8')
 const parsed=spawnSync(process.platform==='win32'?'python':'python3',['-c','import plistlib,sys,json; print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))'],{input:manifest,encoding:'utf8'})
 assert.equal(parsed.status,0,parsed.stderr)
 assert.deepEqual(JSON.parse(parsed.stdout),{NSPrivacyAccessedAPITypes:[{NSPrivacyAccessedAPIType:'NSPrivacyAccessedAPICategoryUserDefaults',NSPrivacyAccessedAPITypeReasons:['CA92.1']}]})
})
