import {build} from 'esbuild'
import {chromium,expect} from '@playwright/test'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {nativeWebsiteAdapters} from '../../mobile/scripts/native-website-adapters.mjs'

const root=fileURLToPath(new URL('../../',import.meta.url))
const output=path.resolve(root,'../../output/app-store-premium-20261119')
const origin='http://127.0.0.1:4289'
await mkdir(path.join(output,'sources'),{recursive:true})
const bundle=await build({absWorkingDir:root,entryPoints:['tests/fixtures/mobile-navigation.ts'],bundle:true,platform:'browser',format:'esm',outfile:'fixture.js',write:false,jsx:'automatic',define:{TIQ_FIRST_PARTY_BUILD:'true',TIQ_TOURNAMENT_PRACTICE:'false'},loader:{'.module.css':'local-css'},plugins:[nativeWebsiteAdapters(),{name:'synthetic-store-account',setup(builder){
 builder.onResolve({filter:/^\.\.\/\.\.\/lib\/native-auth-storage$/},args=>args.importer.replaceAll('\\','/').endsWith('/mobile/src/team-score-drafts.ts')?{path:path.join(root,'tests/fixtures/mobile-native-draft-storage.ts')}:undefined)
 builder.onResolve({filter:/^\.\/native-push$/},args=>args.importer.replaceAll('\\','/').endsWith('/mobile/src/main.ts')?{path:path.join(root,'tests/fixtures/mobile-native-coach-alerts.ts')}:undefined)
 builder.onResolve({filter:/^@capacitor\/app$/},()=>({path:path.join(root,'tests/fixtures/mobile-navigation-app.ts')}))
 builder.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:path.join(root,'tests/fixtures/mobile-navigation-client.ts')}))
}}]})
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text
const css=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css','premium-surfaces.css'].map(file=>file==='app.css'?Promise.resolve(bundle.outputFiles.find(file=>file.path.endsWith('.css')).text):readFile(path.join(root,'mobile/bundled',file),'utf8')))).join('\n')+'\n.preview-controls{display:none!important}'
const html=await readFile(path.join(root,'mobile/bundled/index.html'),'utf8')
const captured=[]
const browser=await chromium.launch({headless:true})
const scenes=['lab','chat','practice','explore','coach','league','tournament']
const only=process.argv.find(value=>value.startsWith('--only='))?.slice(7)
const onlyDevice=process.argv.find(value=>value.startsWith('--device='))?.slice(9)
try{
 for(const device of [{name:'iphone-69',width:440,height:956,scale:3},{name:'iphone-63',width:402,height:874,scale:3},{name:'ipad-13',width:1032,height:1376,scale:2}].filter(device=>!onlyDevice||device.name===onlyDevice)){
  await mkdir(path.join(output,'sources',device.name),{recursive:true})
  const context=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.scale,isMobile:true,hasTouch:true,locale:'en-US',timezoneId:'America/Chicago'})
  for(const scene of scenes.filter(name=>!only||name===only)){
   const page=await context.newPage()
   const errors=[];page.on('pageerror',error=>errors.push(error.message))
   await page.clock.setFixedTime(new Date('2026-11-19T15:41:00Z'))
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url())
    if(url.origin!==origin)return route.abort()
    if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:js})
    if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:url.pathname==='/style.css'?css:''})
    if(url.pathname.startsWith('/brand/')||url.pathname==='/logo.png')return route.fulfill({contentType:'image/png',body:await readFile(path.join(root,'mobile/bundled',url.pathname))})
    return route.fulfill({contentType:'text/html',body:html})
   })
   await page.addInitScript(()=>{
    localStorage.setItem('starter-tiq:v2:11111111-1111-4111-8111-111111111111',JSON.stringify({current:{date:'2026-11-19',answers:{serve:1,return:2,rally:2,movement:2,net:2,points:2,singlesCreate:2,singlesRecover:2}},previous:null}))
   })
   const query='?unlinked=1&private-team-tools=captain&manual-team-schedule=1&posted-practice=1'
   await page.goto(origin+query,{waitUntil:'domcontentloaded'})
   await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible()
   const nav=page.getByRole('navigation',{name:'Main navigation'})
   let focus=page.locator('body')
   // All sample data stays local. Capture the production UI without changing its markup or styles.
   await page.evaluate(()=>{
    const original=window.fetch.bind(window)
    window.fetch=async(input,init)=>{
     const response=await original(input,init)
     const address=new URL(input instanceof Request?input.url:String(input),location.href)
     if(address.origin===location.origin)return response
     let data
     try{data=JSON.parse((await response.clone().text()).replaceAll('2030-06-09','2026-11-21').replaceAll('Sun, Jun 9','Sat, Nov 21'))}catch{return response}
     if(data.room?.messages){
      const room=data.room
      room.messages=room.messages.map((message,index)=>({...message,createdAt:`2026-11-19T14:${30+index}:00Z`,...(message.body.includes('Anyone up')?{senderName:'Alex Rivera',body:'Saturday practice is on. Who’s joining us?'}:{})}))
     }
     return Response.json(data,{status:response.status})
    }
   })
   if(scene==='lab'){
    focus=page.getByRole('region',{name:'Starter TiQ',exact:true})
    await expect(focus).toContainText('Self-assessed')
   }else if(scene==='chat'||scene==='practice'){
    await nav.getByRole('button',{name:/^Chats/}).click()
    await page.getByRole('button',{name:/^Baseline Aces.*Weekend Tennis/}).click()
    await expect(page.locator('.team-conversation')).toBeVisible()
    if(scene==='practice'){
     await page.locator('.chat-room-options>summary').click()
     await page.locator('#chat-practices').click()
     focus=page.getByRole('dialog',{name:'Captain practices',exact:true})
     await focus.getByRole('button',{name:/^Open practice/}).click()
     await expect(focus.getByRole('heading',{name:'Practice sign-ups',exact:true})).toBeVisible()
     await focus.getByRole('heading',{name:'Practice sign-ups',exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}))
    }
   }else if(scene==='explore'){
    await nav.getByRole('button',{name:'Explore',exact:true}).click()
    await expect(page.locator('.native-explore-hero')).toBeVisible()
   }else if(scene==='coach'){
    await nav.getByRole('button',{name:'More',exact:true}).click()
    await page.locator('[data-app-destination="coach"]').click()
    await page.getByRole('button',{name:'For coaches',exact:true}).click()
    await page.locator('[data-app-destination="coach-workspace"]').click()
    await page.locator('[data-coach-student]').first().click()
    await page.locator('[data-coach-assignment]').first().click()
    focus=page.locator('dialog:visible').last()
    await expect(page.locator('[data-coach-review]')).toBeVisible()
   }else if(scene==='league'){
    await nav.getByRole('button',{name:'Compete',exact:true}).click()
    await page.getByRole('button',{name:/^Browse leagues/}).click()
    focus=page.getByRole('dialog',{name:'Competitions',exact:true})
    await focus.getByRole('button',{name:/^Open league Northside Night League/}).click()
    await focus.getByRole('button',{name:'Standings',exact:true}).click()
    await expect(focus.getByText('Baseline Aces',{exact:true})).toBeVisible()
   }else if(scene==='tournament'){
    await nav.getByRole('button',{name:'Compete',exact:true}).click()
    await page.getByRole('button',{name:/^Browse tournaments/}).click()
    focus=page.getByRole('dialog',{name:'Tournaments',exact:true})
    await focus.getByRole('button',{name:/^Open tournament Northside Open/}).click()
    await focus.getByRole('button',{name:/^Open division 4.0 Doubles/}).click()
    await focus.getByRole('button',{name:'Draw',exact:true}).click()
    await expect(focus.getByRole('heading',{name:'Draw',exact:true})).toBeVisible()
   }
   await page.evaluate(async()=>{
    await document.fonts.ready
    await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
   })
   await expect(page.locator('.preview-controls')).toBeHidden()
   if(await page.locator('body').innerText().then(text=>/USTA current|Recorded TiQ|OVERALL TIQ/.test(text)))throw Error('Legacy rating UI in '+scene)
   if(errors.length)throw Error(scene+' page errors: '+errors.join('; '))
   const target=path.join(output,'sources',device.name,scene+'.png')
   await page.screenshot({path:target,animations:'disabled',timeout:15000})
   await writeFile(target.replace('.png','.txt'),await page.locator('body').innerText())
   const details=scene==='lab'?{detail:focus,context:page.locator('.lab-up-next:visible').first()}:
    scene==='practice'?{detail:focus.locator('.captain-practice-roster')}:
    scene==='coach'?{detail:focus.locator('.coach-plan'),context:focus.locator('.coach-proof').first()}:
    scene==='league'?{detail:focus.locator('.competition-standings')}:{}
   for(const [part,locator] of Object.entries(details)){
    if(await locator.count()&&await locator.isVisible())await locator.screenshot({path:target.replace('.png','-'+part+'.png'),animations:'disabled',style:'.app-navigation{visibility:hidden!important}'})
   }
   captured.push({device:device.name,scene,file:target,width:device.width*device.scale,height:device.height*device.scale,sourceCommit:'9fe0931d5d06a372354e39f427da98e1643bca98',sampleData:true})
   console.log('Captured '+device.name+'/'+scene)
   await page.close()
  }
  await context.close()
 }
 const manifestFile=path.join(output,'sources','capture-manifest.json')
 const earlier=await readFile(manifestFile,'utf8').then(text=>JSON.parse(text).captured).catch(()=>[])
 const combined=[...earlier.filter(row=>!captured.some(next=>next.device===row.device&&next.scene===row.scene)),...captured]
 await writeFile(manifestFile,JSON.stringify({build:324,sourceCommit:'9fe0931d5d06a372354e39f427da98e1643bca98',method:'Production native UI with isolated synthetic data; no live services',captured:combined},null,2)+'\n')
}finally{await browser.close()}
