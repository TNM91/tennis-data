import test from 'node:test'
import assert from 'node:assert/strict'
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
 const ready={ready:true,platform:'ios',available:true,nativeInvalidReceiptRejected:true}
 assert.deepEqual(verifyPurchaseSmoke(ready),ready)
 for(const invalid of [{...ready,ready:false},{...ready,platform:'web'},{...ready,available:false},{...ready,nativeInvalidReceiptRejected:false}])assert.throws(()=>verifyPurchaseSmoke(invalid))
 const swift=instrumentPurchaseSmoke('import StoreKit\nbridge?.registerPluginInstance(TenAceIQPurchases())')
 assert.match(swift,/import StoreKit\nimport WebKit/)
 assert.match(swift,/#if DEBUG/)
 assert.match(swift,/cap.Plugins.TiqPurchases.finish\(\{\}\)/)
 assert.throws(()=>instrumentPurchaseSmoke(swift))
 assert.throws(()=>instrumentPurchaseSmoke('unknown source'))
})
