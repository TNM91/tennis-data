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
 stylesheet = (await Promise.all(['style.css', 'website-ui.css', 'app.css', 'website-parity.css', 'app-atmosphere.css', 'premium-surfaces.css'].map(f => f==='app.css'?Promise.resolve(bundle.outputFiles.find(file=>file.path.endsWith('.css'))!.text):readFile('mobile/bundled/' + f, 'utf8')))).join('\n')
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
async function open(page:Page,large=false,studioScreenshot?:string){
 await page.goto(origin+(large?'/?large=1':''));await expect(page.locator('.lab-scoreboard')).toBeVisible();await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await page.getByRole('button',{name:'For coaches',exact:true}).click()
 const studio=page.locator('#coach-studio-tools')
 const list=studio.locator('.app-hub-tools')
 await expect(list).toHaveCSS('overflow', 'hidden')
 await expect(list).toHaveCSS('border-top-left-radius', '18px')
 await expect(list.getByRole('button',{name:/Students & assignments/})).toBeVisible()
 await expect(list.getByRole('button',{name:/Lesson planner/})).toHaveCSS('border-top-width', '1px')
 await expect(list.locator('[data-app-destination="coach-tactics"]')).toHaveCount(0)
 if(studioScreenshot){
  await studio.evaluate(section=>section.scrollIntoView({block:'start'}))
  await page.screenshot({path:studioScreenshot,scale:'css'})
 }
 await studio.locator('[data-app-destination="coach-tactics"]').click()
 const d=page.getByRole('dialog',{name:'Tactics',exact:true});await expect(d.locator('[data-tiq-studio]')).toBeVisible();return d
}
async function fits(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.getByRole('dialog',{name:'Tactics',exact:true}).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)}
for(const width of [320,390])test('full-screen tactical engine, touch controls and saved library at '+width+'px',async({page},info)=>{
 if(width===390) await page.addInitScript(()=>{
  const createObjectURL=URL.createObjectURL.bind(URL)
  URL.createObjectURL=source=>{
   if(source instanceof Blob&&source.type==='image/png'){
    const preview=(window as Window & {tacticsPng?:Promise<number[]>})
    preview.tacticsPng=source.slice(0,24).arrayBuffer().then(buffer=>{
     const view=new DataView(buffer)
     return [view.getUint32(0),view.getUint32(16),view.getUint32(20)]
    })
   }
   return createObjectURL(source)
  }
 })
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:844});const d=await open(page,false,info.outputPath('coach-studio.png'))
 const navigation=d.getByRole('navigation',{name:'Tactics workspace'})
 await expect(navigation).toBeVisible();await fits(page)
 await expect(navigation.locator('[data-tiq-tactics-glyph][aria-hidden="true"]')).toHaveCount(5)
 await expect(d.getByRole('img',{name:'TenAceIQ',exact:true})).toHaveJSProperty('naturalWidth',1774)
 const court=d.getByTestId('tiq-court-surface');await expect(court).toBeVisible();for(const img of await d.locator('[data-token-role] img').all())expect((await img.boundingBox())!.width).toBeLessThanOrEqual(48)
 const bounds=d.locator('[data-tiq-court-bounds]')
 const dimensions=(await bounds.boundingBox())!
 expect(dimensions.width/dimensions.height).toBeCloseTo(36/78,2)
 const marker=d.locator('[data-token-role]').first()
 const initialPosition=await marker.getAttribute('style')
 await d.getByRole('button',{name:'Perspective',exact:true}).click()
 await expect(d.getByRole('img',{name:'TenAceIQ master tactical court'})).toBeVisible()
 await expect(marker).not.toHaveAttribute('style',initialPosition!)
 await d.getByRole('button',{name:'Overhead',exact:true}).click()
 await expect(marker).toHaveAttribute('style',initialPosition!)
 const courtBox=(await court.boundingBox())!, dockBox=(await d.locator('[data-tiq-native-dock]').boundingBox())!
 expect(courtBox.y+courtBox.height).toBeLessThan(dockBox.y)
 await page.screenshot({path:info.outputPath('tactics-court.png'),scale:'css'})
 const labels=d.getByRole('button',{name:'Labels',exact:true})
 await expect(labels.locator('[data-tiq-tactics-glyph="labels"][aria-hidden="true"]')).toBeVisible()
 await labels.click()
 await expect(labels).toHaveAttribute('aria-pressed','false')
 await expect(labels.locator('[data-tiq-tactics-glyph="labelsOff"][aria-hidden="true"]')).toBeVisible()
 await labels.click()
 await d.getByRole('button',{name:'Add',exact:true}).click()
 await expect(d.getByRole('group',{name:'Add to court'}).getByRole('button')).toHaveCount(6)
 await d.getByRole('button',{name:'Draw',exact:true}).click()
 await d.getByRole('button',{name:'Shot',exact:true}).click()
 await page.screenshot({path:info.outputPath('tactics-draw.png'),scale:'css'})
 await d.getByRole('button',{name:'Tools',exact:true}).click();await expect(d.locator('[data-tiq-toolbar]')).toBeVisible();await d.getByRole('button',{name:'Quick add player',exact:true}).click();await fits(page)
 await d.getByRole('button',{name:'Court',exact:true}).click();await expect(court).toBeVisible();await d.getByRole('button',{name:'Saved',exact:true}).click();await expect(d).toContainText('Saturday poach pattern')
 await d.getByRole('button',{name:/Saturday poach pattern/}).click();await d.getByRole('button',{name:'Details',exact:true}).click();await expect(d.locator('[data-tiq-inspector]')).toBeVisible();await fits(page)
 await d.getByRole('button',{name:'Court',exact:true}).click()
 await d.getByRole('button',{name:'Edit',exact:true}).click()
 await expect(d.getByText('Poach window',{exact:true})).toBeVisible()
 await page.screenshot({path:info.outputPath('tactics-overhead-pattern.png'),scale:'css'})
 if(width===390){
  await d.getByRole('button',{name:'Tools',exact:true}).click()
  const download=page.waitForEvent('download')
  await d.getByRole('button',{name:'Export PNG',exact:true}).click()
  expect((await download).suggestedFilename()).toMatch(/-board\.png$/)
  const png=await page.evaluate(()=> (window as Window & {tacticsPng?:Promise<number[]>}).tacticsPng)
  expect(png).toEqual([0x89504e47,1428,1890])
 }
 await d.getByRole('button',{name:'Brief',exact:true}).click();await expect(d.locator('[data-tiq-brief]')).toBeVisible();await expect(d).not.toContainText('Opens website');expect(errors).toEqual([])
 await page.setViewportSize({width:844,height:390});await d.getByRole('button',{name:'Court',exact:true}).click();await fits(page)
 await expect(d.getByTestId('tiq-court-board')).toHaveAttribute('data-tiq-court-view','overhead-landscape')
 const landscapeCourt=(await bounds.boundingBox())!
 expect(landscapeCourt.width/landscapeCourt.height).toBeCloseTo(78/36,2)
 const steps=d.getByRole('group',{name:'Pattern steps'})
 const allSteps=steps.getByRole('button',{name:'All',exact:true})
 expect((await allSteps.boundingBox())!.width).toBeLessThan((await steps.boundingBox())!.width / 2)
 await page.screenshot({path:info.outputPath('tactics-landscape.png'),scale:'css'})
})
test('clears private tactics on account changes and keeps phone layouts bounded with larger text',async({page})=>{
 await page.setViewportSize({width:320,height:667});const d=await open(page,true);await fits(page)
 const draw=(await d.getByRole('button',{name:'Draw',exact:true}).boundingBox())!
 const navigation=(await d.getByRole('navigation',{name:'Tactics workspace'}).boundingBox())!
 expect(draw.y+draw.height).toBeLessThan(navigation.y)
 await d.getByRole('button',{name:'Details',exact:true}).click();await fits(page)
 await d.getByRole('button',{name:'Saved',exact:true}).click()
 await d.getByRole('button',{name:/Saturday poach pattern/}).click()
 await d.getByRole('button',{name:'Court',exact:true}).click()
 const play=d.getByRole('button',{name:'Play pattern',exact:true})
 const playBox=(await play.boundingBox())!
 expect(playBox.y+playBox.height).toBeLessThan(navigation.y)
 await play.click()
 await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click());await expect(d).toHaveCount(0)
})

