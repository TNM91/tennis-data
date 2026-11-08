import {test,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
test.describe.configure({retries:0,timeout:20000})
const origin='http://127.0.0.1:4263',prefix='/__native-insights/'
let javascript='',stylesheet=''
type State={opened:string;active:boolean;invalidate:()=>void}
const state=(page:Page)=>page.evaluate(()=>{const value=(window as unknown as {insightsFixture:State}).insightsFixture;return {opened:value.opened,active:value.active}})
test.beforeAll(async()=>{
 const bundled=await build({entryPoints:['tests/fixtures/mobile-insights.tsx'],bundle:true,platform:'browser',format:'esm',outfile:'insights-fixture.js',write:false,jsx:'automatic',loader:{'.module.css':'local-css'}})
 javascript=bundled.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 const css=bundled.outputFiles.find(file=>file.path.endsWith('.css'))!.text
 stylesheet=(await Promise.all(['style.css','website-ui.css','app.css'].map(file=>readFile('mobile/bundled/'+file,'utf8')))).join('\n')+'\n'+css+'\n'+(await Promise.all(['website-parity.css','app-atmosphere.css','premium-surfaces.css'].map(file=>readFile('mobile/bundled/'+file,'utf8')))).join('\n')
})
test.beforeEach(async({page})=>{
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin||!url.pathname.startsWith(prefix))return route.abort()
  if(url.pathname.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:stylesheet})
  const assets:Record<string,string>={'logo.png':'mobile/bundled/logo.png','brand/approved/TiQ_White_Transparent_Refined.png':'public/brand/approved/TiQ_White_Transparent_Refined.png','brand/courts/tiq-native-night-session.png':'public/brand/courts/tiq-native-night-session.png','brand/courts/tiq-native-ace-deuce-refined-20261031-v3.png':'public/brand/courts/tiq-native-ace-deuce-refined-20261031-v3.png'}
  const asset=assets[url.pathname.slice(prefix.length)];if(asset)return route.fulfill({contentType:'image/png',body:await readFile(asset)})
  if(url.pathname!==prefix&&url.pathname!==prefix+'index.html')return route.fulfill({status:404,body:''})
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="./style.css"></head><body data-screen="lab"><header class="app-header"><img src="./logo.png" alt="TenAceIQ"></header><main id="app"></main><script type="module" src="./app.js"></script></body></html>'})
 })
})
async function bounded(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 for(const selector of ['.native-player-journey','.native-record-scoreboard','.native-profile-scoreboard','.native-team-court-insights','.lab-format-grid','.lab-breakdown-list']){
  for(const target of await page.locator(selector).all()){
   const box=await target.boundingBox();if(!box)continue;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize()!.width);expect(await target.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  }
 }
}
test('scorecard keeps the side label for an incomplete doubles lineup',async({page})=>{
 await page.goto(origin+prefix+'?view=scorecard&partial=1')
 await page.getByRole('button',{name:'Open sample scorecard',exact:true}).click()
 const players=page.getByRole('region',{name:'Players on court',exact:true})
 await expect(players.getByRole('button',{name:'View player profile for Jordan Lee',exact:true})).toBeVisible()
 const table=page.getByRole('table')
 await expect(table.locator('[data-scorecard-side="A"]')).toHaveText('Opponent')
 await expect(table.locator('[data-scorecard-side="B"] .match-scorecard-name')).toHaveText(['Alexandria-Marguerite Montgomery','Casey Morgan'])
})

