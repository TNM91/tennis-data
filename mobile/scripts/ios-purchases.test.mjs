import test from 'node:test'
import assert from 'node:assert/strict'
import {iosPurchaseSources} from './ios-purchases.mjs'
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
