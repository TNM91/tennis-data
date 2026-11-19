import {chromium} from '@playwright/test'
import sharp from 'sharp'
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises'
import {fileURLToPath,pathToFileURL} from 'node:url'
import path from 'node:path'
import {createHash} from 'node:crypto'

const root=fileURLToPath(new URL('../../',import.meta.url))
const output=path.resolve(root,'../../output/app-store-premium-20261119')
const brand=path.join(root,'public/brand')
const logo=pathToFileURL(path.join(brand,'approved/TenAceIQ_Light_Transparent.png')).href
const court=pathToFileURL(path.join(brand,'social/og-background-v2.png')).href
const source=(device,scene)=>pathToFileURL(path.join(output,'sources',device,scene+'.png')).href
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const scenes=[
 {id:'lab',label:'MY LAB',headline:['Your game.','All together.'],copy:'Your level, your next rep, your progress.',parts:['lab-detail','lab-context']},
 {id:'chat',label:'TEAM CHATS',headline:['Your team.','Ready for court.'],copy:'Private chats. Practice plans. Everyone connected.'},
 {id:'practice',label:'CAPTAIN · PRO',headline:['Make every','practice count.'],copy:'Collect replies and confirm your practice group.',parts:['practice-detail']},
 {id:'explore',label:'EXPLORE',headline:['Find your','next court.'],copy:'Explore places to play and get directions.'},
 {id:'coach',label:'COACH · PRO',headline:['Coach with a','clearer picture.'],copy:'Assign practice. See check-ins. Guide the next rep.',parts:['coach-detail','coach-context']},
 {id:'league',label:'LEAGUES',headline:['Keep your','league moving.'],copy:'Schedules, results and standings in one place.'},
 {id:'tournament',label:'TOURNAMENTS',headline:['Run your next','tournament.'],copy:'Divisions, entries and draws—all together.'},
]
const devices=[{id:'iphone-69',width:1320,height:2868},{id:'iphone-63',width:1206,height:2622},{id:'ipad-13',width:2064,height:2752}]
await mkdir(path.join(output,'creative'),{recursive:true})
await mkdir(path.join(output,'layouts'),{recursive:true})
const exports=[]
const browser=await chromium.launch({headless:true})
const page=await browser.newPage({deviceScaleFactor:1})
async function render(file,html,width,height){
 const layout=path.join(output,'layouts',file.replaceAll('/','-')+'.html')
 await writeFile(layout,html)
 await page.setViewportSize({width,height})
 await page.goto(pathToFileURL(layout).href)
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()))})
 const overflow=await page.locator('[data-check-bounds]').evaluateAll(elements=>elements.filter(element=>element.scrollWidth>element.clientWidth+1).map(element=>element.tagName+': '+element.textContent))
 if(overflow.length)throw Error('Text overflow: '+overflow.join('; '))
 const unsafe=await page.locator('[data-safe-art]').evaluateAll(areas=>areas.flatMap(area=>{
  const bounds=area.getBoundingClientRect()
  return [...area.children].filter(child=>{const box=child.getBoundingClientRect();return box.left<bounds.left||box.right>bounds.right||box.top<bounds.top||box.bottom>bounds.bottom}).map(child=>child.tagName)
 }))
 if(unsafe.length)throw Error('Key creative artwork is outside its safe area: '+file)
 const destination=path.join(output,file)
 await mkdir(path.dirname(destination),{recursive:true})
 await page.screenshot({path:destination,animations:'disabled',omitBackground:false})
 const info=await sharp(destination).metadata()
 if(info.width!==width||info.height!==height||info.hasAlpha)throw Error('Invalid export dimensions/alpha for '+file)
 const digest=createHash('sha256').update(await readFile(destination)).digest('hex')
 exports.push({file,width,height,format:'png',hasAlpha:false,sha256:digest})
 console.log('Exported '+file)
}
const css=`*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#061426;color:#f5f8ff}body{font-family:Bahnschrift,'Arial',sans-serif}.canvas{position:relative;width:100%;height:100%;overflow:hidden;background:radial-gradient(ellipse at 95% 65%,#143f79 0,#0c2449 26%,#061426 67%)}.brand{position:absolute;object-fit:contain;height:auto}.kicker{color:#a8d6ff;font-size:36px;letter-spacing:.13em;font-weight:600;text-align:right}.title{font-size:132px;line-height:1.04;letter-spacing:-3.5px;font-weight:700;margin:0}.title span{display:block;color:#b1ed3f}.sub{color:#b9cbe5;font-size:40px;line-height:1.45;letter-spacing:.1px;margin:24px 0 0}.image-stack{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;height:100%}.image-stack img{display:block;max-width:100%;height:auto;object-fit:contain}.image-stack .full{max-height:100%;width:auto;max-width:100%;border:2px solid #416799;border-radius:36px;box-shadow:0 38px 90px #0005}.image-stack .detail{flex:none;width:100%;height:auto;object-fit:contain;border-radius:60px;box-shadow:0 28px 72px #0003}.footer{position:absolute;display:flex;justify-content:space-between;color:#95b4d5;font-size:30px;letter-spacing:.16em}.creative{position:relative;background:#011021;width:100%;height:100%;overflow:hidden}.creative .court{position:absolute;object-fit:contain}.creative .focal{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center}.creative .focal img{display:block;height:auto;object-fit:contain}.creative .slogan{color:#fff;font-size:104px;line-height:1.1;letter-spacing:-2px;font-weight:600;margin:44px 0 0;white-space:nowrap}.creative .promise{font-size:50px;letter-spacing:.15em;color:#b1ed3f;margin:36px 0 0}`
try{
 for(const device of devices){
  const tablet=device.id==='ipad-13'
  const ratio=device.width/1320
  for(const [index,scene] of scenes.entries()){
   const margin=tablet?120:84*ratio
   const top=tablet?660:710*ratio
   const bottom=tablet?180:180*ratio
   const areaWidth=tablet?1780:1152*ratio
   const bodyHeight=device.height-top-bottom
   const parts=scene.parts
   const images=parts?parts.map(part=>`<img class="detail" src="${source(device.id,part)}" alt="">`).join(''):`<img class="full" src="${source(device.id,scene.id)}" alt="">`
   let stackStyle=''
   if(parts){
    const sizes=await Promise.all(parts.map(part=>sharp(path.join(output,'sources',device.id,part+'.png')).metadata()))
    const totalHeight=sizes.reduce((sum,size)=>sum+areaWidth*size.height/size.width,0)+48*(parts.length-1)
    if(totalHeight>bodyHeight)stackStyle=`width:${areaWidth*bodyHeight/totalHeight}px;margin:auto`
   }
   const headline=tablet?164:132*ratio
   const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(scene.label)}</title><style>${css}</style><div class="canvas"><img class="brand" src="${logo}" alt="TenAceIQ" style="left:${margin}px;top:${tablet?78:76*ratio}px;width:${tablet?500:380*ratio}px"><div class="kicker" style="position:absolute;right:${margin}px;top:${tablet?99:100*ratio}px;font-size:${tablet?39:30*ratio}px">${escape(scene.label)}</div><div style="position:absolute;left:${margin}px;right:${margin}px;top:${tablet?245:250*ratio}px"><h1 class="title" data-check-bounds style="font-size:${headline}px">${escape(scene.headline[0])}<span>${escape(scene.headline[1])}</span></h1><p class="sub" data-check-bounds style="font-size:${tablet?48:40*ratio}px;max-width:${tablet?1650:1120*ratio}px">${escape(scene.copy)}</p></div><div style="position:absolute;left:${(device.width-areaWidth)/2}px;top:${top}px;width:${areaWidth}px;height:${bodyHeight}px"><div class="image-stack" style="${stackStyle}">${images}</div></div><div class="footer" style="left:${margin}px;right:${margin}px;bottom:${tablet?65:63*ratio}px;font-size:${tablet?35:27*ratio}px"><span>MORE TENNIS. ONE APP.</span><span>${String(index+1).padStart(2,'0')} / 07</span></div></div></html>`
   await render(device.id+'/'+String(index+1).padStart(2,'0')+'-'+scene.id+'.png',html,device.width,device.height)
  }
 }
 const header=`<!doctype html><html lang="en"><meta charset="utf-8"><title>TenAceIQ header</title><style>${css}</style><div class="creative"><img class="court" src="${court}" alt="" style="height:1646px;width:auto;right:0;bottom:0"><div class="focal" data-safe-art style="left:1097px;top:493px;width:1646px;height:661px"><img src="${logo}" alt="TenAceIQ" style="width:1450px"><p class="slogan">More tennis. One app.</p></div></div></html>`
 await render('creative/header-3840x1646.png',header,3840,1646)
 const search=`<!doctype html><html lang="en"><meta charset="utf-8"><title>TenAceIQ search creative</title><style>${css}</style><div class="creative"><img class="court" src="${court}" alt="" style="width:3840px;height:auto;left:0;bottom:0"><div class="focal" data-safe-art style="left:836px;top:765px;width:2168px;height:1030px"><img src="${logo}" alt="TenAceIQ" style="width:1700px"><p class="slogan" style="font-size:144px;margin-top:62px">More tennis. One app.</p><p class="promise">PLAY · CONNECT · IMPROVE</p></div></div></html>`
 await render('creative/search-3840x2560.png',search,3840,2560)
 const current=JSON.parse(await readFile(new URL('./en-US.json',import.meta.url),'utf8'))
 current.status='Approved by user for use; apply editable fields without withdrawing review'
 current.description=current.description.split('\n\n').map(block=>{const lines=block.split('\n');return lines.length>1&&/^[A-Z &]+$/.test(lines[0])?lines[0]+'\n'+lines.slice(1).join(' '):lines.join(' ')}).join('\n\n')
 if(current.subtitle.length>30||current.promotionalText.length>170||current.description.length>4000||Buffer.byteLength(current.keywords,'utf8')>100)throw Error('Metadata limits exceeded')
 if(!current.description.endsWith('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'))throw Error('EULA missing')
 await writeFile(path.join(output,'metadata-en-US.json'),JSON.stringify(current,null,2)+'\n')
 await writeFile(path.join(output,'description-en-US.txt'),current.description+'\n')
 const brandHashes={}
 for(const file of ['approved/TenAceIQ_Light_Transparent.png','social/og-background-v2.png'])brandHashes[file]=createHash('sha256').update(await readFile(path.join(brand,file))).digest('hex')
 const manifest={created:'2026-11-19',sourceAppBuild:324,sourceCommit:'9fe0931d5d06a372354e39f427da98e1643bca98',status:'Ready for Asset Library staging; do not replace the gallery on the Waiting for Review submission',brandSource:'public/brand only; assets placed proportionally without filters, cropping, redrawing, or recoloring',brandHashes,creativeSafeAreas:{header:{x:1097,y:493,width:1646,height:661},search:{x:836,y:765,width:2168,height:1030}},exports}
 await writeFile(path.join(output,'asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n')
 const thumbImages=scenes.map((scene,i)=>`<figure><img src="${'iphone-69/'+String(i+1).padStart(2,'0')+'-'+scene.id+'.png'}" alt="${escape(scene.label)}"><figcaption>${i+1}. ${escape(scene.label)}</figcaption></figure>`).join('')
 const gallery=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TenAceIQ — premium App Store assets</title><style>*{box-sizing:border-box}body{font:17px/1.5 system-ui,sans-serif;background:#061426;color:#f5f8ff;margin:0;padding:36px}h1{font-size:42px;margin:0 0 10px}.intro{color:#bbd1eb;max-width:1000px}.strip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:18px;margin:32px 0}figure{margin:0}figure img{width:100%;height:auto;border:1px solid #385b85;border-radius:12px}figcaption{font-size:13px;color:#b9cbe5;margin-top:10px}.creatives{display:grid;grid-template-columns:3fr 2fr;gap:24px;align-items:start}a{color:#a6d9ff}code{color:#b1ed3f}h2{margin:38px 0 18px}.download{display:flex;gap:22px;flex-wrap:wrap}.notice{border-left:3px solid #b1ed3f;padding:12px 18px;background:#102643;margin:24px 0}@media(max-width:800px){body{padding:20px}h1{font-size:30px}.strip{grid-template-columns:repeat(2,minmax(0,1fr))}.creatives{grid-template-columns:1fr}}</style><h1>More tennis. One app.</h1><p class="intro">Seven feature stories. One navy, royal-blue, white and lime system. Real build 324 screens, with fictional sample data and approved brand artwork.</p><div class="notice">Keep the current Apple review moving. These exports are for separate Asset Library staging and the next permitted screenshot update.</div><div class="download"><a href="metadata-en-US.json">Revised metadata</a><a href="description-en-US.txt">Description and EULA</a><a href="asset-manifest.json">Dimensions and source manifest</a><a href="iphone-69/01-lab.png">Open first screenshot at full size</a></div><div class="strip">${thumbImages}</div><h2>Header and search artwork</h2><div class="creatives"><figure><img src="creative/header-3840x1646.png" alt="Header artwork"><figcaption>Header · 3840 × 1646 · key artwork inside Apple's safe area</figcaption></figure><figure><img src="creative/search-3840x2560.png" alt="Search artwork"><figcaption>Search · 3840 × 2560 · key artwork inside Apple's safe area</figcaption></figure></div><h2>Export sets</h2><p><code>iphone-69</code> 1320 × 2868 · <code>iphone-63</code> 1206 × 2622 · <code>ipad-13</code> 2064 × 2752. Seven PNGs per set. All exports are opaque, with their source and SHA-256 hash recorded.</p><p class="intro">Built from the app's actual UI with local sample data. Starter TiQ stays clearly self-assessed. Pro appears on coaching and captain imagery. League and tournament publishing remain separate purchases in the description. No imported-rating or unreleased Match brief features are shown.</p></html>`
 await writeFile(path.join(output,'index.html'),gallery)
 await page.setViewportSize({width:2200,height:1250})
 await page.goto(pathToFileURL(path.join(output,'index.html')).href)
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()))})
 await page.screenshot({path:path.join(output,'asset-overview.png'),fullPage:true})
 console.log('Created '+exports.length+' validated PNG exports, gallery, source manifest and revised copy.')
}finally{await browser.close()}