test('public scorecard sharing previews the match and rechecks changes before copying',async({page},info)=>{
 await page.setViewportSize({width:320,height:844})
 await page.addInitScript(()=>{
  const scorecardCopies:string[]=[]
  Object.assign(window,{scorecardCopies})
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{scorecardCopies.push(text)}}})
  Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{}})
 })
 const copies=()=>page.evaluate(()=>(window as unknown as {scorecardCopies:string[]}).scorecardCopies)
 await page.goto(origin+prefix+'?view=scorecard&share=1')
 await page.addStyleTag({content:':root{font-size:24px!important}'})
 await page.getByRole('button',{name:'Open sample scorecard',exact:true}).click()
 const share=page.getByRole('button',{name:'Review scorecard sharing',exact:true})
 await share.click()
 const dialog=page.getByRole('dialog',{name:'Share public scorecard',exact:true})
 await expect(dialog.getByRole('heading',{name:'Share public scorecard',exact:true})).toBeFocused()
 const preview=dialog.getByRole('region',{name:'Scorecard preview',exact:true})
 await expect(preview).toContainText('Oct 29, 2026 · Doubles')
 await expect(preview.getByRole('heading',{name:'Northside Fall League',exact:true})).toBeVisible()
 await expect(preview).toContainText('6-4 3-6 10-8')
 await expect(dialog.getByRole('button',{name:'Choose where to share',exact:true})).toBeVisible()
 await page.screenshot({path:info.outputPath('public-scorecard-preview.png')})
 const message=dialog.locator('.match-share-preview')
 const link=dialog.locator('.scorecard-share-url')
 await expect(message).toBeHidden()
 await dialog.getByText('Message and link',{exact:true}).click()
 await expect(message).toContainText('Recorded score: 6-4 3-6 10-8')
 await expect(link).toHaveText('https://www.tenaceiq.com/matches/33333333-3333-4333-8333-333333333333?via=scorecard-share')
 for(const target of [dialog,message,link])expect(await target.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)

 const copy=dialog.getByRole('button',{name:'Copy scorecard details',exact:true})
 await copy.click()
 const status=dialog.getByRole('status')
 await expect(status).toContainText('This scorecard changed')
 await expect(status).toBeFocused()
 await expect(preview).toContainText('6-4 6-2')
 await expect(message).toBeVisible()
 await expect(message).toContainText('Recorded score: 6-4 6-2')
 expect(await copies()).toEqual([])
 await copy.click()
 await expect(status).toHaveText('Scorecard details copied.')
 expect(await copies()).toEqual([(await message.textContent())+'\n'+(await link.textContent())])
 await dialog.getByRole('button',{name:'Back to match details',exact:true}).click()
 await expect(share).toBeFocused()
})

