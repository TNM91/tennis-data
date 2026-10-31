import {test, expect, type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const origin = 'http://127.0.0.1:4286'
let javascript = '', stylesheet = '', shell = ''
test.describe.configure({retries: 0, timeout: 30000})
test.beforeAll(async () => {
 const bundle = await build({entryPoints: ['tests/fixtures/mobile-navigation.ts'], bundle: true, platform: 'browser', format: 'esm', outfile: 'fixture.js', write: false, jsx: 'automatic', loader: {'.module.css': 'local-css'}, alias:{'next/image':path.resolve('mobile/src/native-website-image.tsx'),'next/link':path.resolve('mobile/src/native-website-link.tsx')},plugins: [{name: 'synthetic-coach-account', setup(b) {b.onResolve({filter: /^@supabase\/supabase-js$/}, () => ({path: path.resolve('tests/fixtures/mobile-navigation-client.ts')}))}}]})
 javascript = bundle.outputFiles.find(f => f.path.endsWith('.js'))!.text
 stylesheet = (await Promise.all(['style.css', 'website-ui.css', 'app.css', 'website-parity.css', 'app-atmosphere.css'].map(f => f==='app.css'?Promise.resolve(bundle.outputFiles.find(file=>file.path.endsWith('.css'))!.text):readFile('mobile/bundled/' + f, 'utf8')))).join('\n')
 shell = await readFile('mobile/bundled/index.html', 'utf8')
})
test.beforeEach(async ({page}) => {
 await page.route('**/*', async route => {
  const url = new URL(route.request().url()); if (url.origin !== origin) return route.abort()
  if (url.pathname === '/app.js') return route.fulfill({contentType: 'text/javascript', body: javascript})
  if (url.pathname.endsWith('.css')) return route.fulfill({contentType: 'text/css', body: url.pathname === '/style.css' ? stylesheet + (url.searchParams.has('large') ? '\n:root{font-size:22px!important}' : '') : ''})
  if (url.pathname.startsWith('/brand/') || url.pathname.startsWith('/tiq/tokens/') || url.pathname === '/logo.png') return route.fulfill({contentType: 'image/png', body: await readFile('mobile/bundled' + url.pathname)})
  return route.fulfill({contentType: 'text/html', body: url.searchParams.has('large') ? shell.replace('./style.css', './style.css?large=1') : shell})
 })
})
async function open(page:Page,large=false){
 await page.goto(origin+(large?'/?large=1':''));await expect(page.locator('.lab-scoreboard')).toBeVisible();await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await page.locator('[data-app-destination="coach-tactics"]').click()
 const d=page.getByRole('dialog',{name:'Tactics',exact:true});await expect(d.locator('[data-tiq-studio]')).toBeVisible();return d
}
async function fits(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.getByRole('dialog',{name:'Tactics',exact:true}).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)}
for(const width of [320,390])test('full-screen tactical engine, touch controls and saved library at '+width+'px',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:844});const d=await open(page)
 await expect(d.getByRole('navigation',{name:'Tactics workspace'})).toBeVisible();await fits(page)
 const court=d.getByTestId('tiq-court-surface');await expect(court).toBeVisible();for(const img of await d.locator('[data-token-role] img').all())expect((await img.boundingBox())!.width).toBeLessThanOrEqual(48);await page.screenshot({path:info.outputPath('tactics-court.png')})
 await d.getByRole('button',{name:'Tools',exact:true}).click();await expect(d.locator('[data-tiq-toolbar]')).toBeVisible();await d.getByRole('button',{name:'Quick add player',exact:true}).click();await fits(page)
 await d.getByRole('button',{name:'Court',exact:true}).click();await expect(court).toBeVisible();await d.getByRole('button',{name:'Saved',exact:true}).click();await expect(d).toContainText('Saturday poach pattern')
 await d.getByRole('button',{name:/Saturday poach pattern/}).click();await d.getByRole('button',{name:'Details',exact:true}).click();await expect(d.locator('[data-tiq-inspector]')).toBeVisible();await fits(page)
 await d.getByRole('button',{name:'Brief',exact:true}).click();await expect(d.locator('[data-tiq-brief]')).toBeVisible();await expect(d).not.toContainText('Opens website');expect(errors).toEqual([])
 await page.setViewportSize({width:844,height:390});await d.getByRole('button',{name:'Court',exact:true}).click();await fits(page);await page.screenshot({path:info.outputPath('tactics-landscape.png')})
})
test('clears private tactics on account changes and keeps phone layouts bounded with larger text',async({page})=>{
 await page.setViewportSize({width:320,height:844});const d=await open(page,true);await fits(page);await d.getByRole('button',{name:'Details',exact:true}).click();await fits(page)
 await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click());await expect(d).toHaveCount(0)
})

test('drags players, draws a path, recovers a lost account save without duplicates and deletes only after confirmation',async({page})=>{
 await page.setViewportSize({width:390,height:844});const d=await open(page);const token=d.locator('[data-token-role]').first(),before=await token.getAttribute('style'),t=await token.boundingBox();await page.mouse.move(t!.x+t!.width/2,t!.y+t!.height/2);await page.mouse.down();await page.mouse.move(t!.x+t!.width/2+25,t!.y+t!.height/2-25,{steps:8});await page.mouse.up();await expect(token).not.toHaveAttribute('style',before!)
 const paths=d.locator('[data-tactical-path]'),count=await paths.count();await d.getByRole('button',{name:'Draw',exact:true}).click();await d.getByRole('button',{name:'Move',exact:true}).click();const board=await d.getByTestId('tiq-court-surface').boundingBox();await page.mouse.move(board!.x+board!.width*.2,board!.y+board!.height*.4);await page.mouse.down();await page.mouse.move(board!.x+board!.width*.4,board!.y+board!.height*.6,{steps:8});await page.mouse.up();await expect(paths).toHaveCount(count+1)
 await d.getByRole('button',{name:'Tools',exact:true}).click();await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-tactics-lose]')!.click());await d.getByRole('button',{name:'Save cloud',exact:true}).click();await expect(d.getByRole('button',{name:'Check saved board',exact:true})).toBeVisible();await expect(page.locator('[data-tactics-writes]')).toHaveText('Tactics writes: 1');await d.getByRole('button',{name:'Check saved board',exact:true}).click();await expect(d).toContainText('Your saved board is confirmed.');await expect(page.locator('[data-tactics-writes]')).toHaveText('Tactics writes: 1')
 await d.getByRole('button',{name:'Saved',exact:true}).click();await d.getByRole('button',{name:'Refresh saved boards',exact:true}).click();const deletes=d.getByRole('button',{name:'Delete',exact:true});await expect(deletes).toHaveCount(2);const amount=await deletes.count();await deletes.first().click();const confirmation=page.getByRole('dialog',{name:'Delete saved board',exact:true});await expect(confirmation).toBeVisible();await confirmation.getByRole('button',{name:'Keep board',exact:true}).click();await expect(deletes).toHaveCount(amount);await deletes.first().click();await page.getByRole('dialog',{name:'Delete saved board',exact:true}).getByRole('button',{name:'Delete from account',exact:true}).click();await expect(deletes).toHaveCount(amount-1)
})
