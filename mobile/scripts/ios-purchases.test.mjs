import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {iosPurchaseSources,iosPurchaseSceneDelegate} from './ios-purchases.mjs'
import {instrumentPurchaseSmoke,verifyPurchaseSmoke} from './ios-purchases-runtime-smoke.mjs'
const project=`/* Begin PBXBuildFile section */
/* Begin PBXFileReference section */
504EC3061FED79650016851F /* App */ = {
 isa = PBXGroup;
 children = (
 );
};
504EC3001FED79650016851F /* Sources */ = {
 isa = PBXSourcesBuildPhase;
 files = (
 );
};`
const storyboard='<viewController customClass="CAPBridgeViewController" customModule="Capacitor"/>'

test('the compiled bridge provides notification cleanup independently of APNs registration',()=>{
 const swift=readFileSync(new URL('../native/TenAceIQPurchases.swift',import.meta.url),'utf8')
 assert.match(swift,/registerPluginInstance\(TenAceIQNotifications\(\)\)/)
 assert.match(swift,/jsName = "TiqNotifications"/)
 assert.match(swift,/CAPPluginMethod\(name: "clearDelivered", returnType: CAPPluginReturnPromise\)/)
 const cleanup=swift.slice(swift.indexOf('@objc(TenAceIQNotifications)'),swift.indexOf('// A deadline covers'))
 assert.match(cleanup,/UNUserNotificationCenter.current\(\).removeAllDeliveredNotifications\(\)/)
 assert.doesNotMatch(cleanup,/registerForRemoteNotifications|requestAuthorization|appDelegateRegistrationCalled/)
 const instrumented=instrumentPurchaseSmoke(swift)
 assert.match(instrumented,/nativeColdStartNotificationsCleared:notificationsCleared/)
 assert.equal(instrumented.match(/await cap.Plugins.TiqNotifications.clearDelivered\(\)/g)?.length,2)
})
test('StoreKit registers a local plugin in the compiled target and refuses partial or unknown templates',()=>{
 const first=iosPurchaseSources(project,storyboard)
 assert.deepEqual(iosPurchaseSources(first.project,first.storyboard),first)
 assert.match(first.project,/TenAceIQPurchases.swift in Sources/)
 assert.match(first.storyboard,/customClass="TenAceIQBridgeViewController" customModule="App" customModuleProvider="target"/)
 assert.throws(()=>iosPurchaseSources('unknown',storyboard))
 assert.throws(()=>iosPurchaseSources(project,'unknown'))
 assert.throws(()=>iosPurchaseSources(first.project.replace('fileRef = 715100012026102800000001','fileRef = BAD'),first.storyboard))
 assert.throws(()=>iosPurchaseSources(first.project,first.storyboard.replace('customModule="App"','customModule="Wrong"')))
 assert.throws(()=>iosPurchaseSources(first.project.replace('715100012026102800000002 /* TenAceIQPurchases.swift in Sources */,',''),first.storyboard))
})