for(const width of [320,390]){
 test(`three-set scorecard stays readable with larger text and returns keyboard focus at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await page.goto(origin+prefix+'?view=scorecard'+(width===320?'&long=1':''));await page.addStyleTag({content:':root{font-size:24px!important}'})
  const opener=page.getByRole('button',{name:'Open sample scorecard',exact:true});await opener.focus();await opener.press('Enter')
  await expect(page.getByRole('heading',{name:'Match scorecard',exact:true})).toBeFocused();await expect(page.locator('.match-result-label')).toHaveText('Lost')
  const table=page.getByRole('table')
  const yourNames=table.locator('[data-scorecard-side="B"] .match-scorecard-name')
  await expect(yourNames).toHaveText([/^Alexandria-Marguerite Montgomery/,'Casey Morgan'])
  await expect(table.locator('[data-scorecard-side="A"] .match-scorecard-name')).toHaveText(['Jordan Lee','Sam Rivera'])
  await expect(table.locator('tbody tr').first().locator('td')).toHaveText(['4','6','8'])
  await expect(table.locator('thead')).toContainText('TB')
  await expect(table.getByRole('rowheader',{name:/Jordan Lee.*Sam Rivera.*Winner/})).toBeVisible()
  await expect(table.locator('tbody tr').first().locator('td strong')).toHaveText(['6'])
  await expect(table.locator('tbody tr[data-match-winner] td strong')).toHaveText(['6','10'])
  for(const target of await page.locator('.match-scorecard-hero,.match-set-scores,.match-set-scores table,.match-side-card').all())expect(await target.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true)
  await expect(table).toBeInViewport({ratio:1});await expect(page.locator('.match-recorded-score')).toHaveText('6-4 3-6 10-8')
  await bounded(page);await page.screenshot({path:info.outputPath('match-scorecard-large-text.png')})
  const players=page.getByRole('region',{name:'Players on court',exact:true})
  await expect(players.getByRole('heading',{level:3})).toHaveText(['Side B Your side','Side A Winner'])
  await expect(players.locator('[data-own-side]').getByRole('button',{name:/Alexandria-Marguerite/})).toBeVisible()
  await expect(players.getByRole('button',{name:'View player profile for Jordan Lee',exact:true})).toBeVisible()
  const lineupHeading=players.getByRole('heading',{name:'Players on court',exact:true})
  await page.getByRole('button',{name:'View lineup',exact:true}).press('Enter')
  await expect(lineupHeading).toBeFocused()
  await expect(lineupHeading).toBeInViewport({ratio:1})
  await expect.poll(()=>lineupHeading.evaluate(heading=>{
   const rect=heading.getBoundingClientRect()
   return heading.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2))
  })).toBe(true)
  await page.screenshot({path:info.outputPath('match-scorecard-players.png')})
  await players.getByRole('button',{name:'Set scores',exact:true}).click()
  const scoresHeading=page.getByRole('heading',{name:'Set by set',exact:true})
  await expect(scoresHeading).toBeFocused()
  await expect(scoresHeading).toBeInViewport({ratio:1})
  await expect(table).toBeInViewport({ratio:1})
  await page.getByRole('button',{name:'Back to My Lab',exact:true}).click();await expect(page.locator('#match-detail')).toHaveCount(0);await expect(page.getByRole('button',{name:'Open sample scorecard',exact:true})).toBeFocused()
 })
 test(`rating windows and scorecard navigation stay truthful at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await page.goto(origin+prefix+'?view=journey')
  const chart=page.getByRole('img',{name:'Rating trend across 5 saved ratings',exact:true})
  // dl has no consistent implicit role in WebKit; target its explicit accessible label.
  const values=page.locator('[aria-label="Saved rating window summary"]')
  await expect(values).toContainText('4.100');await expect(values).toContainText('4.420');await expect(values).toContainText('+0.320');await expect(chart).toBeVisible();await bounded(page)
  await page.screenshot({path:info.outputPath('native-insights-rating-history.png'),fullPage:false})
  await page.getByRole('button',{name:'Previous rating',exact:true}).click();await expect(page.locator('[aria-live="polite"]')).toContainText('4.370')
  await page.getByRole('button',{name:'Open scorecard',exact:true}).click();expect((await state(page)).opened).toBe('court-4')
  await page.getByRole('combobox',{name:'History window',exact:true}).selectOption('30d');await expect(page.getByRole('img',{name:'Rating trend across 3 saved ratings',exact:true})).toBeVisible();await expect(values).toContainText('+0.120')
  await page.getByRole('group',{name:'Rating format',exact:true}).getByRole('button',{name:'Singles',exact:true}).click();await expect(values).toContainText('4.370');await expect(values).toContainText('—');await expect(page.getByRole('button',{name:'Previous rating',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Open scorecard',exact:true})).toHaveCount(0)
  await page.getByRole('group',{name:'Rating format',exact:true}).getByRole('button',{name:'Doubles',exact:true}).click();await expect(values).toHaveCount(0);await expect(page.getByText('No recorded doubles ratings in this window.',{exact:false})).toBeVisible();await bounded(page)
 })
 test(`player profile and record follow the same format at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await page.goto(origin+prefix+'?view=profile')
  await expect(page.getByRole('heading',{name:'Alexandria-Marguerite Montgomery',exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'Overall match win rate: 67% wins',exact:true})).toBeVisible();await bounded(page)
  await page.screenshot({path:info.outputPath('native-insights-player-profile.png'),fullPage:false})
  await page.locator('.native-record-scoreboard').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('native-insights-player-record.png'),fullPage:false})
  await page.getByRole('group',{name:'Profile rating format',exact:true}).getByRole('button',{name:'Singles',exact:true}).click();await expect(page.getByRole('img',{name:'Singles match win rate: 50% wins',exact:true})).toBeVisible();await expect(page.locator('.native-profile-scoreboard strong[data-rating="true"]')).toHaveText('4.37')
  await page.getByRole('group',{name:'Profile rating format',exact:true}).getByRole('button',{name:'Doubles',exact:true}).click();await expect(page.getByRole('img',{name:'Doubles match win rate: 75% wins',exact:true})).toBeVisible();await expect(page.locator('.native-profile-scoreboard strong[data-rating="true"]')).toHaveText('4.49');await bounded(page)
 })
 test(`team court filters keep their exact denominator at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await page.goto(origin+prefix+'?view=team')
  await expect(page.getByRole('img',{name:'Shown court win rate: 75% wins',exact:true})).toBeVisible();await expect(page.locator('.native-record-scoreboard')).toContainText('4 decided courts');await bounded(page)
  await page.screenshot({path:info.outputPath('native-insights-team-courts.png'),fullPage:false})
  await page.getByRole('group',{name:'Team court format',exact:true}).getByRole('button',{name:'Doubles',exact:true}).click();await expect(page.getByRole('img',{name:'Shown court win rate: 100% wins',exact:true})).toBeVisible();await expect(page.locator('.native-record-scoreboard')).toContainText('2 decided courts')
  await page.getByRole('combobox',{name:'Year in loaded sample',exact:true}).selectOption('2025');await expect(page.locator('.native-record-scoreboard')).toContainText('1 decided court')
  await page.getByRole('combobox',{name:'Court result',exact:true}).selectOption('L');await expect(page.getByRole('img',{name:'Shown court win rate: no decided results',exact:true})).toBeVisible();await expect(page.locator('.native-record-scoreboard')).not.toContainText('0%')
  await page.getByRole('button',{name:'Clear court filters',exact:true}).click();await expect(page.getByRole('img',{name:'Shown court win rate: 75% wins',exact:true})).toBeVisible();await bounded(page)
 })
 test(`format and year records open their original scorecards at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await page.goto(origin+prefix+'?view=results')
  await page.locator('[data-result-view="formats"]').click();await bounded(page);await page.screenshot({path:info.outputPath('native-insights-format-comparison.png'),fullPage:false})
  await page.getByRole('button',{name:'View 4 doubles scorecards',exact:true}).click();await expect(page.locator('[data-match-filter="Doubles"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-result-view="formats"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.recent-match-list')).toHaveAttribute('open','');await expect(page.locator('.recent-match-list .match-open')).toHaveCount(4)
  await expect(page.locator('.recent-match-list>summary')).toBeFocused()
  await page.locator('.recent-match-list .match-open').first().click();expect((await state(page)).opened).toBe('result-2')
  await page.locator('[data-result-view="years"]').click();const old=page.locator('.lab-breakdown-list>li').filter({has:page.getByRole('heading',{name:'2025',exact:true})});await old.locator('summary').click();await old.getByRole('button',{name:/^Open 2025 scorecard/}).click();expect((await state(page)).opened).toBe('result-5')
  const current=page.locator('.lab-breakdown-list>li').filter({has:page.getByRole('heading',{name:String(new Date(Date.now()-86400000).getUTCFullYear()),exact:true})});await current.locator('summary').click();await bounded(page)
  await page.getByRole('heading',{name:'Results by year',exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}))
  await page.screenshot({path:info.outputPath('native-insights-year-scorecards.png'),fullPage:false})
  await page.evaluate(()=>(window as unknown as {insightsFixture:State}).insightsFixture.invalidate());await current.getByRole('button',{name:/^Open .* scorecard/}).first().click();expect((await state(page)).opened).toBe('result-5')
 })
}
