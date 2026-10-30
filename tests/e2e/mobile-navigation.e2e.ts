import {test,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const origin='http://127.0.0.1:4283'
let javascript='',stylesheet='',documentHtml=''
test.describe.configure({retries:0,timeout:25000})
test.beforeAll(async()=>{
 const bundle=await build({entryPoints:['tests/fixtures/mobile-navigation.ts'],bundle:true,platform:'browser',format:'esm',outfile:'fixture.js',write:false,jsx:'automatic',loader:{'.module.css':'local-css'},plugins:[{name:'synthetic-account',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:path.resolve('tests/fixtures/mobile-navigation-client.ts')}))}}]})
 javascript=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 stylesheet=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css'].map(file=>readFile('mobile/bundled/'+file,'utf8')))).join('\n')+'\n.preview-controls{padding:24px 12px 120px}.preview-controls button{min-height:44px}'
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
async function bounded(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('.app-navigation').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)}
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
 await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await expect(page.getByRole('heading',{name:'Coach & training',exact:true})).toBeVisible();await expect(page.locator('[data-app-destination="coach-web"]')).toContainText('Opens website')
 await page.locator('[data-app-destination="training-inbox"]').click();await expect(page.getByRole('dialog',{name:'Level Up training',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close Level Up',exact:true}).click();await expect(page.getByRole('heading',{name:'Coach & training',exact:true})).toBeVisible()
 await page.goto(origin+'/?large=1');await expect(page.locator('.lab-scoreboard')).toContainText('4.42');await bounded(page);await page.getByRole('button',{name:'Compete',exact:true}).click();await bounded(page);await page.getByRole('button',{name:'More',exact:true}).click();await bounded(page);await page.screenshot({path:info.outputPath('more-large-text.png')})
 await page.locator('[data-app-destination="tournaments"]').click();await expect(event).toContainText('Northside Open');await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click());await expect(event).toHaveCount(0);await expect(page.locator('.lab-scoreboard')).toContainText('4.42');expect(errors).toEqual([])
})