test('plays saved shots and movement in order, with pause, replay and reduced motion',async({page},info)=>{
 await page.setViewportSize({width:390,height:844})
 const d=await open(page)
 const controls=d.getByRole('group',{name:'Pattern playback'})
 await expect(controls).toHaveCount(0)
 await d.getByRole('button',{name:'Saved',exact:true}).click()
 await d.getByRole('button',{name:/Saturday poach pattern/}).click()
 await d.getByRole('button',{name:'Court',exact:true}).click()
 const step=controls.getByRole('status')
 const marker=d.locator('[data-tiq-playback-marker]')
 await controls.getByRole('button',{name:'Play pattern',exact:true}).click()
 await expect(step).toHaveText('1 of 4 · Serve')
 await expect(marker).toHaveAttribute('data-tiq-playback-marker','ball')
 const position=()=>marker.evaluate(element=>getComputedStyle(element).top)
 const start=await position()
 await expect.poll(position).not.toBe(start)
 await controls.getByRole('button',{name:'Pause',exact:true}).click()
 await expect.poll(()=>marker.evaluate(element=>element.getAnimations()[0]?.playState)).toBe('paused')
 await expect.poll(()=>marker.evaluate(element=>element.getAnimations()[0]?.pending)).toBe(false)
 const paused=await marker.evaluate(element=>element.getAnimations()[0]?.currentTime)
 await page.screenshot({path:info.outputPath('tactics-playback-paused.png'),scale:'css'})
 expect(await marker.evaluate(element=>element.getAnimations()[0]?.currentTime)).toBe(paused)
 await expect(d.getByTestId('tiq-token-server')).toBeDisabled()
 await controls.getByRole('button',{name:'Resume',exact:true}).click()
 for(const [label,kind] of [['2 of 4 · Return lane','ball'],['3 of 4 · Poach','move'],['4 of 4 · Cover','recover']]){
  await expect(step).toHaveText(label)
  await expect(marker).toHaveAttribute('data-tiq-playback-marker',kind)
 }
 await expect(step).toHaveText('Pattern complete')
 await expect(d.locator('[data-tactical-path]')).toHaveCount(4)
 await expect(d.getByTestId('tiq-token-server')).toBeEnabled()
 await expect(page.locator('[data-tactics-writes]')).toHaveText('Tactics writes: 0')

 await page.emulateMedia({reducedMotion:'reduce'})
 await controls.getByRole('button',{name:'Replay',exact:true}).click()
 await expect(marker).toBeHidden()
 await expect(step).toHaveText('2 of 4 · Return lane')
 await controls.getByRole('button',{name:'Stop',exact:true}).click()
 await expect(controls.getByRole('button',{name:'Play pattern',exact:true})).toBeFocused()
 await expect(marker).toHaveCount(0)
 await expect(d.locator('[data-tactical-path]')).toHaveCount(4)
})

