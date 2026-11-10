import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {join} from 'node:path'

export const firstPartyWebDir = 'bundled-first-party'
export const firstPartyIosDir = 'ios-first-party'
export const firstPartyCapacitorConfig = {
 appId:'com.tenaceiq.prototype',appName:'TenAceIQ Prototype',webDir:firstPartyWebDir,loggingBehavior:'none',
 ios:{path:firstPartyIosDir,includePlugins:[]},
}
export const firstPartyAssets = [
 'app.js',
 'app.css',
 'index.html',
 'release-scope.json',
 'brand/header-logo-transparent.png',
 'brand/court.png',
]

export async function checkFirstPartyBundle(path) {
 const actual = await readdir(path,{recursive:true,withFileTypes:true})
 const files = actual.filter(entry => !entry.isDirectory())
 assert.ok(files.every(entry => entry.isFile()), 'Unexpected link or device in the first-party bundle')
 assert.equal(files.length, firstPartyAssets.length, 'Unexpected file in the first-party bundle')
 const read = file => readFile(join(path,file),'utf8')
 const scope = JSON.parse(await read('release-scope.json'))
 assert.deepEqual(scope,{profile:'first-party-offline',version:1})
 const html = await read('index.html')
 assert.match(html, /default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none';/)
 for(const content of [html,await read('app.js'),await read('app.css')]){
  assert.doesNotMatch(content,/https?:\/\/|tennislink|\busta\b|supabase/i,'Unexpected external service or source in the first-party bundle')
 }
 await Promise.all(firstPartyAssets.map(file => readFile(join(path,file))))
}
