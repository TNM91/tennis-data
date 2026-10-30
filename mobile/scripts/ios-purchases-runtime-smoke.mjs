import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'

const channelProbe=String.raw`
#if DEBUG
@available(iOS 16.0, *) @MainActor private func tiqPurchaseChannelProbe() -> Bool {
    guard TiqPurchaseChannel.matches(bundleID: "com.tenaceiq.app", channel: "TestFlightInternalSandbox", expected: "Sandbox") else { return false }
    for expected in [nil, "Production", "Xcode", "", "sandbox"] as [String?] {
        guard !TiqPurchaseChannel.matches(bundleID: "com.tenaceiq.app", channel: "TestFlightInternalSandbox", expected: expected) else { return false }
    }
    for channel in [nil, "Production", "Sandbox", ""] as [String?] {
        guard !TiqPurchaseChannel.matches(bundleID: "com.tenaceiq.app", channel: channel, expected: "Sandbox") else { return false }
    }
    for bundle in [nil, "com.tenaceiq.prototype", "other.app"] as [String?] {
        guard !TiqPurchaseChannel.matches(bundleID: bundle, channel: "TestFlightInternalSandbox", expected: "Sandbox") else { return false }
    }
    return TiqPurchaseChannel.accepts(.sandbox) && !TiqPurchaseChannel.accepts(.production) && !TiqPurchaseChannel.accepts(.xcode)
        && TiqPurchaseChannel.cancelled(StoreKitError.userCancelled) && TiqPurchaseChannel.cancelled(CancellationError())
        && !TiqPurchaseChannel.cancelled(URLError(.notConnectedToInternet))
}
#endif
`

