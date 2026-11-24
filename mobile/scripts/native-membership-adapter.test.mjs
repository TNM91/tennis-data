import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {fileURLToPath} from 'node:url'
import {nativeMembershipAdapter} from './native-membership-adapter.mjs'
import {nativeWebsiteAdapters} from './native-website-adapters.mjs'

for(const android of [false,true])test(`${android?'Android':'iOS'} packages its own membership implementation`,async()=>{
 const result=await build({stdin:{contents:"import {storePurchases,mountStoreMemberships,storeCancellationNotice,storeMembershipLabel} from './store-memberships';globalThis.membershipBoundary={storePurchases,mountStoreMemberships,storeCancellationNotice,storeMembershipLabel}",resolveDir:fileURLToPath(new URL('../src',import.meta.url))},outfile:'membership.js',write:false,bundle:true,platform:'browser',format:'esm',jsx:'automatic',loader:{'.module.css':'local-css'},metafile:true,plugins:[nativeMembershipAdapter(android),nativeWebsiteAdapters()]})
 const inputs=Object.keys(result.metafile.inputs),code=result.outputFiles.find(file=>file.path.endsWith('.js')).text
 assert.equal(inputs.some(name=>name.endsWith('/google-memberships.ts')),android)
 assert.equal(inputs.some(name=>name.endsWith('/apple-memberships.ts')),!android)
 assert.equal(inputs.some(name=>name.endsWith('/google-play-purchases.ts')),android)
 assert.equal(code.includes('TiqGooglePurchases'),android)
 assert.ok(code.includes(android?'Cancel any Google Play subscription':'Any Apple subscription must be canceled'))
})
