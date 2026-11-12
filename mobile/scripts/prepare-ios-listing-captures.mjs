import assert from 'node:assert/strict'
import {appendFile,readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {build} from 'esbuild'
import {nativeWebsiteAdapters} from './native-website-adapters.mjs'

const [app] = process.argv.slice(2)
assert.ok(app, 'Provide the generated simulator app source folder')
const scope = JSON.parse(await readFile(resolve(app,'public/release-scope.json'),'utf8'))
assert.deepEqual(scope,{profile:'first-party-full',version:1})
const fixture = name => fileURLToPath(new URL('../../tests/fixtures/' + name,import.meta.url))
const entries = [
  ['0E4A','Sam','I booked Court 3 for Friday at 5. Who’s in?'],
  ['6C20','Alex','Count me in. I can bring a fresh can.'],
  ['3A58','Jordan','I’m in too. Can we get some doubles returns in?'],
  ['0E4A','Sam','Absolutely. Let’s warm up first, then play a set.'],
]
const messages = entries.map(([id,name,body], index) => ({
  id: '66666666-6666-4666-8666-66666666666' + index,
  senderUserId: '77777777-7777-4777-8777-77777777' + id,
  senderName: name,
  body,
  kind: 'message',
  createdAt: '2026-11-06T17:0' + index + ':00.000Z',
  isMine: false,
}))
const names = messages.map(({senderUserId,senderName}) => [senderUserId,senderName])
await build({
  entryPoints:[fixture('ios-first-party-listing.ts')],
  outfile:resolve(app,'public/app.js'),
  bundle:true,platform:'browser',format:'esm',target:'es2022',jsx:'automatic',
  loader:{'.module.css':'local-css'},
  define:{TIQ_FIRST_PARTY_BUILD:'true'},
  plugins:[nativeWebsiteAdapters(),{
    name:'listing-demo-data',
    setup(builder) {
      builder.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:fixture('mobile-navigation-client.ts')}))
      builder.onResolve({filter:/^@capacitor\/app$/},()=>({path:fixture('mobile-navigation-app.ts')}))
      builder.onResolve({filter:/^\.\/native-push$/},args=>args.importer.replaceAll('\\','/').endsWith('/mobile/src/main.ts')
        ?{path:fixture('mobile-native-coach-alerts.ts')}:undefined)
      builder.onLoad({filter:/[\\/]tests[\\/]fixtures[\\/]mobile-navigation\.ts$/},async args=>{
        const source=await readFile(args.path,'utf8')
        const marker='const chatSafetyFixture='
        assert.equal(source.split(marker).length,2,'Expected the current team chat fixture')
        const seed='firstPartyTeamMessages.splice(0,firstPartyTeamMessages.length,...'+JSON.stringify(messages)+')\n'+
          'for(const [id,name] of '+JSON.stringify(names)+')chatNames.set(id,name)\n'
        return {contents:source.replace(marker,seed+marker).replace('2026-11-06T10:05:00.000Z','2026-11-06T17:05:00.000Z'),loader:'ts'}
      })
    },
  }],
})
await appendFile(resolve(app,'public/app.css'),'\n.preview-controls{display:none!important}\n')

const swift = resolve(app,'TenAceIQPurchases.swift')
const source = await readFile(swift,'utf8')
const marker = 'bridge?.registerPluginInstance(TenAceIQFiles())'
assert.equal(source.split(marker).length,2,'Expected the current generated bridge controller')
const hook = [
  '#if DEBUG && targetEnvironment(simulator)',
  'if let screen = ProcessInfo.processInfo.environment["TIQ_STORE_SCREEN"] {',
  '    Task { @MainActor [weak self] in',
  '        let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]',
  '        let ready = folder.appendingPathComponent("tiq-store-screenshot-ready")',
  '        var result = "webview_unavailable"',
  '        for _ in 0..<60 {',
  '            if let webView = self?.webView, webView.url != nil, !webView.isLoading,',
  '               self?.viewIfLoaded?.window != nil {',
  '                do {',
  '                    let value = try await webView.callAsyncJavaScript("""',
  '                        if (typeof window.tiqStoreScreenshot !== "function") return "sample_bundle_not_ready";',
  '                        return await window.tiqStoreScreenshot(screen);',
  '                        """, arguments: ["screen": screen], in: nil, in: .page)',
  '                    if let name = value as? String {',
  '                        result = name',
  '                        if name != "sample_bundle_not_ready" { break }',
  '                    }',
  '                } catch {',
  '                    result = "webview_error"',
  '                    break',
  '                }',
  '            }',
  '            try? await Task.sleep(nanoseconds: 250_000_000)',
  '        }',
  '        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)',
  '        try? Data(result.utf8).write(to: ready, options: .atomic)',
  '    }',
  '}',
  '#endif',
].map(line=>'        '+line).join('\n')
await writeFile(swift,source.replace('import StoreKit','import StoreKit\nimport WebKit').replace(marker,marker+'\n'+hook))
