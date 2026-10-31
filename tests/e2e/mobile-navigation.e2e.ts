import {test,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const origin='http://127.0.0.1:4283'
let javascript='',stylesheet='',documentHtml=''
test.describe.configure({retries:0,timeout:25000})
test.beforeAll(async()=>{
 const bundle=await build({entryPoints:['tests/fixtures/mobile-navigation.ts'],bundle:true,platform:'browser',format:'esm',outfile:'fixture.js',write:false,jsx:'automatic',loader:{'.module.css':'local-css'},alias:{'next/image':path.resolve('mobile/src/native-website-image.tsx'),'next/link':path.resolve('mobile/src/native-website-link.tsx')},plugins:[{name:'synthetic-account',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:path.resolve('tests/fixtures/mobile-navigation-client.ts')}))}}]})
 javascript=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 stylesheet=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css'].map(file=>file==='app.css'?Promise.resolve(bundle.outputFiles.find(file=>file.path.endsWith('.css'))!.text):readFile('mobile/bundled/'+file,'utf8')))).join('\n')+'\n.preview-controls{padding:24px 12px 120px}.preview-controls button{min-height:44px}'
 documentHtml=await readFile('mobile/bundled/index.html','utf8')
})
test.beforeEach(async({page})=>{
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin)return route.abort()
  if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:url.pathname==='/style.css'?stylesheet+(url.searchParams.has('large')?'\n:root{font-size:22px!important}':''):''})
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
for(const width of [320,390])test('tool search stays local, accessible and preserves the opener at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 await expect(page.locator('.lab-scoreboard')).toContainText('4.42')
 await page.getByRole('button',{name:'More',exact:true}).click()
 const input=page.getByRole('searchbox',{name:'Find a tool',exact:true}),count=page.locator('[data-tool-count]'),tools=page.locator('.app-tool:visible')
 await expect(count).toHaveText('9 tools')
 const requests=await requestCount(page)
 await input.fill('  FACE   ID ');await expect(count).toHaveText('1 tool found');await expect(tools).toHaveCount(1);await expect(tools).toHaveAttribute('data-app-destination','account')
 await input.press('Tab');await expect(page.getByRole('button',{name:'Clear',exact:true})).toBeFocused()
 await page.getByRole('button',{name:'Clear',exact:true}).press('Tab');await expect(tools).toBeFocused()
 await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(input).toBeFocused();await expect(count).toHaveText('9 tools')
 await input.fill('coaching');await expect(tools).toHaveAttribute('data-app-destination','coach')
 await input.fill('uploads');await expect(tools).toHaveAttribute('data-app-destination','imports')
 await input.fill('STÁNDINGS');await expect(tools).toHaveAttribute('data-app-destination','leagues')
 await input.fill('<img src=x>');await expect(count).toHaveText('0 tools found');await expect(page.locator('[data-tools-empty]')).toBeVisible();await expect(page.locator('.app-hub-group:visible')).toHaveCount(0)
 await bounded(page);await expect(input).toBeFocused();expect(await requestCount(page)).toBe(requests)
 await input.press('Escape');await expect(count).toHaveText('9 tools');await expect(page.locator('[data-tools-empty]')).toBeHidden()
 await input.fill('tournaments');await expect(tools).toHaveCount(1);await bounded(page)
 await page.screenshot({path:info.outputPath('tools-search.png')})
 const opener=page.locator('[data-app-destination="tournaments"]');await opener.click()
 const event=page.getByRole('dialog',{name:'Tournaments',exact:true});await expect(event).toContainText('Northside Open')
 await event.getByRole('button',{name:'Close',exact:true}).click();await expect(opener).toBeFocused();await expect(input).toHaveValue('tournaments');await expect(tools).toHaveCount(1)
 await page.getByRole('button',{name:'Simulate token refresh',exact:true}).click();await expect(input).toHaveValue('tournaments')
 await page.getByRole('button',{name:'Simulate reconnect',exact:true}).click();await expect(input).toHaveValue('tournaments')
 await page.getByRole('button',{name:'Simulate token refresh',exact:true}).click()
 await page.getByRole('button',{name:'More',exact:true}).click();await expect(input).toHaveValue('');await expect(count).toHaveText('9 tools')
 await page.screenshot({path:info.outputPath('tools-directory.png')});await bounded(page)
 for(const button of await tools.all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
 await input.fill('uploads');await page.getByRole('button',{name:'Switch synthetic account',exact:true}).click()
 await expect(input).toHaveCount(0);await expect(page.locator('.lab-scoreboard')).toContainText('4.42')
 await page.getByRole('button',{name:'More',exact:true}).click();await expect(input).toHaveValue('');await expect(count).toHaveText('9 tools')
})
for(const width of [320,390])test('all destinations, direct competitions, focus return and reconnect at '+width+'px',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width,height:844});await page.goto(origin)
 await expect(page.locator('.lab-scoreboard')).toContainText('4.42');await expect(page.locator('.app-navigation button')).toHaveText(['My Lab','Explore','Chats','Compete','More']);await bounded(page)
 const scene=page.locator('.rating-court-scene');await expect(scene).toHaveAttribute('width','1727');expect(await scene.evaluate(el=>getComputedStyle(el).objectFit)).toBe('contain')
 expect(await page.evaluate(()=>{const score=document.querySelector('.lab-scoreboard')!,form=document.querySelector('.lab-form-host')!,focus=document.querySelector('#lab-identity')!;return Boolean(score.compareDocumentPosition(form)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(form.compareDocumentPosition(focus)&Node.DOCUMENT_POSITION_FOLLOWING)})).toBe(true)
 await page.screenshot({path:info.outputPath('home.png')})
 await page.getByRole('button',{name:'Chats',exact:true}).click();await expect(page.getByRole('heading',{name:'Chats',exact:true})).toBeVisible();await page.getByRole('button',{name:'Compete',exact:true}).click();await expect(page.getByRole('heading',{name:'Compete',exact:true})).toBeFocused()
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