const scene=`import UIKit
import Capacitor
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
 var window: UIWindow?
 func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
  window?.rootViewController = CAPBridgeViewController()
  SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: options)
 }
}`
test('scene startup uses the controller that registers StoreKit and preserves scene forwarding',()=>{
 const generated=iosPurchaseSceneDelegate(scene)
 assert.match(generated,/rootViewController = TenAceIQBridgeViewController\(\)/)
 assert.match(generated,/SceneDelegateProxy.shared.scene\(scene, willConnectTo: session, options: options\)/)
 assert.doesNotMatch(generated,/rootViewController = CAPBridgeViewController\(/)
 assert.equal(iosPurchaseSceneDelegate(generated),generated)
})
test('scene registration refuses unknown or ambiguous startup paths',()=>{
 for(const source of ['unknown',scene.replace('CAPBridgeViewController()','UnknownController()'),scene.replace('window?.rootViewController =','window?.rootViewController = OtherController()\n  window?.rootViewController =')])assert.throws(()=>iosPurchaseSceneDelegate(source))
})

test('runtime smoke requires a real iOS JavaScript-to-native response, not just a registered file',()=>{
 const ready={ready:true,platform:'ios',available:true,nativeCoachFileExportBridgeVerified:true,nativeBiometricSignInLifecycleVerified:true,nativeBiometricSignInBridgeVerified:true,nativeColdStartNotificationsCleared:true,nativeInvalidReceiptRejected:true,nativeInvalidProductRequestRejected:true,nativeHistoryTimeoutRejected:true,nativePreparationTimeoutRejected:true,nativePreparationLockReleased:true,nativeConfirmationWaitUntimed:true,nativePreparationFailureTagged:true,nativeConfirmationFailureTagged:true,nativeCancellationResolved:true,nativeSandboxChannelVerified:true,nativeRestorePolicyVerified:true,nativeRestoreReadRecovery:true,nativeRestoreFailureTagged:true}
 assert.deepEqual(verifyPurchaseSmoke(ready),ready)
 for(const invalid of [{...ready,ready:false},{...ready,platform:'web'},{...ready,available:false},{...ready,nativeInvalidReceiptRejected:false},{...ready,nativeInvalidProductRequestRejected:false}])assert.throws(()=>verifyPurchaseSmoke(invalid))
 const swift=instrumentPurchaseSmoke(readFileSync(new URL('../native/TenAceIQPurchases.swift',import.meta.url),'utf8'))
 assert.match(swift,/import StoreKit\nimport WebKit/)
 assert.match(swift,/#if DEBUG/)
 assert.match(swift,/cap.Plugins.TiqPurchases.finish\(\{\}\)/)
 assert.throws(()=>instrumentPurchaseSmoke(swift))
 assert.throws(()=>instrumentPurchaseSmoke('unknown source'))
})

test('preparation deadlines cannot cancel Apple confirmation or allow an expired task to make a purchase',()=>{
 const swift=readFileSync(new URL('../native/TenAceIQPurchases.swift',import.meta.url),'utf8')
 assert.ok(swift.indexOf('gate.stopDeadline()')<swift.indexOf('product.purchase(confirmIn: presenter'))
 assert.match(swift,/guard !Task\.isCancelled, let self, self\.active, self\.deadlineActive/)
 assert.match(swift,/func stopDeadline\(\) \{ deadlineActive = false/)
 assert.match(swift,/window\.windowScene\?\.activationState == \.foregroundActive/)
 assert.match(swift,/presenter\.presentedViewController == nil/)
 assert.match(swift,/#available\(iOS 18\.2, \*\).*product\.purchase\(confirmIn: presenter/)
 assert.match(swift,/if self\.purchaseOperation == operation/)
 assert.doesNotMatch(swift,/tiqReadTimeoutSmoke|tiqReadDeadlineStoppedSmoke|tiq-storekit-smoke/)
 const report={ready:true,platform:'ios',available:true,nativeCoachFileExportBridgeVerified:true,nativeBiometricSignInLifecycleVerified:true,nativeBiometricSignInBridgeVerified:true,nativeColdStartNotificationsCleared:true,nativeInvalidReceiptRejected:true,nativeInvalidProductRequestRejected:true,nativeHistoryTimeoutRejected:true,nativePreparationTimeoutRejected:true,nativePreparationLockReleased:true,nativeConfirmationWaitUntimed:true,nativePreparationFailureTagged:true,nativeConfirmationFailureTagged:true,nativeCancellationResolved:true,nativeSandboxChannelVerified:true,nativeRestorePolicyVerified:true,nativeRestoreReadRecovery:true,nativeRestoreFailureTagged:true}
 for(const key of ['nativeColdStartNotificationsCleared','nativeHistoryTimeoutRejected','nativePreparationTimeoutRejected','nativePreparationLockReleased','nativeConfirmationWaitUntimed','nativePreparationFailureTagged','nativeConfirmationFailureTagged','nativeCancellationResolved','nativeSandboxChannelVerified','nativeRestorePolicyVerified','nativeRestoreReadRecovery','nativeRestoreFailureTagged'])assert.throws(()=>verifyPurchaseSmoke({...report,[key]:false}))
})

test('internal betas reject production and never require app-download verification',()=>{
 const swift=readFileSync(new URL('../native/TenAceIQPurchases.swift',import.meta.url),'utf8')
 assert.doesNotMatch(swift,/AppTransaction|tiqPurchaseChannelProbe/)
 assert.match(swift,/channel == "TestFlightInternalSandbox" && expected == "Sandbox"/)
 assert.match(swift,/environment == \.sandbox/)
 assert.match(swift,/transaction\.appBundleID == "com.tenaceiq.app"/)
 assert.match(swift,/transaction\.appAccountToken == token, self\.verifiedForBuild\(transaction\)/)
 assert.match(swift,/transaction\.appAccountToken == token, verifiedForBuild\(transaction\)/)
 assert.match(swift,/transaction\.appAccountToken != nil, verifiedForBuild\(transaction\)/)
 assert.match(swift,/guard matchesEnvironment\(call\) else/)
})

function runtimeProbe(invalidExportCode='invalid_export'){
 const source=instrumentPurchaseSmoke(readFileSync(new URL('../native/TenAceIQPurchases.swift',import.meta.url),'utf8'))
 const body=source.split('callAsyncJavaScript("""')[1].split('""", arguments:')[0]
 const evaluate=new (Object.getPrototypeOf(async function(){}).constructor)('window','purchaseChannel','restorePolicy','appLockPolicy',body)
 const fault=(code,supportCode)=>Object.assign(Error(code),{code,...(supportCode?{data:{supportCode}}:{})})
 let staged=null,shareResolve=null,finishCalls=0,shareCalls=0
 const cap={getPlatform:()=> 'ios',isPluginAvailable:()=>true,Plugins:{
  TiqPurchases:{
   finish:async()=>{finishCalls++;throw fault('receipt_mismatch')},products:async()=>{throw fault('environment_mismatch')},pending:async()=>{throw fault('purchase_history_timeout')},
   purchase:async args=>{if(args.tiqReadTimeoutSmoke)throw fault('purchase_preparation_timeout');if(args.tiqReadDeadlineStoppedSmoke||args.tiqPurchaseFailureSmoke==='cancel')return {state:'cancelled'};if(args.tiqPurchaseFailureSmoke==='confirmation')throw fault('store_unavailable','confirmation/SKErrorDomain:0');throw fault('purchase_preparation_failed','environment/NSURLErrorDomain:-1009')},
   restore:async args=>{if(args.tiqReadTimeoutSmoke)throw fault('restore_history_timeout');throw fault(args.tiqRestoreFailureSmoke==='cancel'?'restore_cancelled':'restore_unavailable','restore/StoreKit.StoreKitError:2')},
  },
  TiqFiles:{
   begin:async args=>{if(args.name.includes('..'))throw fault(invalidExportCode);if(staged)throw fault('export_busy');staged={...args,received:0}},
   append:async args=>{if(!staged||args.owner!==staged.owner||args.requestId!==staged.requestId||args.offset!==staged.received)throw fault('export_mismatch');staged.received+=Buffer.from(args.base64,'base64').length},
   share:async()=>{shareCalls++;return new Promise(resolve=>{shareResolve=resolve})},
   cancel:async()=>{staged=null;shareResolve?.({completed:false});shareResolve=null},
  },
  TiqBiometricSignIn:{status:async()=>({saved:false,available:true,biometry:'faceID'}),remember:async()=>{throw fault('invalid_credential')},signIn:async()=>{throw fault('invalid_request')},cancel:async()=>{}},
  TiqNotifications:{clearDelivered:async()=>{}},
 }}
 const page={Capacitor:cap}
 return {page,evaluate:()=>evaluate(page,true,true,true),counts:()=>({finishCalls,shareCalls})}
}

test('the native runtime probe retains one asynchronous job while a share promise is pending',async()=>{
 const probe=runtimeProbe()
 const pending=JSON.parse(await probe.evaluate());assert.equal(pending.complete,false)
 for(let i=0;i<3;i++)assert.equal(JSON.parse(await probe.evaluate()).complete,false)
 assert.ok(probe.page.__tiqNativeRuntimeSmoke.promise instanceof Promise)
 await probe.page.__tiqNativeRuntimeSmoke.promise
 await Promise.resolve()
 const report=JSON.parse(await probe.evaluate());assert.equal(report.complete,true);verifyPurchaseSmoke(report)
 assert.deepEqual(probe.counts(),{finishCalls:1,shareCalls:1})
 await probe.evaluate();assert.deepEqual(probe.counts(),{finishCalls:1,shareCalls:1})
})

test('the runtime report fails closed when file-owner validation does not reject correctly',async()=>{
 const probe=runtimeProbe('incorrect_rejection');await probe.evaluate();await probe.page.__tiqNativeRuntimeSmoke.promise;await Promise.resolve()
 const report=JSON.parse(await probe.evaluate());assert.equal(report.complete,true);assert.equal(report.nativeCoachFileExportBridgeVerified,false);assert.equal(report.ready,false);assert.throws(()=>verifyPurchaseSmoke(report))
})

test('the runtime probe waits for every required plugin before starting native actions',async()=>{
 const probe=runtimeProbe();probe.page.Capacitor.isPluginAvailable=name=>name!=='TiqFiles'
 const report=JSON.parse(await probe.evaluate());assert.equal(report.complete,false);assert.equal(report.stage,'waiting_for_plugins');assert.equal(probe.page.__tiqNativeRuntimeSmoke,undefined);assert.deepEqual(probe.counts(),{finishCalls:0,shareCalls:0})
})
