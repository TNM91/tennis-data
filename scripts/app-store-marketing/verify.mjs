import {chromium} from '@playwright/test'
import sharp from 'sharp'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {fileURLToPath,pathToFileURL} from 'node:url'
import path from 'node:path'
import {createHash} from 'node:crypto'
const root=fileURLToPath(new URL('../../',import.meta.url))
const out=path.resolve(root,'../../output/app-store-premium-20261119')
const manifest=JSON.parse(await readFile(path.join(out,'asset-manifest.json'),'utf8'))
if(manifest.exports.length!==23)throw Error('Expected 23 artwork exports')
await mkdir(path.join(out,'previews'),{recursive:true})
for(const entry of manifest.exports){
 const file=path.join(out,entry.file),bytes=await readFile(file),meta=await sharp(bytes).metadata()
 if(meta.width!==entry.width||meta.height!==entry.height||meta.hasAlpha||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Invalid asset: '+entry.file)
 await sharp(bytes).resize({width:300}).png().toFile(path.join(out,'previews',entry.file.replaceAll('/','-')))
}
for(const [name,hash] of Object.entries(manifest.brandHashes)){
 if(createHash('sha256').update(await readFile(path.join(root,'public/brand',name))).digest('hex')!==hash)throw Error('Brand source changed: '+name)
}
const metadata=JSON.parse(await readFile(path.join(out,'metadata-en-US.json'),'utf8'))
if(!metadata.description.includes('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'))throw Error('Missing EULA')
const browser=await chromium.launch({headless:true})
try{
 const page=await browser.newPage({viewport:{width:1960,height:1000}})
 const sections=['iphone-69','iphone-63','ipad-13'].map(group=>`<h2>${group}</h2><div class="row">${manifest.exports.filter(e=>e.file.startsWith(group+'/')).map(e=>`<figure><img src="previews/${e.file.replaceAll('/','-')}" alt="${e.file}"><figcaption>${e.file.split('/')[1]}</figcaption></figure>`).join('')}</div>`).join('')
 await writeFile(path.join(out,'qa-all-sizes.html'),`<!doctype html><meta charset="utf-8"><title>TenAceIQ asset QA</title><style>body{margin:0;padding:30px;background:#061426;color:#f5f8ff;font:18px system-ui}h1{font-size:30px}h2{font-size:24px;margin:30px 0 14px}.row{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:20px;align-items:start}figure{margin:0}img{display:block;width:100%;height:auto;border:1px solid #385b85}figcaption{font-size:13px;margin-top:7px}</style><h1>TenAceIQ · final artwork in all three sizes</h1>${sections}`)
 await page.goto(pathToFileURL(path.join(out,'qa-all-sizes.html')).href)
 const imageFailures=await page.evaluate(async()=>{await document.fonts.ready;return (await Promise.all([...document.images].map(async image=>{try{await image.decode();return null}catch{return image.src}}))).filter(Boolean)})
 if(imageFailures.length)throw Error('Cannot load preview images: '+imageFailures.join(', '))
 await page.screenshot({path:path.join(out,'qa-all-sizes.png'),fullPage:true})
 await page.goto(pathToFileURL(path.join(out,'index.html')).href)
 await page.evaluate(async()=>{await Promise.all([...document.images].map(image=>image.decode()))})
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900})
  if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Gallery overflow at '+width)
 }
 const results={date:'2026-11-19',result:'passed',exports:manifest.exports.length,expectedDimensions:true,noAlphaChannels:true,hashesMatch:true,brandSourcesUnchanged:true,metadataLimits:{subtitle:metadata.subtitle.length,promotionalText:metadata.promotionalText.length,description:metadata.description.length,keywordsBytes:Buffer.byteLength(metadata.keywords,'utf8')},eulaPresent:true,galleryViewports:[1280,390],sourceAppBuild:324}
 await writeFile(path.join(out,'qa-results.json'),JSON.stringify(results,null,2)+'\n')
 console.log(JSON.stringify(results))
}finally{await browser.close()}
