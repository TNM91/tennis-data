import assert from 'node:assert/strict'
import {appendFile,readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {build} from 'esbuild'
import {nativeWebsiteAdapters} from './native-website-adapters.mjs'

const [output,swift] = process.argv.slice(2)
assert.ok(output, 'Provide a screenshot bundle output folder')
const fixture = name => fileURLToPath(new URL('../../tests/fixtures/' + name, import.meta.url))
await build({
 entryPoints:[fixture('ios-store-screenshots.ts')],
 outfile:resolve(output,'app.js'),
 bundle:true,platform:'browser',format:'esm',target:'es2022',jsx:'automatic',
 loader:{'.module.css':'local-css'},
 plugins:[nativeWebsiteAdapters(),{
  name:'screenshot-data',
  setup(builder){
   builder.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:fixture('mobile-navigation-client.ts')}))
   builder.onResolve({filter:/^@capacitor\/app$/},()=>({path:fixture('mobile-navigation-app.ts')}))
   builder.onResolve({filter:/^\.\/apple-purchases$/},()=>({path:fixture('ios-store-screenshot-purchases.ts')}))
   builder.onResolve({filter:/^\.\/native-push$/},args=>args.importer.replaceAll('\\','/').endsWith('/mobile/src/main.ts')
    ?{path:fixture('mobile-native-coach-alerts.ts')}:undefined)
  },
 }],
})
await appendFile(resolve(output,'app.css'),'\n.preview-controls{display:none!important}\n')

if(swift){
 const source=await readFile(swift,'utf8')
 const marker='bridge?.registerPluginInstance(TenAceIQFiles())'
 assert.equal(source.split(marker).length,2,'Unknown generated bridge controller')
 assert.ok(source.includes('import WebKit') && source.includes('tiq-storekit-smoke.json'),'Expected the unsigned simulator probe')
 await writeFile(swift,source.replace(marker,marker+String.raw`
        #if DEBUG
        if let screen = ProcessInfo.processInfo.environment["TIQ_STORE_SCREEN"],
           ProcessInfo.processInfo.arguments.contains("--tiq-store-screenshot") {
            Task { @MainActor [weak self] in
                let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                let ready = folder.appendingPathComponent("tiq-store-screenshot-ready")
                var result = "webview_unavailable"
                for _ in 0..<60 {
                    if let webView = self?.webView, webView.url != nil, !webView.isLoading,
                       self?.viewIfLoaded?.window != nil {
                        do {
                            let value = try await webView.callAsyncJavaScript("""
                                if (typeof window.tiqStoreScreenshot !== 'function') return 'sample_bundle_not_ready';
                                return await window.tiqStoreScreenshot(screen);
                                """, arguments: ["screen": screen], in: nil, in: .page)
                            if let name = value as? String {
                                result = name
                                if name == screen { break }
                            }
                        } catch {
                            result = "webview_error"
                            break
                        }
                    }
                    try? await Task.sleep(nanoseconds: 250_000_000)
                }
                try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                try? Data(result.utf8).write(to: ready, options: .atomic)
            }
        }
        #endif`))
}
