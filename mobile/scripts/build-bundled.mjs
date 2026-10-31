import './build-website-ui.mjs'
import {scopeNativeStyles} from './style-scope.mjs'
import {nativeWebsiteAdapters} from './native-website-adapters.mjs'
import { build } from 'esbuild'
import { mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
await mkdir(new URL('bundled', root), { recursive: true })
await build({
  entryPoints: [fileURLToPath(new URL('src/main.ts', root))],
  outfile: fileURLToPath(new URL('bundled/app.js', root)),
  loader:{'.module.css':'local-css'}, jsx:'automatic',
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true,
  plugins:[nativeWebsiteAdapters()],
})
await copyFile(new URL('src/index.html', root), new URL('bundled/index.html', root))
await writeFile(new URL('bundled/style.css',root),scopeNativeStyles(await readFile(new URL('src/style.css',root),'utf8')))
await copyFile(new URL('src/website-parity.css', root), new URL('bundled/website-parity.css', root))
await copyFile(new URL('src/app-atmosphere.css', root), new URL('bundled/app-atmosphere.css', root))
await copyFile(new URL('generated/website-ui.css', root), new URL('bundled/website-ui.css', root))
await mkdir(new URL('bundled/brand/courts/',root),{recursive:true})
await mkdir(new URL('bundled/brand/approved/',root),{recursive:true})
await copyFile(new URL('../../public/brand/approved/TiQ_White_Transparent_Refined.png',import.meta.url),new URL('bundled/brand/approved/TiQ_White_Transparent_Refined.png',root))
await mkdir(new URL('bundled/brand/icons/',root),{recursive:true})
await mkdir(new URL('bundled/brand/web/',root),{recursive:true})
await copyFile(new URL('../../public/brand/icons/app-icon-1024.png',import.meta.url),new URL('bundled/brand/icons/app-icon-1024.png',root))
await copyFile(new URL('../../public/brand/web/header-logo-transparent.png',import.meta.url),new URL('bundled/brand/web/header-logo-transparent.png',root))
await copyFile(new URL('../../public/brand/courts/tiq-native-ace-deuce-generic-20261028-v2.png',import.meta.url),new URL('bundled/brand/courts/tiq-native-ace-deuce-generic-20261028-v2.png',root))
// Retire the unused multi-ball mobile copy; the website's original stays in public/brand.
await rm(new URL('bundled/brand/social/og-background-v2.png',root),{force:true})
await mkdir(new URL('bundled/tiq/tokens/',root),{recursive:true})
await copyFile(new URL('../../public/brand/courts/tiq-court-approved-20261024-v2.png',import.meta.url),new URL('bundled/brand/courts/tiq-court-approved-20261024-v2.png',root))
await copyFile(new URL('../../public/tiq/tokens/tennis-ball-reference.png',import.meta.url),new URL('bundled/tiq/tokens/tennis-ball-reference.png',root))
await copyFile(new URL('../../public/brand/web/header-logo-transparent.png', import.meta.url), new URL('bundled/logo.png', root))
await writeFile(new URL('capacitor.config.json', root), JSON.stringify({
  appId: 'com.tenaceiq.prototype', appName: 'TenAceIQ Prototype',
  webDir: 'bundled', loggingBehavior: 'none',
  plugins: {PushNotifications: {presentationOptions: []}},
}, null, 2) + '\n')
console.log('Built bundled client. No development server URL. Run cap sync android before building the APK.')

// Retire superseded character drafts from the packaged app.
await rm(new URL('bundled/brand/courts/tiq-native-ace-deuce-righthanded-20261028-v1.png',root),{force:true})
await rm(new URL('bundled/brand/courts/tiq-right-handed-trophy-pose-20261028-v1.png',root),{force:true})
