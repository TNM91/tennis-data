import { build } from 'esbuild'
import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
await mkdir(new URL('bundled', root), { recursive: true })
await build({
  entryPoints: [fileURLToPath(new URL('src/main.ts', root))],
  outfile: fileURLToPath(new URL('bundled/app.js', root)),
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true,
})
await copyFile(new URL('src/index.html', root), new URL('bundled/index.html', root))
await copyFile(new URL('src/style.css', root), new URL('bundled/style.css', root))
await copyFile(new URL('../../public/brand/web/header-logo-transparent.png', import.meta.url), new URL('bundled/logo.png', root))
await writeFile(new URL('capacitor.config.json', root), JSON.stringify({
  appId: 'com.tenaceiq.prototype', appName: 'TenAceIQ Prototype',
  webDir: 'bundled', loggingBehavior: 'none',
  plugins: {PushNotifications: {presentationOptions: []}},
}, null, 2) + '\n')
console.log('Built bundled client. No development server URL. Run cap sync android before building the APK.')
