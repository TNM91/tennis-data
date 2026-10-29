import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'

// Instrument only the generated unsigned Debug project, never the shipped source.
export function instrumentPurchaseSmoke(source){
 const marker='bridge?.registerPluginInstance(TenAceIQPurchases())'
 assert.equal(source.split(marker).length,2,'Expected one local purchase registration')
 assert.ok(!source.includes('tiq-storekit-smoke.json'),'Refuse duplicate smoke instrumentation')
 const purchaseMarker='let gate = TiqStoreRead(call, nanoseconds: 30_000_000_000, code: "purchase_preparation_timeout")'
 const historyMarker='let gate = TiqStoreRead(call, nanoseconds: 15_000_000_000, code: "purchase_history_timeout")'
 assert.equal(source.split(purchaseMarker).length,2,'Expected one bounded purchase preparation')
 assert.equal(source.split(historyMarker).length,2,'Expected one bounded history read')
 source=source.replace(purchaseMarker,purchaseMarker.replace('30_000_000_000','(call.getBool("tiqReadTimeoutSmoke") == true ? 5_000_000 : 30_000_000_000)'))
 source=source.replace(historyMarker,historyMarker.replace('15_000_000_000','(call.getBool("tiqReadTimeoutSmoke") == true ? 5_000_000 : 15_000_000_000)'))
 assert.equal(source.split('gate.start { gate in').length,3,'Expected purchase and history read tasks')
 source=source.replaceAll('gate.start { gate in',`gate.start { gate in
                #if DEBUG
                if call.getBool("tiqReadTimeoutSmoke") == true {
                    do { try await Task.sleep(nanoseconds: 250_000_000) } catch { }
                    gate.resolve(["unexpectedLateSuccess": true])
                    return
                }
                #endif`)
 const before=String.raw`
        #if DEBUG
        let startedURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("tiq-storekit-smoke.json.started")
        try? FileManager.default.createDirectory(at: startedURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? Data(#"{"controllerEntered":true}"#.utf8).write(to: startedURL, options: .atomic)
        #endif
        `
 return source.replace('import StoreKit','import StoreKit\nimport WebKit').replace(marker,before+marker+String.raw`
        #if DEBUG
        do {
            let reportURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("tiq-storekit-smoke.json")
            try? FileManager.default.createDirectory(at: reportURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? Data(#"{"controllerEntered":true,"pluginRegistered":true}"#.utf8).write(to: reportURL.appendingPathExtension("started"), options: .atomic)
            Task { @MainActor [weak self] in
                for _ in 0..<120 {
                    if let webView = self?.webView, webView.url != nil, !webView.isLoading, self?.viewIfLoaded?.window != nil,
                       let value = try? await webView.callAsyncJavaScript("""
                           const cap = window.Capacitor;
                           if (cap?.getPlatform?.() !== 'ios' || !cap.isPluginAvailable('TiqPurchases') || !cap.Plugins?.TiqPurchases) return null;
                           let rejected = false;
                           try {
                               await Promise.race([cap.Plugins.TiqPurchases.finish({}), new Promise((_, reject) => setTimeout(() => reject(new Error('bridge_timeout')), 2000))]);
                           } catch (error) { rejected = error.code === 'receipt_mismatch'; }
                           let productRejected = false;
                           try {
                               await Promise.race([cap.Plugins.TiqPurchases.products({environment: 'invalid'}), new Promise((_, reject) => setTimeout(() => reject(new Error('bridge_timeout')), 2000))]);
                           } catch (error) { productRejected = error.code === 'environment_mismatch'; }
                           const expires = async (method, args, code) => {
                               try { await Promise.race([cap.Plugins.TiqPurchases[method](args), new Promise((_, reject) => setTimeout(() => reject(new Error('bridge_timeout')), 2000))]); return false; }
                               catch (error) { return error.code === code; }
                           };
                           const historyTimeout = await expires('pending', {tiqReadTimeoutSmoke: true}, 'purchase_history_timeout');
                           const purchaseArgs = {productId:'com.tenaceiq.app.player.monthly', accountToken:'11111111-1111-4111-8111-111111111111', environment:'Sandbox', tiqReadTimeoutSmoke:true};
                           const prepareTimeout = await expires('purchase', purchaseArgs, 'purchase_preparation_timeout');
                           const retryTimeout = await expires('purchase', purchaseArgs, 'purchase_preparation_timeout');
                           return JSON.stringify({ready: rejected && productRejected && historyTimeout && prepareTimeout && retryTimeout, platform: cap.getPlatform(), available: true, nativeInvalidReceiptRejected: rejected, nativeInvalidProductRequestRejected: productRejected, nativeHistoryTimeoutRejected:historyTimeout, nativePreparationTimeoutRejected:prepareTimeout, nativePreparationLockReleased:retryTimeout});
                           """, arguments: [:], in: nil, contentWorld: .page),
                       let json = value as? String,
                       let data = json.data(using: .utf8),
                       let result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                       result["ready"] as? Bool == true,
                       self?.bridge?.plugin(withName: "TiqPurchases") != nil {
                        try? data.write(to: reportURL, options: .atomic)
                        return
                    }
                    try? await Task.sleep(nanoseconds: 250_000_000)
                }
                try? Data(#"{"ready":false}"#.utf8).write(to: reportURL, options: .atomic)
            }
        }
        #endif`)
}
export function verifyPurchaseSmoke(report){
 assert.equal(report.ready,true,'The launched app did not report a ready bridge')
 assert.equal(report.platform,'ios','The check must run inside the iOS app')
 assert.equal(report.available,true,'StoreKit was not exported to the app JavaScript')
 assert.equal(report.nativeInvalidReceiptRejected,true,'The native bridge did not reject the invalid test receipt')
 assert.equal(report.nativeInvalidProductRequestRejected,true,'The native bridge did not validate the product request')
 for(const key of ['nativeHistoryTimeoutRejected','nativePreparationTimeoutRejected','nativePreparationLockReleased'])assert.equal(report[key],true,'The native read recovery probe failed: '+key)
 return {ready:true,platform:'ios',available:true,nativeInvalidReceiptRejected:true,nativeInvalidProductRequestRejected:true,nativeHistoryTimeoutRejected:true,nativePreparationTimeoutRejected:true,nativePreparationLockReleased:true}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,file]=process.argv.slice(2)
 assert.ok(file,'Provide the generated Swift source or runtime report path')
 if(mode==='--prepare')await writeFile(file,instrumentPurchaseSmoke(await readFile(file,'utf8')))
 else if(mode==='--verify')console.log(JSON.stringify(verifyPurchaseSmoke(JSON.parse(await readFile(file,'utf8')))))
 else throw Error('Use --prepare or --verify')
}
