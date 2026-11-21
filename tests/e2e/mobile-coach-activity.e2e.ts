import {test,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const origin='http://127.0.0.1:4285',notice='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
let javascript='',stylesheet='',shell=''
test.describe.configure({retries:0,timeout:30000})
test.beforeAll(async()=>{
 const bundle=await build({entryPoints:['tests/fixtures/mobile-navigation.ts'],bundle:true,platform:'browser',format:'esm',outfile:'fixture.js',write:false,jsx:'automatic',define:{TIQ_FIRST_PARTY_BUILD:'true'},loader:{'.module.css':'local-css'},alias:{'next/image':path.resolve('mobile/src/native-website-image.tsx'),'next/link':path.resolve('mobile/src/native-website-link.tsx')},plugins:[{name:'synthetic-coach-activity',setup(b){
  b.onResolve({filter:/^\.\/native-push$/},args=>args.importer.replace(/\\/g,'/').endsWith('/mobile/src/main.ts')?{path:path.resolve('tests/fixtures/mobile-native-coach-alerts.ts')}:undefined)
  b.onResolve({filter:/^@capacitor\/app$/},()=>({path:path.resolve('tests/fixtures/mobile-navigation-app.ts')}))
  b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:path.resolve('tests/fixtures/mobile-navigation-client.ts')}))
 }}]})
 javascript=bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text
 stylesheet=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css','premium-surfaces.css'].map(f=>f==='app.css'?Promise.resolve(bundle.outputFiles.find(file=>file.path.endsWith('.css'))!.text):readFile('mobile/bundled/'+f,'utf8')))).join('\n')
 shell=await readFile('mobile/bundled/index.html','utf8')
})
test.beforeEach(async({page})=>{
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin)return route.abort()
  if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:url.pathname==='/style.css'?stylesheet+(url.searchParams.has('large')?'\n:root{font-size:22px!important}':''):''})
  if(url.pathname.startsWith('/brand/')||url.pathname==='/logo.png')return route.fulfill({contentType:'image/png',body:await readFile('mobile/bundled'+url.pathname)})
  return route.fulfill({contentType:'text/html',body:url.searchParams.has('large')?shell.replace('./style.css','./style.css?large=1'):shell})
 })
})
async function open(page:Page,kind='checkin',large=false){await page.goto(origin+'/?hit-alerts=1&coach-activity='+kind+'&training-inbox-review=1&training-assignment-feedback=1'+(large?'&large=1':''));await expect(page.locator('.lab-scoreboard')).toBeVisible()}
async function tap(page:Page,recipient?:string){await page.evaluate(({notice,recipient})=>(window as unknown as {hitAlertsFixture:{tap:(href:string,recipient?:string)=>void}}).hitAlertsFixture.tap('/mylab?coachActivityNotice='+notice,recipient),{notice,recipient})}
type ActivityState={offline:boolean;hold:boolean;held:boolean;release:()=>void;reads:string[];notices:string[]}
async function activityState(page:Page,change:Partial<Pick<ActivityState,'offline'|'hold'>>={}){return page.evaluate(change=>{
 const state=(window as unknown as {coachingActivityFixture:ActivityState}).coachingActivityFixture;Object.assign(state,change);return {reads:state.reads,notices:state.notices,held:state.held}
},change)}
async function renderFrames(page:Page){await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))}

for(const width of [320,390])for(const kind of ['assignment','checkin','feedback'])test('opens the exact '+kind+' from a first-party iPhone alert at '+width+'px',async({page})=>{
 await page.setViewportSize({width,height:844});await open(page,kind,width===390);await tap(page)
 const dialog=page.getByRole('dialog',{name:kind==='checkin'?'Coach workspace':'Level Up training',exact:true})
 await expect(dialog).toBeVisible()
 await expect(dialog).toContainText(kind==='checkin'?'Deep return under pressure':kind==='feedback'?'Your first step stayed balanced under pressure.':'Second-serve targets')
 if(kind==='checkin')await expect(dialog.getByRole('button',{name:'Review player check-in',exact:true})).toBeVisible()
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
test('keeps an unsent coach form intact and opens the update only after the user closes it',async({page})=>{
 await open(page);await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await page.getByRole('button',{name:'For coaches',exact:true}).click();await page.locator('[data-app-destination="coach-workspace"]').click()
 const dialog=page.getByRole('dialog',{name:'Coach workspace',exact:true});await dialog.getByRole('button',{name:'Add a student',exact:true}).click();await dialog.getByLabel('Player name', {exact:true}).fill('Avery Draft')
 await tap(page);await expect(dialog.getByLabel('Player name',{exact:true})).toHaveValue('Avery Draft')
 await expect(dialog.getByRole('heading',{name:'Add a student',exact:true})).toBeVisible()
 await dialog.getByRole('button',{name:'Close Coach workspace',exact:true}).click();await dialog.getByRole('button',{name:'Discard edits',exact:true}).click()
 await page.getByRole('button',{name:'Open coaching update',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Coach workspace',exact:true})).toContainText('Deep return under pressure')
})
test('rejects another account’s push and a revoked notice without opening unrelated work',async({page})=>{
 await open(page);await tap(page,'99999999-9999-4999-8999-999999999999');await expect(page.getByRole('dialog')).toHaveCount(0)
 expect(await page.evaluate(()=>(window as unknown as {coachingActivityFixture:{reads:string[]}}).coachingActivityFixture.reads)).toEqual([])
 await page.evaluate(()=>(window as unknown as {coachingActivityFixture:{revoked:boolean}}).coachingActivityFixture.revoked=true)
 await tap(page);await expect(page.getByLabel('Coaching update', {exact:true})).toContainText('This coaching update is unavailable.')
 await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('opens an alert from another tab when the app becomes visible again',async({page})=>{
 await open(page);await page.getByRole('button',{name:'More',exact:true}).click()
 await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}))
 await tap(page);await expect(page.getByRole('dialog')).toHaveCount(0)
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))})
 await expect(page.getByRole('dialog',{name:'Coach workspace',exact:true})).toContainText('Deep return under pressure')
})

