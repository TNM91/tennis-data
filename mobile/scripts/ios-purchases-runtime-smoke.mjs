import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'

// Instrument only the generated unsigned Debug project, never the shipped source.
export function instrumentPurchaseSmoke(source){
 const marker='bridge?.registerPluginInstance(TenAceIQPurchases())'
 assert.equal(source.split(marker).length,2,'Expected one local purchase registration')
 assert.ok(!source.includes('--tiq-storekit-smoke'),'Refuse duplicate smoke instrumentation')
 return source.replace('import StoreKit','import StoreKit\nimport WebKit').replace(marker,marker+String.raw`
        #if DEBUG
        if CommandLine.arguments.contains("--tiq-storekit-smoke") {
            let reportURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("tiq-storekit-smoke.json")
            try? FileManager.default.createDirectory(at: reportURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? Data(#"{"controllerLoaded":true}"#.utf8).write(to: reportURL.appendingPathExtension("started"), options: .atomic)
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
                           return JSON.stringify({ready: true, platform: cap.getPlatform(), available: true, nativeInvalidReceiptRejected: rejected});
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
 return {ready:true,platform:'ios',available:true,nativeInvalidReceiptRejected:true}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,file]=process.argv.slice(2)
 assert.ok(file,'Provide the generated Swift source or runtime report path')
 if(mode==='--prepare')await writeFile(file,instrumentPurchaseSmoke(await readFile(file,'utf8')))
 else if(mode==='--verify')console.log(JSON.stringify(verifyPurchaseSmoke(JSON.parse(await readFile(file,'utf8')))))
 else throw Error('Use --prepare or --verify')
}
