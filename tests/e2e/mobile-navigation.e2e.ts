import '../fixtures/mobile-coach-unread-cases'
import '../fixtures/mobile-coach-catchup-cases'
import '../fixtures/mobile-coach-alerts-cases'
import '../fixtures/mobile-chat-receipts-cases'
import '../fixtures/mobile-coach-chats-cases'
import '../fixtures/mobile-chat-catchup-cases'
import '../fixtures/mobile-calendar-practices-cases'
import {test,expect,type Page} from '@playwright/test'
import '../fixtures/mobile-calendar-cases'
import '../fixtures/mobile-chat-alert-cases'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const origin='http://127.0.0.1:4283'
let javascript='',stylesheet='',documentHtml=''
test.describe.configure({retries:0,timeout:25000})
test.beforeAll(async()=>{
 const bundle=await build({entryPoints:['tests/fixtures/mobile-navigation.ts'],bundle:true,platform:'browser',format:'esm',outfile:'fixture.js',write:false,jsx:'automatic',loader:{'.module.css':'local-css'},alias:{'next/image':path.resolve('mobile/src/native-website-image.tsx'),'next/link':path.resolve('mobile/src/native-website-link.tsx')},plugins:[{name:'synthetic-account',setup(b){b.onResolve({filter:/^\.\/native-push$/},args=>args.importer.replace(/\\/g,"/").endsWith("/mobile/src/main.ts")?{path:path.resolve("tests/fixtures/mobile-native-coach-alerts.ts")}:undefined);b.onResolve({filter:/^@capacitor\/app$/},()=>({path:path.resolve('tests/fixtures/mobile-navigation-app.ts')}));b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:path.resolve('tests/fixtures/mobile-navigation-client.ts')}))}}]})
 javascript=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 stylesheet=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css'].map(file=>file==='app.css'?Promise.resolve(bundle.outputFiles.find(file=>file.path.endsWith('.css'))!.text):readFile('mobile/bundled/'+file,'utf8')))).join('\n')+'\n.preview-controls{padding:24px 12px 120px}.preview-controls button{min-height:44px}'
 documentHtml=await readFile('mobile/bundled/index.html','utf8')
})
test.beforeEach(async({page})=>{
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin)return route.abort()
  if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:url.pathname==='/style.css'?stylesheet+(url.searchParams.has('large')?'\n:root{font-size:22px!important}.native-calendar-screen .cal-body{inline-size:calc(100% - 18px)}':''):''})
  if(url.pathname.startsWith('/brand/')||url.pathname==='/logo.png')return route.fulfill({contentType:'image/png',body:await readFile('mobile/bundled'+url.pathname)})
  return route.fulfill({contentType:'text/html',body:url.searchParams.has('large')?documentHtml.replace('./style.css','./style.css?large=1'):documentHtml})
 })
})
async function bounded(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(await page.locator('.app-navigation').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 for(const button of await page.locator('.app-tools-hub .app-tool:visible').all())expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
}
const requestCount=(page:Page)=>page.evaluate(()=>(window as unknown as {navigationFixture:{requests:number}}).navigationFixture.requests)
type UpdatesPreviewWindow=Window&{updatesFixture:{failList:boolean;failCount:boolean;loseWrite:boolean;deferList:boolean;release:()=>void;queries:{table:string;method:string;ids:string[];owner:string|null}[];rows:{id:string;read_at:string|null}[]};refreshNavigationSession:()=>void;switchNavigationOwner:()=>void}
async function updatesScreen(page:Page,width=390){
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 const entry=page.locator('.native-updates-entry');await expect(entry).toHaveAttribute('aria-label','Updates, 23 unread');await entry.click()
 const dialog=page.getByRole('dialog',{name:'Updates',exact:true});await expect(dialog.locator('.updates-item')).toHaveCount(25);await expect(dialog).toContainText('23 unread updates');return dialog
}
for(const width of [320,390])test('Updates uses a readable header, local safe previews and scoped filters at '+width+'px',async({page},info)=>{
 const dialog=await updatesScreen(page,width)
 await expect(dialog.locator('img[src="x"]')).toHaveCount(0);await expect(dialog).toContainText('<img src=x onerror=alert(1)>')
 const external=dialog.locator('article').filter({hasText:'A safe text preview'});await expect(external.getByRole('button')).toHaveCount(0)
 await dialog.getByRole('combobox',{name:'Type',exact:true}).selectOption('schedule');await expect(dialog.locator('.updates-item')).toHaveCount(8);await expect(dialog).toContainText('23 unread updates')
 const before=await page.evaluate(()=>(window as unknown as UpdatesPreviewWindow).updatesFixture.queries.length)
 await page.evaluate(()=>(window as unknown as UpdatesPreviewWindow).refreshNavigationSession());await expect(dialog).toBeVisible();await expect(dialog.getByRole('combobox',{name:'Type',exact:true})).toHaveValue('schedule')
 expect(await page.evaluate(()=>(window as unknown as UpdatesPreviewWindow).updatesFixture.queries.length)).toBe(before)
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:info.outputPath('updates-'+width+'.png')})
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('.native-updates-entry')).toBeFocused()
 const logo=await page.locator('.app-header img').boundingBox(),bell=await page.locator('.native-updates-entry').boundingBox(),account=await page.getByRole('button',{name:'Account settings',exact:true}).boundingBox()
 expect(logo!.x+logo!.width).toBeLessThanOrEqual(bell!.x);expect(bell!.width).toBeGreaterThanOrEqual(44);expect(account!.x+account!.width).toBeLessThanOrEqual(width)
 await page.screenshot({path:info.outputPath('updates-header-'+width+'.png')})
})
test('Updates opens the exact league and returns to its read row without discarding the inbox',async({page})=>{
 const dialog=await updatesScreen(page),row=dialog.locator('article').filter({hasText:'Your league season is ready'})
 await row.getByRole('button',{name:'Open league',exact:false}).click();const child=page.getByRole('dialog',{name:'Competitions',exact:true});await expect(child).toContainText('Northside Night League');await expect(dialog).toBeVisible()
 await child.getByRole('button',{name:'← Competitions',exact:true}).click();await child.getByRole('button',{name:'Close',exact:true}).click();await expect(row).not.toHaveClass(/is-unread/);await expect(row.getByRole('button',{name:'Open league',exact:false})).toBeFocused();await expect(page.locator('.native-updates-entry')).toHaveAttribute('aria-label','Updates, 22 unread')
})
test('Updates opens a published tournament and preserves its parent on return',async({page})=>{
 const dialog=await updatesScreen(page);await dialog.locator('article').filter({hasText:'Tournament entry approved'}).getByRole('button',{name:'Open tournament',exact:false}).click()
 const child=page.getByRole('dialog',{name:'Tournaments',exact:true});await expect(child).toContainText('Northside Open');await child.getByRole('button',{name:'← Tournaments',exact:true}).click();await child.getByRole('button',{name:'Back to updates',exact:true}).click();await expect(dialog).toBeVisible();await expect(dialog.locator('.updates-item')).toHaveCount(25)
})
test('Updates targets the requested Coach conversation and preserves an unsent child draft across resume',async({page})=>{
 const dialog=await updatesScreen(page);await dialog.locator('article').filter({hasText:'Taylor sent a coaching note'}).getByRole('button',{name:'Open conversation',exact:false}).click()
 const child=page.getByRole('dialog',{name:'Coach messages',exact:true});await expect(child.getByRole('combobox',{name:'Conversation',exact:true})).toHaveValue('99999999-9999-4999-8999-999999999991');await expect(child).toContainText('Bring your return notes')
 await child.getByRole('textbox',{name:'Message',exact:true}).fill('Keep my lesson draft')
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))})
 await expect(child.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep my lesson draft')
 await child.getByRole('button',{name:'Close',exact:true}).click();await expect(child).toContainText('Leave this message?');await child.getByRole('button',{name:'Keep writing',exact:true}).click();await expect(child.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep my lesson draft')
 await page.evaluate(()=>(window as unknown as UpdatesPreviewWindow).switchNavigationOwner());await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.native-updates-entry')).toHaveAttribute('aria-label','Updates, 0 unread')
})
test('Updates: mark shown read reviews only loaded unread IDs and leaves older unread updates alone',async({page})=>{
 const dialog=await updatesScreen(page);await dialog.getByRole('button',{name:'Mark shown read',exact:true}).click();await expect(dialog).toContainText('Mark 18 updates read?')
 await dialog.getByRole('button',{name:'Keep unread',exact:true}).click();expect(await page.evaluate(()=>(window as unknown as UpdatesPreviewWindow).updatesFixture.queries.filter(q=>q.method==='PATCH').length)).toBe(0)
 await dialog.getByRole('button',{name:'Mark shown read',exact:true}).click();await dialog.getByRole('button',{name:'Mark 18 read',exact:true}).click();await expect(dialog).toContainText('18 updates marked read.');await expect(page.locator('.native-updates-entry')).toHaveAttribute('aria-label','Updates, 5 unread')
 const patches=await page.evaluate(()=>(window as unknown as UpdatesPreviewWindow).updatesFixture.queries.filter(q=>q.method==='PATCH'));expect(patches).toHaveLength(1);expect(patches[0].ids).toHaveLength(18);expect(patches[0].owner).toBe('11111111-1111-4111-8111-111111111111')
 await dialog.getByRole('group',{name:'Read status'}).getByRole('button',{name:'Unread',exact:true}).click();await expect(dialog.locator('.updates-item')).toHaveCount(5)
})
test('older Updates load by cursor without replacing the first page',async({page})=>{
 const dialog=await updatesScreen(page),body=dialog.locator('.updates-body');const before=await body.evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop})
 await dialog.getByRole('button',{name:'Load older updates',exact:true}).click();await expect(dialog.locator('.updates-item')).toHaveCount(31);await expect(dialog.locator('[data-updates-older]')).toHaveCount(0);await expect(dialog).toContainText('6 older updates loaded.');expect(await body.evaluate(el=>el.scrollTop)).toBeGreaterThan(before-300)
 await dialog.locator('.updates-item').last().getByRole('button',{name:'Mark read',exact:true}).click();await expect(dialog.locator('.updates-item').last()).not.toHaveClass(/is-unread/);expect(await body.evaluate(el=>el.scrollTop)).toBeGreaterThan(before-300)
 expect(await dialog.locator('.updates-item').evaluateAll(nodes=>new Set(nodes.map(n=>n.getAttribute('data-update'))).size)).toBe(31)
})
test('Updates: an interrupted read-status save stays locked until an explicit refresh confirms it',async({page})=>{
 const dialog=await updatesScreen(page);await page.evaluate(()=>{(window as unknown as UpdatesPreviewWindow).updatesFixture.loseWrite=true})
 await dialog.locator('.is-unread').first().getByRole('button',{name:'Mark read',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('not confirmed');await expect(dialog.locator('[data-read-update]').first()).toBeDisabled()
 expect(await page.evaluate(()=>(window as unknown as UpdatesPreviewWindow).updatesFixture.queries.filter(q=>q.method==='PATCH').length)).toBe(1)
 await dialog.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.locator('.native-updates-entry')).toHaveAttribute('aria-label','Updates, 22 unread');await expect(dialog.locator('[data-read-update]').first()).toBeEnabled()
 expect(await page.evaluate(()=>(window as unknown as UpdatesPreviewWindow).updatesFixture.queries.filter(q=>q.method==='PATCH').length)).toBe(1)
})
test('Updates: failed reads and unread counts are distinct from an empty inbox or zero unread',async({page})=>{
 const dialog=await updatesScreen(page);await page.evaluate(()=>{(window as unknown as UpdatesPreviewWindow).updatesFixture.failList=true})
 await dialog.getByRole('button',{name:'Refresh',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('couldn’t load');await expect(dialog.locator('.updates-empty')).toHaveCount(0)
 await dialog.getByRole('button',{name:'Retry updates',exact:true}).click();await expect(dialog.locator('.updates-item')).toHaveCount(25)
 await page.evaluate(()=>{(window as unknown as UpdatesPreviewWindow).updatesFixture.failCount=true});await dialog.getByRole('button',{name:'Refresh',exact:true}).click();await expect(dialog).toContainText('Unread total is unavailable');await expect(dialog.locator('.updates-item')).toHaveCount(25);await expect(page.locator('.updates-header-badge')).toBeHidden()
})
test('Updates: a late old-account inbox response cannot replace the next account',async({page})=>{
 const dialog=await updatesScreen(page);await page.evaluate(()=>{(window as unknown as UpdatesPreviewWindow).updatesFixture.deferList=true});await dialog.getByRole('button',{name:'Refresh',exact:true}).click();await expect(dialog).toContainText('Refreshing your updates')
 await page.evaluate(()=>(window as unknown as UpdatesPreviewWindow).switchNavigationOwner());await expect(page.getByRole('dialog')).toHaveCount(0);await page.evaluate(()=>(window as unknown as UpdatesPreviewWindow).updatesFixture.release());await expect(page.locator('.native-updates-entry')).toHaveAttribute('aria-label','Updates, 0 unread')
 await page.locator('.native-updates-entry').click();const next=page.getByRole('dialog',{name:'Updates',exact:true});await expect(next).toContainText('No updates in this view.');await expect(next.locator('.updates-item')).toHaveCount(0)
})
for(const width of [320,390])test('tool search stays local, accessible and preserves the opener at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 await expect(page.locator('.lab-scoreboard')).toContainText('4.42')
 await page.getByRole('button',{name:'More',exact:true}).click()
 const input=page.getByRole('searchbox',{name:'Find a tool',exact:true}),count=page.locator('[data-tool-count]'),tools=page.locator('.app-tool:visible')
 await expect(count).toHaveText('11 tools')
 const requests=await requestCount(page)
 await input.fill('  FACE   ID ');await expect(count).toHaveText('1 tool found');await expect(tools).toHaveCount(1);await expect(tools).toHaveAttribute('data-app-destination','account')
 await input.press('Tab');await expect(page.getByRole('button',{name:'Clear',exact:true})).toBeFocused()
 await page.getByRole('button',{name:'Clear',exact:true}).press('Tab');await expect(tools).toBeFocused()
 await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(input).toBeFocused();await expect(count).toHaveText('11 tools')
 await input.fill('coaching');await expect(tools).toHaveAttribute('data-app-destination','coach')
 await input.fill('uploads');await expect(tools).toHaveAttribute('data-app-destination','imports')
 await input.fill('STÁNDINGS');await expect(tools).toHaveAttribute('data-app-destination','leagues')
 await input.fill('<img src=x>');await expect(count).toHaveText('0 tools found');await expect(page.locator('[data-tools-empty]')).toBeVisible();await expect(page.locator('.app-hub-group:visible')).toHaveCount(0)
 await bounded(page);await expect(input).toBeFocused();expect(await requestCount(page)).toBe(requests)
 await input.press('Escape');await expect(count).toHaveText('11 tools');await expect(page.locator('[data-tools-empty]')).toBeHidden()
 await input.fill('tournaments');await expect(tools).toHaveCount(1);await bounded(page)
 await page.screenshot({path:info.outputPath('tools-search.png')})
 const opener=page.locator('[data-app-destination="tournaments"]');await opener.click()
 const event=page.getByRole('dialog',{name:'Tournaments',exact:true});await expect(event).toContainText('Northside Open')
 await event.getByRole('button',{name:'Close',exact:true}).click();await expect(opener).toBeFocused();await expect(input).toHaveValue('tournaments');await expect(tools).toHaveCount(1)
 await page.getByRole('button',{name:'Simulate token refresh',exact:true}).click();await expect(input).toHaveValue('tournaments')
 await page.getByRole('button',{name:'Simulate reconnect',exact:true}).click();await expect(input).toHaveValue('tournaments')
 await page.getByRole('button',{name:'Simulate token refresh',exact:true}).click()
 await page.getByRole('button',{name:'More',exact:true}).click();await expect(input).toHaveValue('');await expect(count).toHaveText('11 tools')
 await page.screenshot({path:info.outputPath('tools-directory.png')});await bounded(page)
 for(const button of await tools.all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
 await input.fill('uploads');await page.getByRole('button',{name:'Switch synthetic account',exact:true}).click()
 await expect(input).toHaveCount(0);await expect(page.locator('.lab-scoreboard')).toContainText('4.42')
 await page.getByRole('button',{name:'More',exact:true}).click();await expect(input).toHaveValue('');await expect(count).toHaveText('11 tools')
})
for(const width of [320,390])test('all destinations, direct competitions, focus return and reconnect at '+width+'px',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width,height:844});await page.goto(origin)
 await expect(page.locator('.lab-scoreboard')).toContainText('4.42');await expect(page.locator('.app-navigation button>span:last-child')).toHaveText(['My Lab','Explore','Chats','Compete','More']);await bounded(page)
 const scene=page.locator('.rating-court-scene');await expect(scene).toHaveAttribute('width','1727');expect(await scene.evaluate(el=>getComputedStyle(el).objectFit)).toBe('contain')
 expect(await page.evaluate(()=>{const score=document.querySelector('.lab-scoreboard')!,form=document.querySelector('.lab-form-host')!,focus=document.querySelector('#lab-identity')!;return Boolean(score.compareDocumentPosition(form)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(form.compareDocumentPosition(focus)&Node.DOCUMENT_POSITION_FOLLOWING)})).toBe(true)
 await page.screenshot({path:info.outputPath('home.png')})
 await page.locator('.app-navigation [data-screen="teams"]').click();await expect(page.getByRole('heading',{name:'Chats',exact:true})).toBeVisible();await page.getByRole('button',{name:'Compete',exact:true}).click();await expect(page.getByRole('heading',{name:'Compete',exact:true})).toBeFocused()
 const leagues=page.locator('[data-app-destination="leagues"]');await leagues.click();const league=page.getByRole('dialog',{name:'Competitions',exact:true});await expect(league).toContainText('Northside Night League');await league.getByRole('button',{name:/^Open league/}).click();await expect(league).toContainText('Coming up');await league.getByRole('button',{name:'← Competitions',exact:true}).click();await league.getByRole('button',{name:'Close',exact:true}).click();await expect(leagues).toBeFocused()
 const tournaments=page.locator('[data-app-destination="tournaments"]');await tournaments.click();const event=page.getByRole('dialog',{name:'Tournaments',exact:true});await expect(event).toContainText('Northside Open');await event.getByRole('button',{name:'Close',exact:true}).click();await expect(tournaments).toBeFocused()
 await page.getByRole('button',{name:'Simulate token refresh',exact:true}).click();await expect(page.getByRole('heading',{name:'Compete',exact:true})).toBeVisible();await page.getByRole('button',{name:'Simulate reconnect',exact:true}).click();await expect(page.getByRole('heading',{name:'Compete',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'More',exact:true}).click();await expect(page.locator('[data-app-destination="following"]')).toBeVisible();await page.locator('[data-app-destination="following"]').click();await expect(page.locator('#following-list')).toBeVisible();await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="matchup"]').click();await expect(page.locator('#comparison-list')).toBeVisible();await expect(page.locator('.app-navigation [data-screen="more"]')).toHaveAttribute('aria-current','page')
 await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await expect(page.getByRole('heading',{name:'Coach & training',exact:true})).toBeVisible();await expect(page.locator('[data-app-destination="coach-web"]')).toHaveCount(0);await expect(page.locator('[data-app-destination="coach-tactics"]')).toBeVisible();await expect(page.locator('[data-app-destination="coach-video"]')).toBeVisible()
 await page.locator('[data-app-destination="training-inbox"]').click();await expect(page.getByRole('dialog',{name:'Level Up training',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close Level Up',exact:true}).click();await expect(page.getByRole('heading',{name:'Coach & training',exact:true})).toBeVisible()
 await page.goto(origin+'/?large=1');await expect(page.locator('.lab-scoreboard')).toContainText('4.42');await bounded(page);await page.getByRole('button',{name:'Compete',exact:true}).click();await bounded(page);await page.getByRole('button',{name:'More',exact:true}).click();await bounded(page);await page.screenshot({path:info.outputPath('more-large-text.png')})
 await page.locator('[data-app-destination="tournaments"]').click();await expect(event).toContainText('Northside Open');await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click());await expect(event).toHaveCount(0);await expect(page.locator('.lab-scoreboard')).toContainText('4.42');expect(errors).toEqual([])
})

test('the complete approved court fits its stage at wider phone/tablet sizes',async({page})=>{
 for(const width of [600,844]){
  await page.setViewportSize({width,height:844});await page.goto(origin);await expect(page.locator('.lab-scoreboard')).toContainText('4.42')
  expect(await page.locator('.rating-court-scene').evaluate(el=>{const scene=el.getBoundingClientRect(),row=el.parentElement!.querySelector('.lab-rating-chart>div')!.getBoundingClientRect();return scene.top>=row.top-1&&scene.bottom<=row.bottom+1&&scene.width<=row.width+1})).toBe(true)
  await bounded(page)
  for(const destination of ['Compete','More']){await page.getByRole('button',{name:destination,exact:true}).click();await bounded(page)}
 }
})


const sharedLeague='https://www.tenaceiq.com/explore/leagues/tiq/league-one'
async function incomingLink(page:Page,url:string){await page.evaluate(value=>(window as unknown as {openSyntheticLink:(value:string)=>void}).openSyntheticLink(value),url)}
test('cold shared league continues through sign-in and opens the same season',async({page})=>{
 await page.goto(origin+'/?signedOut=1&link='+encodeURIComponent(sharedLeague))
 await expect(page.locator('.app-link-handoff')).toContainText('Sign in to continue')
 await page.locator('.welcome-account form input[name=email]').fill('preview@example.test');await page.locator('.welcome-account form input[name=password]').fill('synthetic-password');await page.locator('.welcome-account form button').click()
 const league=page.getByRole('dialog',{name:'Competitions',exact:true});await expect(league).toContainText('Northside Night League');await expect(league).toContainText('Coming up');await expect(page.locator('.app-link-handoff')).toBeHidden()
 await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-preview-refresh]')!.click());await expect(league).toContainText('Coming up');await bounded(page)
})
test('warm links wait for the current modal and clear on account switch',async({page})=>{
 await page.goto(origin);await expect(page.locator('.lab-scoreboard')).toContainText('4.42')
 await page.getByRole('button',{name:'Compete',exact:true}).click();await page.locator('[data-app-destination=tournaments]').click()
 await incomingLink(page,sharedLeague);await expect(page.getByRole('dialog',{name:'Tournaments',exact:true})).toBeVisible()
 await page.getByRole('dialog',{name:'Tournaments',exact:true}).getByRole('button',{name:'Close',exact:true}).click();await page.locator('[data-link-open]').click()
 await expect(page.getByRole('dialog',{name:'Competitions',exact:true})).toContainText('Coming up')
 await incomingLink(page,'https://www.tenaceiq.com/coach/invite/secret-fixture-token');await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click())
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.app-link-handoff')).toBeHidden();await expect(page.locator('.lab-scoreboard')).toContainText('4.42')
 expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>String(localStorage.getItem(key)).includes('secret-fixture-token')))).toBe(false)
})
for(const width of [320,390])test('first player setup stays usable at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?unlinked=1&large=1')
 await expect(page.getByRole('heading',{name:'Your tennis starts here.',exact:true})).toBeVisible();await expect(page.locator('.lab-scoreboard')).toHaveCount(0);await bounded(page);await page.screenshot({path:info.outputPath('player-setup.png')})
 await page.getByRole('button',{name:'Use a team invite',exact:true}).click();await expect(page.getByRole('dialog',{name:'Join a team',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click()
 await page.getByRole('button',{name:'Find my player',exact:true}).click();await page.locator('#player-search input').fill('Jordan Lee');await page.getByRole('button',{name:'Search players',exact:true}).click();await page.getByRole('button',{name:/Review this record/}).click();await page.getByRole('button',{name:'Connect my player',exact:true}).click()
 await expect(page.locator('.lab-scoreboard')).toContainText('4.42');await expect(page.getByRole('heading',{name:'Your tennis starts here.',exact:true})).toHaveCount(0);await bounded(page)
})
test('unsupported and sign-in callback URLs never become content navigation',async({page})=>{
 await page.goto(origin);await expect(page.locator('.lab-scoreboard')).toContainText('4.42');await incomingLink(page,'https://evil.test/tournaments/a');await incomingLink(page,'https://www.tenaceiq.com/auth/callback?code=secret');await expect(page.locator('.app-link-handoff')).toBeHidden();await expect(page.locator('.lab-scoreboard')).toContainText('4.42')
})

test('coach links preview the invitation and require a separate acceptance',async({page})=>{
 await page.goto(origin+'/?link='+encodeURIComponent('https://www.tenaceiq.com/coach/invite/fixture-token'))
 const invite=page.getByRole('dialog',{name:'Accept coach invitation',exact:true});await expect(invite.getByRole('heading',{name:'Review invitation',exact:true})).toBeVisible();await expect(invite).toContainText('Alex Rivera');await expect(invite.getByRole('button',{name:'Connect my account',exact:true})).toBeEnabled();await expect(page.locator('[data-coach-writes]')).toContainText('0');await bounded(page)
})
test('a rejected coach invitation offers no acceptance action',async({page})=>{
 await page.goto(origin+'/?link='+encodeURIComponent('https://www.tenaceiq.com/coach/invite/wrong-email'))
 const invite=page.getByRole('dialog',{name:'Accept coach invitation',exact:true});await expect(invite.locator('[role=status]')).not.toContainText('Loading invitation');await expect(invite.getByRole('button',{name:'Connect my account',exact:true})).toHaveCount(0);await expect(page.locator('[data-coach-writes]')).toContainText('0')
})
test('shared court links show a neutral result without inventing a personal win',async({page})=>{
 await page.goto(origin+'/?link='+encodeURIComponent('https://www.tenaceiq.com/matches/court-0?via=scorecard-share'))
 const score=page.getByRole('dialog',{name:'Shared match scorecard',exact:true});await expect(score).toContainText('Side B won');await expect(score).not.toContainText('Your side');await expect(score.getByRole('button',{name:'Review scorecard sharing'})).toHaveCount(0);await score.getByRole('button',{name:'Close scorecard',exact:true}).click();await expect(score).toHaveCount(0)
})