// Instrument only the generated unsigned Debug project, never the shipped source.
export function instrumentPurchaseSmoke(source){
 const marker='bridge?.registerPluginInstance(TenAceIQPurchases())'
 assert.equal(source.split(marker).length,2,'Expected one local purchase registration')
 assert.ok(!source.includes('tiq-storekit-smoke.json'),'Refuse duplicate smoke instrumentation')
 const purchaseMarker='let gate = TiqStoreRead(call, nanoseconds: 30_000_000_000, code: "purchase_preparation_timeout")'
 const historyMarker='let gate = TiqStoreRead(call, nanoseconds: 15_000_000_000, code: "purchase_history_timeout")'
 assert.equal(source.split(purchaseMarker).length,2,'Expected one bounded purchase preparation')
 assert.equal(source.split(historyMarker).length,2,'Expected one bounded history read')
 source=source.replace(purchaseMarker,purchaseMarker.replace('30_000_000_000','((call.getBool("tiqReadTimeoutSmoke") == true || call.getBool("tiqReadDeadlineStoppedSmoke") == true) ? 5_000_000 : 30_000_000_000)'))
 source=source.replace(historyMarker,historyMarker.replace('15_000_000_000','((call.getBool("tiqReadTimeoutSmoke") == true || call.getBool("tiqReadDeadlineStoppedSmoke") == true) ? 5_000_000 : 15_000_000_000)'))
 assert.equal(source.split('gate.start { gate in').length,3,'Expected purchase and history read tasks')
 source=source.replaceAll('gate.start { gate in',`gate.start { gate in
                #if DEBUG
                if call.getBool("tiqReadDeadlineStoppedSmoke") == true {
                    gate.stopDeadline()
                    do { try await Task.sleep(nanoseconds: 50_000_000) } catch { }
                    gate.resolve(["state": "cancelled"])
                    return
                }
                if call.getBool("tiqReadTimeoutSmoke") == true {
                    do { try await Task.sleep(nanoseconds: 250_000_000) } catch { }
                    gate.resolve(["unexpectedLateSuccess": true])
                    return
                }
                #endif`)
 const environmentMarker='let environmentMatches = self.matchesEnvironment(call)'
 assert.equal(source.split(environmentMarker).length,2,'Expected explicit-action receipt recovery')
 source=source.replace(environmentMarker,String.raw`#if DEBUG
                    if let probe = call.getString("tiqPurchaseFailureSmoke") {
                        if probe == "cancel" { stage = "confirmation"; throw StoreKitError.userCancelled }
                        if probe == "confirmation" { stage = "confirmation"; throw NSError(domain: SKErrorDomain, code: 0, userInfo: [NSLocalizedDescriptionKey: "private smoke details"]) }
                        throw NSError(domain: NSURLErrorDomain, code: -1009, userInfo: [NSLocalizedDescriptionKey: "private smoke details"])
                    }
                    #endif
                    let environmentMatches = self.matchesEnvironment(call)`)

 const before=String.raw`
        #if DEBUG
        let startedURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("tiq-storekit-smoke.json.started")
        try? FileManager.default.createDirectory(at: startedURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? Data(#"{"controllerEntered":true}"#.utf8).write(to: startedURL, options: .atomic)
        #endif
        `
 return source.replace('import StoreKit','import StoreKit\nimport WebKit'+channelProbe).replace(marker,before+marker+String.raw`
        #if DEBUG
        do {
            let reportURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("tiq-storekit-smoke.json")
            try? FileManager.default.createDirectory(at: reportURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? Data(#"{"controllerEntered":true,"pluginRegistered":true}"#.utf8).write(to: reportURL.appendingPathExtension("started"), options: .atomic)
            Task { @MainActor [weak self] in
                let purchaseChannel: Bool
                if #available(iOS 16.0, *) { purchaseChannel = tiqPurchaseChannelProbe() } else { purchaseChannel = false }
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
                           const diagnostic = async (kind, code, support) => {
                               try { await cap.Plugins.TiqPurchases.purchase({...purchaseArgs,tiqReadTimeoutSmoke:false,tiqPurchaseFailureSmoke:kind}); return false; }
                               catch (error) { return error.code === code && error.data?.supportCode === support && !JSON.stringify(error).includes('private smoke details'); }
                           };
                           const prepareTagged = await diagnostic('prepare','purchase_preparation_failed','environment/NSURLErrorDomain:-1009');
                           const confirmTagged = await diagnostic('confirmation','store_unavailable','confirmation/SKErrorDomain:0');
                           let cancelResolved = false;
                           try { const result = await cap.Plugins.TiqPurchases.purchase({...purchaseArgs,tiqReadTimeoutSmoke:false,tiqPurchaseFailureSmoke:'cancel'}); cancelResolved = result.state === 'cancelled'; } catch {}

                           let deadlineStopped = false;
                           try { const value = await cap.Plugins.TiqPurchases.purchase({...purchaseArgs,tiqReadTimeoutSmoke:false,tiqReadDeadlineStoppedSmoke:true}); deadlineStopped = value.state === 'cancelled'; } catch {}
                           return JSON.stringify({ready: purchaseChannel && rejected && productRejected && historyTimeout && prepareTimeout && retryTimeout && prepareTagged && confirmTagged && cancelResolved && deadlineStopped, platform: cap.getPlatform(), available: true, nativeInvalidReceiptRejected: rejected, nativeInvalidProductRequestRejected: productRejected, nativeHistoryTimeoutRejected:historyTimeout, nativePreparationTimeoutRejected:prepareTimeout, nativePreparationLockReleased:retryTimeout,nativeConfirmationWaitUntimed:deadlineStopped,nativePreparationFailureTagged:prepareTagged,nativeConfirmationFailureTagged:confirmTagged,nativeCancellationResolved:cancelResolved,nativeSandboxChannelVerified:purchaseChannel});
                           """, arguments: ["purchaseChannel": purchaseChannel], in: nil, contentWorld: .page),
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
 for(const key of ['nativeHistoryTimeoutRejected','nativePreparationTimeoutRejected','nativePreparationLockReleased','nativeConfirmationWaitUntimed','nativePreparationFailureTagged','nativeConfirmationFailureTagged','nativeCancellationResolved','nativeSandboxChannelVerified'])assert.equal(report[key],true,'The native read recovery probe failed: '+key)
 return {ready:true,platform:'ios',available:true,nativeInvalidReceiptRejected:true,nativeInvalidProductRequestRejected:true,nativeHistoryTimeoutRejected:true,nativePreparationTimeoutRejected:true,nativePreparationLockReleased:true,nativeConfirmationWaitUntimed:true,nativePreparationFailureTagged:true,nativeConfirmationFailureTagged:true,nativeCancellationResolved:true,nativeSandboxChannelVerified:true}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,file]=process.argv.slice(2)
 assert.ok(file,'Provide the generated Swift source or runtime report path')
 if(mode==='--prepare')await writeFile(file,instrumentPurchaseSmoke(await readFile(file,'utf8')))
 else if(mode==='--verify')console.log(JSON.stringify(verifyPurchaseSmoke(JSON.parse(await readFile(file,'utf8')))))
 else throw Error('Use --prepare or --verify')
}
