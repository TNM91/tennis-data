import {test,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
test.describe.configure({retries:0,timeout:20000})
const origin='http://127.0.0.1:4264',prefix='/__import-corrections/'
let javascript='',stylesheet=''
type State={posts:number;previews:number;impactChanged:boolean;duplicate:boolean;active:boolean;last:unknown;lose:boolean;stale:boolean;invalidate:()=>void}
const state=(page:Page)=>page.evaluate(()=>{const s=(window as unknown as {importFixture:State}).importFixture;return {posts:s.posts,previews:s.previews,last:s.last}})
test.beforeAll(async()=>{
 const bundled=await build({entryPoints:['tests/fixtures/mobile-import-corrections.ts'],bundle:true,platform:'browser',format:'esm',outfile:'insights-fixture.js',write:false,jsx:'automatic',loader:{'.module.css':'local-css'}})
 javascript=bundled.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 const css=bundled.outputFiles.find(file=>file.path.endsWith('.css'))?.text||''
 stylesheet=(await Promise.all(['style.css','website-ui.css','app.css'].map(file=>readFile('mobile/bundled/'+file,'utf8')))).join('\n')+'\n'+css+'\n'+(await Promise.all(['website-parity.css','app-atmosphere.css'].map(file=>readFile('mobile/bundled/'+file,'utf8')))).join('\n')
})
test.beforeEach(async({page})=>{
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin||!url.pathname.startsWith(prefix))return route.abort()
  if(url.pathname.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:stylesheet})
  const assets:Record<string,string>={'logo.png':'mobile/bundled/logo.png','brand/approved/TiQ_White_Transparent_Refined.png':'public/brand/approved/TiQ_White_Transparent_Refined.png','brand/courts/tiq-native-ace-deuce-generic-20261028-v2.png':'public/brand/courts/tiq-native-ace-deuce-generic-20261028-v2.png'}
  const asset=assets[url.pathname.slice(prefix.length)];if(asset)return route.fulfill({contentType:'image/png',body:await readFile(asset)})
  if(url.pathname!==prefix&&url.pathname!==prefix+'index.html')return route.fulfill({status:404,body:''})
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="./style.css"></head><body data-screen="lab"><header class="app-header"><img src="./logo.png" alt="TenAceIQ"></header><main id="app"></main><script type="module" src="./app.js"></script></body></html>'})
 })
})
async function open(page:Page,view='scorecard'){
 await page.goto(origin+prefix+'?view='+view);await page.getByRole('button',{name:'Review saved upload',exact:true}).click();await page.getByRole('button',{name:'Load my uploads',exact:true}).click();await page.getByRole('button',{name:view==='roster'?'View team / player roster upload':'View scorecard upload',exact:true}).click()
}
async function bounded(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);const dialog=page.getByRole('dialog');expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);for(const input of await page.locator('[data-review-field]').all()){if(!await input.isVisible())continue;const box=await input.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)}}
const consent=(page:Page)=>page.locator('[data-import-consent]')
for(const width of [320,390]){
 test(`scorecard corrections and one explicit import at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await open(page);await consent(page).check();await expect(page.getByRole('button',{name:'Confirm reviewed data',exact:true})).toBeDisabled()
  await page.getByText('2 Doubles',{exact:true}).last().click();await page.locator('[data-review-field="rows.1.winner"]').selectOption('away');await page.getByRole('button',{name:'Preview import',exact:true}).click();await expect(page.locator('[data-import-impact]')).toContainText('Before you import');await consent(page).check();await expect(page.getByRole('button',{name:'Confirm reviewed data',exact:true})).toBeEnabled()
  await page.locator('[data-review-field="rows.1.score"]').fill('2-6 4-6');await expect(consent(page)).not.toBeChecked();await bounded(page);await expect(page.locator('[data-review-changes]')).toContainText('4-6 3-6 → 2-6 4-6');await page.screenshot({path:info.outputPath('import-corrections-scorecard.png'),fullPage:false});expect((await state(page)).posts).toBe(0)
  await page.getByRole('button',{name:'Preview import',exact:true}).click();await consent(page).check();await page.getByRole('button',{name:'Confirm reviewed data',exact:true}).click();await expect(page.locator('.import-outcome')).toContainText('Import recorded');expect((await state(page)).posts).toBe(1);await expect(page.getByRole('button',{name:'Confirm reviewed data',exact:true})).toHaveCount(0)
 })
 test(`roster corrections keep private contacts out of the editor at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await open(page,'roster');await page.locator('.import-correction-row').filter({hasText:'Casey Morgan'}).locator('summary').click();await page.locator('[data-review-field="rows.1.ntrp"]').selectOption('4.5');await page.locator('[data-review-field="rows.1.name"]').fill('Alexandria-Marguerite Montgomery');await bounded(page);await expect(page.getByRole('dialog')).not.toContainText('private@example.invalid');await page.screenshot({path:info.outputPath('import-corrections-roster.png'),fullPage:false});await page.getByRole('button',{name:'Preview import',exact:true}).click();await consent(page).check();await page.getByRole('button',{name:'Confirm reviewed data',exact:true}).click();await expect(page.locator('.import-outcome')).toContainText('Import recorded');expect((await state(page)).posts).toBe(1)
 })
 test(`changed sources and uncertain responses cannot trigger another import at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});await open(page);await page.getByText('2 Doubles',{exact:true}).last().click();await page.locator('[data-review-field="rows.1.winner"]').selectOption('away');await page.evaluate(()=>{(window as unknown as {importFixture:State}).importFixture.stale=true});await page.getByRole('button',{name:'Preview import',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('This saved draft changed');expect((await state(page)).posts).toBe(0)
  await page.getByRole('button',{name:'Refresh saved draft',exact:true}).click();await page.getByText('2 Doubles',{exact:true}).last().click();await page.locator('[data-review-field="rows.1.winner"]').selectOption('away');await page.getByRole('button',{name:'Preview import',exact:true}).click();await page.evaluate(()=>{(window as unknown as {importFixture:State}).importFixture.lose=true});await consent(page).check();await page.getByRole('button',{name:'Confirm reviewed data',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('may still finish');expect((await state(page)).posts).toBe(1);await expect(page.getByRole('button',{name:'Confirm reviewed data',exact:true})).toHaveCount(0)
 })
 test(`reset and refresh discard unsaved edits at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});await open(page);await page.locator('[data-review-field="homeTeam"]').fill('Different team');await page.getByRole('button',{name:'Reset corrections',exact:true}).click();await expect(page.locator('[data-review-field="homeTeam"]')).toHaveValue('Northside Aces');await page.locator('[data-review-field="homeTeam"]').fill('Different team');await page.getByRole('button',{name:'Refresh saved draft',exact:true}).click();await expect(page.locator('[data-review-field="homeTeam"]')).toHaveValue('Northside Aces');await expect(consent(page)).not.toBeChecked();expect((await state(page)).posts).toBe(0)
 })
 test(`adds a missed court, previews it without writes, and opens saved results at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await open(page);await page.getByText('2 Doubles',{exact:true}).last().click();await page.locator('[data-review-field="rows.1.winner"]').selectOption('away');await page.getByRole('button',{name:'Add missing court',exact:true}).click()
  await page.locator('[data-review-field="rows.2.lineLabel"]').selectOption('3 Singles');await page.locator('[data-review-field="rows.2.homePlayers"]').fill('New Home');await page.locator('[data-review-field="rows.2.awayPlayers"]').fill('New Away');await page.locator('[data-review-field="rows.2.score"]').fill('6-1 6-2');await page.locator('[data-review-field="rows.2.winner"]').selectOption('home')
  await bounded(page);await page.getByRole('button',{name:'Preview import',exact:true}).click();await expect(page.locator('[data-import-impact]')).toContainText('Individual courts in this file3');expect((await state(page)).posts).toBe(0);await page.screenshot({path:info.outputPath('import-corrections-recovery-preview.png'),fullPage:false})
  await consent(page).check();await page.getByRole('button',{name:'Confirm reviewed data',exact:true}).click();await page.getByRole('button',{name:'Open imported records',exact:true}).click();await page.getByRole('button',{name:'View saved scorecard',exact:true}).click();await expect(page.getByRole('dialog',{name:'Imported records',exact:true})).toContainText('6-4 6-3');await expect(page.getByRole('button',{name:'Alex Lee',exact:true})).toBeVisible();expect((await state(page)).posts).toBe(1)
 })
 test(`added roster players can be removed and every edit invalidates the preview at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});await open(page,'roster');await page.locator('.import-correction-row').filter({hasText:'Casey Morgan'}).locator('summary').click();await page.locator('[data-review-field="rows.1.ntrp"]').selectOption('4.5')
  await page.getByRole('button',{name:'Add missing player',exact:true}).click();await page.locator('[data-review-field="rows.2.name"]').fill('New Player');await page.locator('[data-review-field="rows.2.ntrp"]').selectOption('4');await page.getByRole('button',{name:'Preview import',exact:true}).click();await consent(page).check();await expect(page.getByRole('button',{name:'Confirm reviewed data',exact:true})).toBeEnabled()
  await page.locator('.import-correction-row').last().locator('summary').click();await page.locator('[data-review-field="rows.2.name"]').fill('Changed Player');await expect(consent(page)).not.toBeChecked();await expect(page.locator('[data-import-impact]')).not.toContainText('Before you import');await expect(page.getByRole('button',{name:'Confirm reviewed data',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Remove added player',exact:true}).click();await expect(page.locator('.import-correction-row')).toHaveCount(2);expect((await state(page)).posts).toBe(0)
 })
 test(`unchanged duplicates and changed preview evidence require explicit review at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});await open(page);await page.getByText('2 Doubles',{exact:true}).last().click();await page.locator('[data-review-field="rows.1.winner"]').selectOption('away');await page.evaluate(()=>{(window as unknown as {importFixture:State}).importFixture.duplicate=true});await page.getByRole('button',{name:'Preview import',exact:true}).click();await expect(page.locator('[data-import-impact]')).toContainText('Unchanged scorecards to skip1');await consent(page).check()
  await page.evaluate(()=>{(window as unknown as {importFixture:State}).importFixture.impactChanged=true});await page.getByRole('button',{name:'Confirm reviewed data',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Preview again before confirming');expect((await state(page)).posts).toBe(0);await expect(page.getByRole('button',{name:'Preview import',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Confirm reviewed data',exact:true})).toBeDisabled()
 })
}