for(const kind of ['assignment','checkin','feedback'])test('retries the same '+kind+' after a connection failure without a foreground retry loop',async({page},info)=>{
 await page.setViewportSize({width:kind==='checkin'?320:390,height:844});await open(page,kind,true);await activityState(page,{offline:true});await tap(page)
 const handoff=page.getByLabel('Coaching update',{exact:true});await expect(handoff).toContainText('Couldn’t load this coaching update.');await expect(handoff.getByRole('button',{name:'Retry coaching update',exact:true})).toBeEnabled();await expect(page.getByRole('dialog')).toHaveCount(0)
 await activityState(page,{offline:false});await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))});await renderFrames(page)
 expect((await activityState(page)).notices).toEqual([notice]);expect(await page.evaluate(()=>(window as unknown as {firstPartyUpdatesFixture:{calls:string[]}}).firstPartyUpdatesFixture.calls.filter(call=>call==='mark'))).toEqual([])
 await handoff.screenshot({path:info.outputPath('coaching-update-retry-'+kind+'.png')});await handoff.getByRole('button',{name:'Retry coaching update',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:kind==='checkin'?'Coach workspace':'Level Up training',exact:true});await expect(dialog).toContainText(kind==='checkin'?'Deep return under pressure':kind==='feedback'?'Your first step stayed balanced under pressure.':'Second-serve targets')
 expect((await activityState(page)).notices).toEqual([notice,notice]);expect(await page.evaluate(()=>(window as unknown as {firstPartyUpdatesFixture:{calls:string[]}}).firstPartyUpdatesFixture.calls.filter(call=>call==='mark'))).toEqual(['mark'])
})

test('rechecks the same owned notice after a lost read-confirmation reply',async({page})=>{
 await open(page);await page.evaluate(()=>(window as unknown as {firstPartyUpdatesFixture:{loseMarkReply:boolean}}).firstPartyUpdatesFixture.loseMarkReply=true);await tap(page)
 const handoff=page.getByLabel('Coaching update',{exact:true});await expect(handoff.getByRole('button',{name:'Retry coaching update',exact:true})).toBeEnabled();await expect(page.getByRole('dialog')).toHaveCount(0)
 await handoff.getByRole('button',{name:'Retry coaching update',exact:true}).click();await expect(page.getByRole('dialog',{name:'Coach workspace',exact:true})).toContainText('Deep return under pressure')
 expect((await activityState(page)).notices).toEqual([notice,notice]);expect(await page.evaluate(()=>(window as unknown as {firstPartyUpdatesFixture:{calls:string[];coachNotices:{id:string;read_at:string|null}[]}}).firstPartyUpdatesFixture.calls.filter(call=>call==='mark'))).toEqual(['mark','mark'])
 expect(await page.evaluate(()=>(window as unknown as {firstPartyUpdatesFixture:{coachNotices:unknown[]}}).firstPartyUpdatesFixture.coachNotices.length)).toBe(1)
})

test('discards a delayed recovery response when the signed-in account changes',async({page})=>{
 await open(page);await activityState(page,{offline:true});await tap(page);const handoff=page.getByLabel('Coaching update',{exact:true});await expect(handoff.getByRole('button',{name:'Retry coaching update',exact:true})).toBeEnabled()
 await activityState(page,{offline:false,hold:true});await handoff.getByRole('button',{name:'Retry coaching update',exact:true}).click();await expect.poll(async()=>(await activityState(page)).held).toBe(true)
 await page.evaluate(()=>(window as unknown as {switchNavigationOwner:()=>void}).switchNavigationOwner());await expect(handoff).toBeHidden();await page.evaluate(()=>(window as unknown as {coachingActivityFixture:ActivityState}).coachingActivityFixture.release());await renderFrames(page)
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(handoff).toBeHidden();expect(await page.evaluate(()=>(window as unknown as {firstPartyUpdatesFixture:{calls:string[]}}).firstPartyUpdatesFixture.calls.filter(call=>call==='mark'))).toEqual([])
})

test('keeps an unsent coach form while a failed coaching alert waits for explicit retry',async({page})=>{
 await open(page);await activityState(page,{offline:true});await tap(page);await expect(page.getByRole('button',{name:'Retry coaching update',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await page.getByRole('button',{name:'For coaches',exact:true}).click();await page.locator('[data-app-destination="coach-workspace"]').click()
 const dialog=page.getByRole('dialog',{name:'Coach workspace',exact:true});await dialog.getByRole('button',{name:'Add a student',exact:true}).click();await dialog.getByLabel('Player name',{exact:true}).fill('Avery Draft');await activityState(page,{offline:false});await renderFrames(page)
 await expect(dialog.getByLabel('Player name',{exact:true})).toHaveValue('Avery Draft');expect((await activityState(page)).notices).toEqual([notice])
 await dialog.getByRole('button',{name:'Close Coach workspace',exact:true}).click();await dialog.getByRole('button',{name:'Discard edits',exact:true}).click();await page.getByRole('button',{name:'Retry coaching update',exact:true}).click();await expect(page.getByRole('dialog',{name:'Coach workspace',exact:true})).toContainText('Deep return under pressure')
})
