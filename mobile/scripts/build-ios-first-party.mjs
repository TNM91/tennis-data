import assert from 'node:assert/strict'
import {copyFile,mkdir,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {build} from 'esbuild'
import {checkFirstPartyBundle,firstPartyWebDir} from './first-party-bundle.mjs'

const root = new URL('../../',import.meta.url)
const mobile = new URL('mobile/',root)
const output = new URL(firstPartyWebDir+'/',mobile)
const result = await build({
 absWorkingDir:fileURLToPath(root),
 entryPoints:['mobile/src/first-party/app.ts'],
 outfile:fileURLToPath(new URL('app.js',output)),
 bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,
 external:['./brand/court.png'],metafile:true,write:false,
})

// A new dependency needs an explicit source review before it enters this package.
const approvedInputs = [
 'lib/calendar-date.ts',
 'lib/level-up/level-up-cards.ts',
 'mobile/src/first-party/app.css',
 'mobile/src/first-party/app.ts',
 'mobile/src/training-clock.ts',
]
assert.deepEqual(Object.keys(result.metafile.inputs).sort(),approvedInputs.sort())
await mkdir(new URL('brand/',output),{recursive:true})
for(const file of result.outputFiles)await writeFile(file.path,file.contents)
await copyFile(new URL('src/first-party/index.html',mobile),new URL('index.html',output))
await copyFile(new URL('public/brand/web/header-logo-transparent.png',root),new URL('brand/header-logo-transparent.png',output))
await copyFile(new URL('public/brand/courts/tiq-court-approved-20261024-v2.png',root),new URL('brand/court.png',output))
await writeFile(new URL('release-scope.json',output),JSON.stringify({profile:'first-party-offline',version:1})+'\n')
await checkFirstPartyBundle(fileURLToPath(output))
await writeFile(new URL('capacitor.config.json',mobile),JSON.stringify({
 appId:'com.tenaceiq.prototype',appName:'TenAceIQ Prototype',webDir:firstPartyWebDir,loggingBehavior:'none',
},null,2)+'\n')
console.log('Built the first-party iOS prototype bundle in '+firstPartyWebDir+'.')
