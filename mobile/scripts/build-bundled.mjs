import './build-website-ui.mjs'
import {scopeNativeStyles} from './style-scope.mjs'
import {nativeWebsiteAdapters} from './native-website-adapters.mjs'
import { build } from 'esbuild'
import { mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const preview = process.argv.includes('--first-party-preview')
const fullApp = process.argv.includes('--first-party-full')
if (preview && fullApp) throw Error('Choose one first-party bundle target.')
const firstParty = preview || fullApp
const output = new URL(preview ? '../.next/mobile-first-party-preview/' : 'bundled/', root)
const result = await build({
  entryPoints: [fileURLToPath(new URL('src/main.ts', root))],
  outfile: fileURLToPath(new URL('app.js', output)),
  loader:{'.module.css':'local-css'}, jsx:'automatic',
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true,
  define:{TIQ_FIRST_PARTY_BUILD:String(firstParty)},
  metafile:firstParty,
  write:!firstParty,
  plugins:[nativeWebsiteAdapters()],
})
if (firstParty) {
  const inputs = Object.values(result.metafile.outputs).flatMap(file => Object.entries(file.inputs))
  const externalImports = inputs.filter(([name, input]) => /(?:^|\/)data-import[^/]*\.ts$/.test(name) && input.bytesInOutput > 0)
  if (externalImports.length) {
    throw Error('External import code is present in the first-party bundle: '+externalImports.map(([name])=>name).join(', '))
  }
  await mkdir(output,{recursive:true})
  for(const file of result.outputFiles)await writeFile(file.path,file.contents)
}
await copyFile(new URL('src/index.html', root), new URL('index.html', output))
const scopeManifest = new URL('release-scope.json', output)
if(firstParty)await writeFile(scopeManifest,JSON.stringify({profile:'first-party-full',version:1})+'\n')
else await rm(scopeManifest,{force:true})
await writeFile(new URL('style.css',output),scopeNativeStyles(await readFile(new URL('src/style.css',root),'utf8')))
await copyFile(new URL('src/website-parity.css', root), new URL('website-parity.css', output))
await copyFile(new URL('src/app-atmosphere.css', root), new URL('app-atmosphere.css', output))
await writeFile(new URL('premium-surfaces.css',output),(await readFile(new URL('src/premium-surfaces.css',root),'utf8')).replace(/\r\n/g,'\n'))
await copyFile(new URL('generated/website-ui.css', root), new URL('website-ui.css', output))
await mkdir(new URL('brand/courts/',output),{recursive:true})
await mkdir(new URL('brand/approved/',output),{recursive:true})
await copyFile(new URL('../../public/brand/approved/TiQ_White_Transparent_Refined.png',import.meta.url),new URL('brand/approved/TiQ_White_Transparent_Refined.png',output))
await mkdir(new URL('brand/icons/',output),{recursive:true})
await mkdir(new URL('brand/web/',output),{recursive:true})
await copyFile(new URL('../../public/brand/icons/app-icon-1024.png',import.meta.url),new URL('brand/icons/app-icon-1024.png',output))
await copyFile(new URL('../../public/brand/web/header-logo-transparent.png',import.meta.url),new URL('brand/web/header-logo-transparent.png',output))
await copyFile(new URL('../../public/brand/courts/tiq-native-ace-deuce-refined-20261031-v3.png',import.meta.url),new URL('brand/courts/tiq-native-ace-deuce-refined-20261031-v3.png',output))
await copyFile(new URL('../../public/brand/courts/tiq-native-night-session.png',import.meta.url),new URL('brand/courts/tiq-native-night-session.png',output))
await rm(new URL('brand/courts/tiq-native-ace-deuce-generic-20261028-v2.png',output),{force:true})
// Retire the unused multi-ball mobile copy; the website's original stays in public/brand.
await rm(new URL('brand/social/og-background-v2.png',output),{force:true})
await mkdir(new URL('tiq/tokens/',output),{recursive:true})
await copyFile(new URL('../../public/brand/courts/tiq-court-approved-20261024-v2.png',import.meta.url),new URL('brand/courts/tiq-court-approved-20261024-v2.png',output))
await copyFile(new URL('../../public/tiq/tokens/tennis-ball-reference.png',import.meta.url),new URL('tiq/tokens/tennis-ball-reference.png',output))
await copyFile(new URL('../../public/brand/web/header-logo-transparent.png', import.meta.url), new URL('logo.png', output))
if (preview) {
  console.log('Built the full-app first-party preview in .next/mobile-first-party-preview. This preview has no native packaging target.')
} else {
  await writeFile(new URL('capacitor.config.json', root), JSON.stringify({
    appId: 'com.tenaceiq.prototype', appName: 'TenAceIQ Prototype',
    webDir: 'bundled', loggingBehavior: 'none',
    plugins: {PushNotifications: {presentationOptions: []}},
  }, null, 2) + '\n')
  console.log(fullApp?'Built the full-app first-party bundle for native packaging.':'Built bundled client. No development server URL. Run cap sync android before building the APK.')
}

// Retire superseded character drafts from the packaged app.
await rm(new URL('brand/courts/tiq-native-ace-deuce-righthanded-20261028-v1.png',output),{force:true})
await rm(new URL('brand/courts/tiq-right-handed-trophy-pose-20261028-v1.png',output),{force:true})
