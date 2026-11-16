import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { nativeWebsiteAdapters } from './native-website-adapters.mjs'

const [app, mode] = process.argv.slice(2)
assert.ok(app, 'Provide the generated simulator app source folder')
await build({
  entryPoints: ['tests/fixtures/ios-purchase-review.ts'],
  outfile: resolve(app, 'public/app.js'),
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', jsx: 'automatic',
  loader: { '.module.css': 'local-css' },
  define: { TIQ_FIRST_PARTY_BUILD: 'true' },
  plugins: [nativeWebsiteAdapters()],
})
if (mode === '--browser-check') process.exit(0)

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
  '        for _ in 0..<240 {',
  '            if let webView = self?.webView {',
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
  '                    result = "webview_evaluation_retry"',
  '                }',
  '            }',
  '            try? await Task.sleep(nanoseconds: 250_000_000)',
  '        }',
  '        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)',
  '        let marker = result == screen ? ready : ready.appendingPathExtension("failed")',
  '        try? Data(result.utf8).write(to: marker, options: .atomic)',
  '    }',
  '}',
  '#endif',
].map(line=>'        '+line).join('\n')
await writeFile(swift,source.replace('import StoreKit','import StoreKit\nimport WebKit').replace(marker,marker+'\n'+hook))
