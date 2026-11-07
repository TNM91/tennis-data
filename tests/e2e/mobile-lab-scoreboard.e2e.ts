import {test,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
test.describe.configure({retries:0,timeout:15000})
const origin='http://127.0.0.1:4262',prefix='/__lab-scoreboard/'
let javascript='',stylesheet=''
type Fixture={authReads:number;opened:string;training:string;render:(scenario:string)=>void;invalidate:()=>void}
const fixture=(page:Page)=>page.evaluate(()=>{const state=(window as unknown as {labFixture:Fixture}).labFixture;return {authReads:state.authReads,opened:state.opened,training:state.training}})
test.beforeAll(async()=>{
 const bundled=await build({entryPoints:['tests/fixtures/mobile-lab-scoreboard.ts'],bundle:true,platform:'browser',format:'esm',outfile:'lab-scoreboard-fixture.js',write:false,jsx:'automatic',loader:{'.module.css':'local-css'}})
 javascript=bundled.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 stylesheet=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css','premium-surfaces.css'].map(file=>readFile('mobile/bundled/'+file,'utf8')))).join('\n')
})
test.beforeEach(async({page})=>{
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  if(url.origin!==origin||!url.pathname.startsWith(prefix))return route.abort()
  if(url.pathname.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:stylesheet})
  const assets:Record<string,string>={'brand/approved/TiQ_White_Transparent_Refined.png':'public/brand/approved/TiQ_White_Transparent_Refined.png','brand/courts/tiq-native-night-session.png':'public/brand/courts/tiq-native-night-session.png','brand/courts/tiq-native-ace-deuce-refined-20261031-v3.png':'public/brand/courts/tiq-native-ace-deuce-refined-20261031-v3.png','logo.png':'mobile/bundled/logo.png'}
  const asset=assets[url.pathname.slice(prefix.length)];if(asset)return route.fulfill({contentType:'image/png',body:await readFile(asset)})
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="./style.css"></head><body data-screen="lab"><header class="app-header"><img src="./logo.png" alt="TenAceIQ"></header><main id="app"></main><script type="module" src="./app.js"></script></body></html>'})
 })
})
for(const width of [320,390])test('training hierarchy and match controls stay clean at '+width+'px',async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.goto(origin+prefix)
 await expect(page.locator('#lab-identity')).not.toContainText('Ready, Jordan.')
 await expect(page.locator('#lab-identity [data-native-part="intro"],#lab-identity img')).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'Choose one tennis focus',exact:true})).toBeVisible()
 const dimensions=await page.locator('.lab-trend-entry .lab-action-icon').evaluate(el=>{const glyph=el.querySelector('.tiq-feature-icon__glyph')!.getBoundingClientRect(),badge=el.querySelector('.tiq-feature-icon__badge')!.getBoundingClientRect();return {glyph:glyph.width,badge:badge.width}})
 expect(dimensions.glyph).toBeGreaterThan(dimensions.badge*2)
 const controls=page.locator('#results-content>.result-view-controls')
 expect(await controls.evaluate(el=>getComputedStyle(el).display)).toBe('flex')
 await page.locator('[data-result-view="formats"]').click();await expect(page.locator('.lab-format-grid')).toBeVisible();await bounded(page)
 await page.locator('[data-result-view="form"]').click();await page.locator('[data-match-filter="All"]').focus()
 await page.screenshot({path:info.outputPath('lab-scoreboard-clean-controls.png')})
 await page.locator('[data-native-part="primaryAction"]').focus();await page.screenshot({path:info.outputPath('lab-scoreboard-training-card.png')})
 await page.addStyleTag({content:':root{font-size:22px!important}'})
 await bounded(page)
 for(const selector of ['[data-result-view]','[data-match-filter]'])for(const control of await page.locator(selector).all())expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
})
async function bounded(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 for(const target of ['.lab-scoreboard','.lab-form-strip','.lab-level-path','.lab-trend-entry','.lab-match-form','.lab-format-grid']){
  if(!await page.locator(target).count())continue
  const box=await page.locator(target).boundingBox();if(!box)continue
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  const dimensions=await page.locator(target).evaluate(el=>{const parent=el.getBoundingClientRect();return {clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,overflowing:[...el.querySelectorAll('*')].map(child=>({child,box:child.getBoundingClientRect()})).filter(({child,box})=>box.width>0&&box.height>0&&!child.closest('.sr-only')&&(box.right>parent.right+.25||box.left<parent.left-.25)).slice(0,10).map(({child,box})=>({tag:child.tagName,className:child.className,text:child.textContent?.slice(0,70),left:box.left,right:box.right,font:getComputedStyle(child).font,fontSize:getComputedStyle(child).fontSize}))}})
  // Linux WebKit can report a one-pixel scroll/client difference after text enlargement.
  // Keep the page check strict and separately require every child inside the card.
  expect(dimensions.scrollWidth<=dimensions.clientWidth+1,JSON.stringify({target,...dimensions})).toBe(true)
  expect(dimensions.overflowing,JSON.stringify({target,...dimensions})).toEqual([])
 }
}
for(const width of [320,390])test(`numbers lead the page and charted samples remain explicit at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:width===320?568:844});await page.goto(origin+prefix)
 await expect(page.locator('.lab-scoreboard')).toContainText('4.42');await expect(page.locator('.lab-scoreboard')).toContainText('Singles TIQ');await expect(page.locator('.lab-scoreboard')).toContainText('Doubles TIQ');await expect(page.locator('.lab-scoreboard')).toContainText('USTA current: 4.0')
 await expect(page.locator('.lab-scoreboard').getByRole('meter',{name:'Singles recorded TIQ',exact:true})).toHaveAttribute('value','4.37')
 await expect(page.locator('.lab-scoreboard').getByRole('meter',{name:'Doubles recorded TIQ',exact:true})).toHaveAttribute('value','4.49')
 expect(await page.evaluate(()=>{const score=document.querySelector('.lab-scoreboard')!,form=document.querySelector('.lab-form-host')!,focus=document.querySelector('#lab-identity')!;return Boolean(score.compareDocumentPosition(form)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(form.compareDocumentPosition(focus)&Node.DOCUMENT_POSITION_FOLLOWING)})).toBe(true)
 await expect(page.locator('.lab-form-strip').getByRole('img',{name:'Wins in your latest 5 decided individual results: 80%',exact:true})).toBeVisible()
 await expect(page.locator('.lab-form-record')).toContainText('4W · 1L');await expect(page.locator('.lab-form-strip')).toContainText('Latest 5 decided results in your loaded matches')
 const singles=page.locator('.lab-form-strip').getByRole('meter',{name:'Singles wins in your latest 5 decided results',exact:true}),doubles=page.locator('.lab-form-strip').getByRole('meter',{name:'Doubles wins in your latest 5 decided results',exact:true})
 await expect(singles).toHaveAttribute('value','2');await expect(singles).toHaveAttribute('max','2')
 await expect(doubles).toHaveAttribute('value','2');await expect(doubles).toHaveAttribute('max','3')
 await bounded(page);expect((await fixture(page)).authReads).toBe(0)
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('lab-scoreboard-opening.png'),fullPage:false})
 await page.locator('.lab-form-strip').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('lab-scoreboard-recent-form.png'),fullPage:false})
 await page.locator('.lab-level-path').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('lab-scoreboard-next-band.png'),fullPage:false})
})
for(const width of [320,390])test(`format and league views use the same loaded results at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:width===320?568:844});await page.goto(origin+prefix)
 const results=page.locator('#results-content')
 const form=results.getByRole('region',{name:'Form result insights',exact:true})
 await expect(results.getByRole('img',{name:'Decided win rate in loaded recent results: 70%',exact:true})).toBeVisible()
 await expect(form.getByText('7W · 3L',{exact:true})).toBeVisible()
 await expect(form.locator('.lab-match-streaks dd')).toHaveText(['2','2'])
 await page.locator(width===390?'#recent-results h2':'.result-view-controls').evaluate(el=>el.scrollIntoView({block:'start'}))
 await page.screenshot({path:info.outputPath('lab-match-form-summary.png')})
 await results.locator('[data-match-filter="Singles"]').click()
 await expect(results.getByRole('img',{name:'Decided win rate in loaded recent results: 100%',exact:true})).toBeVisible();await expect(results).toContainText('4 singles matches')
 await results.locator('[data-match-filter="Doubles"]').click();await expect(results.getByRole('img',{name:'Decided win rate in loaded recent results: 50%',exact:true})).toBeVisible()
 await results.locator('[data-result-view="formats"]').click()
 const comparison=results.getByRole('region',{name:'Singles and doubles comparison',exact:true})
 await expect(comparison.getByRole('meter',{name:/^Singles decided/})).toHaveAttribute('value','100')
 await expect(comparison.getByRole('meter',{name:/^Doubles decided/})).toHaveAttribute('value','50')
 await page.locator(width===390?'#recent-results h2':'.result-view-controls').evaluate(el=>el.scrollIntoView({block:'start'}))
 await page.screenshot({path:info.outputPath('lab-scoreboard-format-insights.png'),fullPage:false})
 await results.locator('[data-result-view="leagues"]').click();await expect(results.locator('.lab-breakdown-list')).toContainText('City Tennis League');await expect(results.locator('.lab-breakdown-list')).toContainText('3W / 3L')
 await results.locator('[data-result-view="years"]').click();await expect(results.locator('.lab-breakdown-list')).toContainText('2026');await bounded(page)
})
test('missing, fallback and extreme records stay honest and bounded',async({page},info)=>{
 await page.setViewportSize({width:320,height:568});await page.goto(origin+prefix)
 for(const scenario of ['empty','pending','fallback','self','all-losses','all-wins','long']){
  await page.evaluate(scenario=>(window as unknown as {labFixture:Fixture}).labFixture.render(scenario),scenario)
  await bounded(page)
  if(scenario==='empty'){await expect(page.locator('.lab-scoreboard meter')).toHaveCount(0);await expect(page.locator('.lab-form-strip')).toHaveCount(0);await expect(page.locator('#results-content')).toContainText('No matches are connected to this player record yet.')}
  if(scenario==='pending'){
   await expect(page.locator('#results-content').getByRole('img',{name:'Decided win rate in loaded recent results: no decided results',exact:true})).toBeVisible()
   await expect(page.locator('.lab-match-form')).toContainText('10 pending')
   await expect(page.locator('.lab-match-streaks')).toHaveCount(0)
   await page.locator('[data-result-view="formats"]').click()
   const comparison=page.getByRole('region',{name:'Singles and doubles comparison',exact:true})
   await expect(comparison.getByRole('meter')).toHaveCount(0)
   await expect(comparison.getByRole('button',{name:'View 6 doubles scorecards',exact:true})).toBeVisible()
  }
  if(scenario==='fallback')await expect(page.locator('.lab-scoreboard')).toContainText('Overall used')
  if(scenario==='self')await expect(page.locator('.lab-level-path meter')).toHaveCount(0)
  if(scenario==='all-losses'){await expect(page.locator('.lab-form-strip').getByRole('img',{name:'Wins in your latest 5 decided individual results: 0%',exact:true})).toBeVisible();await expect(page.locator('.lab-form-strip .stat-donut-fill')).toHaveCount(0)}
  if(scenario==='all-wins')await expect(page.locator('.lab-form-strip .stat-donut-fill')).toHaveAttribute('stroke-dasharray','100 100')
  if(scenario==='long'){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('lab-scoreboard-long-name.png'),fullPage:false})}
 }
})
test('recent form filters keep exact scorecards, focus and session guards',async({page})=>{
 await page.setViewportSize({width:320,height:720})
 await page.goto(origin+prefix)
 await page.addStyleTag({content:':root{font-size:22px!important}'})
 const card=page.locator('.lab-form-strip'),format=card.getByRole('group',{name:'Recent form format'})
 const singles=format.getByRole('button',{name:'Singles',exact:true})
 await singles.focus();await singles.press('Enter')
 await expect(singles).toBeFocused();await expect(singles).toHaveAttribute('aria-pressed','true')
 await expect(card.getByRole('status')).toHaveText('Latest 4 decided singles results in your loaded matches')
 await expect(card.getByRole('img',{name:'Wins in your latest 4 decided singles results: 100%',exact:true})).toBeVisible()
 await expect(page.locator('#results-content [data-match-filter="All"]')).toHaveAttribute('aria-pressed','true')
 await card.locator('[data-lab-form-index="9"]').click()
 expect((await fixture(page)).opened).toBe('court-9');await bounded(page)
 const doubles=format.getByRole('button',{name:'Doubles',exact:true})
 await doubles.click()
 await expect(card.getByRole('status')).toHaveText('Latest 5 decided doubles results in your loaded matches')
 await expect(card.locator('[data-lab-form-index]')).toHaveCount(5)
 expect((await fixture(page)).authReads).toBe(0)
 await page.evaluate(()=>(window as unknown as {labFixture:Fixture}).labFixture.invalidate())
 await card.locator('[data-lab-form-index="2"]').click();expect((await fixture(page)).opened).toBe('court-9')
 await singles.click();await expect(doubles).toHaveAttribute('aria-pressed','true')

 await page.evaluate(()=>(window as unknown as {labFixture:Fixture}).labFixture.render('doubles-only'))
 await singles.click()
 await expect(card.getByRole('status')).toHaveText('No decided singles results in your loaded matches.')
 await expect(card.locator('[data-lab-form-index],.stat-donut')).toHaveCount(0)
 await doubles.click();await expect(card.locator('[data-lab-form-index]')).toHaveCount(5)
})
test('history remains opt-in, follows its session guard and supports retry',async({page})=>{
 await page.goto(origin+prefix);expect((await fixture(page)).authReads).toBe(0)
 const history=page.getByRole('button',{name:'Your TIQ over time',exact:true})
 await history.click()
 await expect(page.locator('#rating-trends [role="alert"]')).toContainText('Can’t load rating history');expect((await fixture(page)).authReads).toBe(1)
 await page.getByRole('button',{name:'Retry rating history',exact:true}).click();await expect.poll(async()=>(await fixture(page)).authReads).toBe(2)
 await page.evaluate(()=>{const state=(window as unknown as {labFixture:Fixture}).labFixture;state.render('default');state.invalidate()})
 await history.click();expect((await fixture(page)).authReads).toBe(0)
})
