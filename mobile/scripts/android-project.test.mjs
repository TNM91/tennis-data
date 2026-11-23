import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeBundleTarget} from './native-bundle-target.mjs'
import {checkAndroidConfig,androidGradle} from './android-project.mjs'
import {googleBillingJava,googleBillingGradle,googleBillingVersion} from './android-google-billing.mjs'

test('Android packaging requires the full first-party app and a recognized distribution',()=>{
  for(const args of [['--android'],['--android','--first-party-preview'],['--android','--first-party-full','--first-party-preview']])assert.throws(()=>nativeBundleTarget(args,{}))
  assert.throws(()=>nativeBundleTarget(['--android','--first-party-full'],{TIQ_ANDROID_DISTRIBUTION:'production'}))
})
test('Android and iOS distribution settings stay independent',()=>{
  const args=['--android','--first-party-full']
  assert.equal(nativeBundleTarget(args,{TIQ_IOS_DISTRIBUTION:'app-store'}).tournamentPractice,true)
  assert.equal(nativeBundleTarget(args,{TIQ_IOS_DISTRIBUTION:'internal',TIQ_ANDROID_DISTRIBUTION:'store'}).tournamentPractice,false)
  assert.equal(nativeBundleTarget(['--first-party-full'],{TIQ_ANDROID_DISTRIBUTION:'internal',TIQ_IOS_DISTRIBUTION:'app-store'}).tournamentPractice,false)
  assert.equal(nativeBundleTarget(['--first-party-full'],{TIQ_IOS_DISTRIBUTION:'internal'}).tournamentPractice,true)
})
test('the iOS configuration remains the released prototype-shaped packaging input',()=>{
  assert.deepEqual(nativeBundleTarget(['--first-party-full'],{}).capacitorConfig,{appId:'com.tenaceiq.prototype',appName:'TenAceIQ Prototype',webDir:'bundled',loggingBehavior:'none',plugins:{PushNotifications:{presentationOptions:[]}}})
})
test('Android rejects server-loaded, mixed-content, debug-enabled and foreign-identity bundle configurations',()=>{
  const expected=nativeBundleTarget(['--android','--first-party-full'],{}).capacitorConfig,scope={platform:'android',profile:'first-party-full',distribution:'internal',version:1}
  checkAndroidConfig(expected,scope)
  for(const config of [{...expected,server:{url:'https://www.tenaceiq.com'}},{...expected,appId:'com.tenaceiq.prototype'},{...expected,android:{...expected.android,allowMixedContent:true}},{...expected,android:{...expected.android,webContentsDebuggingEnabled:true}}])assert.throws(()=>checkAndroidConfig(config,scope))
  assert.throws(()=>checkAndroidConfig(expected,{...scope,profile:'standard'}))
})
test('Gradle preparation preserves unknown projects rather than patching an unrelated identity or version',()=>{
  for(const source of ['android {}','namespace = "com.other.app"\napplicationId "com.other.app"\nversionCode 1\nversionName "1.0"\n    buildTypes {'])assert.throws(()=>androidGradle(source))
  const source='android {\nnamespace = "com.tenaceiq.app"\napplicationId "com.tenaceiq.app"\nversionCode 1\nversionName "1.0"\n    buildTypes {\n        release {\n        }\n    }\n}\ndependencies {\n}'
  const actual=androidGradle(source);assert.match(actual,/versionCode tiqBuildNumber\.toInteger\(\)/);assert.match(actual,/applicationIdSuffix "\.dev"/);assert.match(actual,/release \{\s+debuggable false/);assert.doesNotMatch(actual,/signingConfig signingConfigs\.debug/);assert.equal(androidGradle(actual),actual)
})

test('Google billing has one pinned SDK dependency and refuses an unexpected dependency version',()=>{
 const expected='dependencies {\n    implementation "com.android.billingclient:billing:'+googleBillingVersion+'"\n}'
 assert.equal(googleBillingGradle('dependencies {\n}'),expected)
 assert.equal(googleBillingGradle(expected),expected)
 assert.throws(()=>googleBillingGradle('dependencies {implementation "com.android.billingclient:billing:1.0.0"}'))
})

test('the native Google catalog derives approved prices and exposes no client acknowledgement or consumption',async()=>{
 const source=await googleBillingJava()
 for(const [id,micros]of [['com.tenaceiq.app.pro.monthly',4990000],['com.tenaceiq.app.tournament.publish',5000000],['com.tenaceiq.app.league.publish',25000000]])assert.ok(source.includes('specs.put("'+id+'", new Spec(')&&source.includes(micros+'L'))
 assert.doesNotMatch(source,/TIQ_PRODUCT_SPECS|acknowledgePurchase\(|consumeAsync\(|android\.util\.Log|Logger\./)
 assert.match(source,/includeSuspendedSubscriptions\(true\)/)
 assert.match(source,/!PACKAGE\.equals\(getContext\(\)\.getPackageName\(\)\)/)
})