test('drags players, draws a path, recovers a lost account save without duplicates and deletes only after confirmation',async({page})=>{
 await page.setViewportSize({width:390,height:844});const d=await open(page);const token=d.locator('[data-token-role]').first(),before=await token.getAttribute('style'),t=await token.boundingBox();await page.mouse.move(t!.x+t!.width/2,t!.y+t!.height/2);await page.mouse.down();await page.mouse.move(t!.x+t!.width/2+25,t!.y+t!.height/2-25,{steps:8});await page.mouse.up();await expect(token).not.toHaveAttribute('style',before!)
 const selectionActions=d.getByRole('group',{name:'Edit selected court item'})
 await expect(selectionActions.getByRole('button',{name:'Duplicate',exact:true}).locator('[data-tiq-tactics-glyph="duplicate"]')).toBeVisible()
 const undo=d.getByRole('button',{name:'Undo',exact:true})
 await undo.click()
 await expect(token).toHaveAttribute('style',before!)
 await expect(undo).toBeDisabled()
 const paths=d.locator('[data-tactical-path]'),count=await paths.count()
 await d.getByRole('button',{name:'Draw',exact:true}).click()
 await d.getByRole('button',{name:'Move',exact:true}).click()
 const board=(await d.getByTestId('tiq-court-surface').boundingBox())!
 await page.touchscreen.tap(board.x+board.width*.15,board.y+board.height*.4)
 await expect(d.getByText('Tap the end point',{exact:true})).toBeVisible()
 await d.getByRole('button',{name:'Shot',exact:true}).click()
 await expect(d.getByText('Tap the end point',{exact:true})).toHaveCount(0)
 const start=(await token.boundingBox())!
 await page.mouse.move(start.x+start.width/2,start.y+start.height/2)
 await page.mouse.down()
 await page.mouse.move(board.x+board.width*.4,board.y+board.height*.6,{steps:8})
 await page.mouse.up()
 await expect(paths).toHaveCount(count+1)
 await expect(token).toHaveAttribute('style',before!)
 await d.getByRole('button',{name:'Play pattern',exact:true}).click()
 await expect(d.locator('[data-tiq-playback-marker]')).toHaveAttribute('data-tiq-playback-marker','ball')
 await expect(d.getByRole('group',{name:'Pattern playback'}).getByRole('status')).toHaveText('Pattern complete')
 await d.getByRole('button',{name:'Tools',exact:true}).click();await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-tactics-lose]')!.click());await d.getByRole('button',{name:'Save cloud',exact:true}).click();await expect(d.getByRole('button',{name:'Check saved board',exact:true})).toBeVisible();await expect(page.locator('[data-tactics-writes]')).toHaveText('Tactics writes: 1');await d.getByRole('button',{name:'Check saved board',exact:true}).click();await expect(d).toContainText('Your saved board is confirmed.');await expect(page.locator('[data-tactics-writes]')).toHaveText('Tactics writes: 1')
 await d.getByRole('button',{name:'Saved',exact:true}).click();await d.getByRole('button',{name:'Refresh saved boards',exact:true}).click();const deletes=d.getByRole('button',{name:'Delete',exact:true});await expect(deletes).toHaveCount(2);const amount=await deletes.count();await deletes.first().click();const confirmation=page.getByRole('dialog',{name:'Delete saved board',exact:true});await expect(confirmation).toBeVisible();await confirmation.getByRole('button',{name:'Keep board',exact:true}).click();await expect(deletes).toHaveCount(amount);await deletes.first().click();await page.getByRole('dialog',{name:'Delete saved board',exact:true}).getByRole('button',{name:'Delete from account',exact:true}).click();await expect(deletes).toHaveCount(amount-1)
})
