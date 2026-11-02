import {test,expect,type Page,type Locator} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {captainCenterFixture,captainSnapshotFixture,captainDayFixture,captainScope} from '../fixtures/native-captain-match-center'

const origin='http://127.0.0.1:4266',prefix='/__captain-workspace/'
let javascript='',stylesheet=''
test.describe.configure({retries:0,timeout:20000})
test.beforeAll(async()=>{
 const result=await build({stdin:{resolveDir:process.cwd(),sourcefile:'captain-workspace-fixture.ts',loader:'ts',contents:`
 import {showCaptainWorkspace} from './mobile/src/captain-view';
 const fixture=(window as any).fixture;let active=true;
 const view=showCaptainWorkspace(document.querySelector('#app')!,{} as never,'synthetic-owner',fixture.scope,()=>active,()=>{fixture.sharedChanges++},undefined,'synthetic-room');
 fixture.dispose=()=>{active=false;view.dispose()};
 `},bundle:true,minify:true,platform:'browser',format:'esm',outfile:'captain-workspace-fixture.js',write:false,jsx:'automatic',loader:{'.module.css':'local-css'},plugins:[{name:'synthetic-captain-reads',setup(builder){
  builder.onResolve({filter:/^\.\/captain-data$/},()=>({path:'captain-data',namespace:'fixture'}))
  builder.onLoad({filter:/^captain-data$/,namespace:'fixture'},()=>({loader:'ts',resolveDir:process.cwd(),contents:`export * from ${JSON.stringify(path.resolve('mobile/src/captain-data.ts'))};export async function loadCaptainData(){return structuredClone(window.fixture.snapshot)}` }))
  builder.onResolve({filter:/^\.\/captain-match-center-data$/},()=>({path:'center-data',namespace:'fixture'}))
  builder.onLoad({filter:/^center-data$/,namespace:'fixture'},()=>({loader:'ts',resolveDir:process.cwd(),contents:`
   export * from ${JSON.stringify(path.resolve('mobile/src/captain-match-center-data.ts'))};
   export async function loadMatchCenter(_client,_owner,_current,_scope,match){const f=window.fixture;f.reads++;if(f.hold)await new Promise(resolve=>f.release=resolve);if(f.fail)throw Error('Synthetic read failed');const data=structuredClone(f.center);data.fixture.id=match.id;data.fixture.date=match.date;data.fixture.away=match.opponent;data.lineup.match={id:match.id,date:match.date,opponent:match.opponent};Object.assign(data.publication,{fixtureId:match.id,matchDate:match.date,opponent:match.opponent});return data}
   export async function loadMatchCenterDay(){window.fixture.dayReads++;return structuredClone(window.fixture.day)}
  ` }))
 }}]})
 javascript=result.outputFiles.find(file=>file.path.endsWith('.js'))?.text??result.outputFiles[0].text
 stylesheet=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css','premium-surfaces.css'].map(file=>readFile('mobile/bundled/'+file,'utf8')))).join('\n')
})
test.beforeEach(async({page})=>{
 const center=captainCenterFixture()
 await page.addInitScript(data=>{
  const params=new URL(location.href).searchParams
  if(params.has('final')){data.center.publication.shared.alreadyFinal=true;data.day.publication.shared.alreadyFinal=true}
  if(params.has('pending'))data.center.publication.shared.pendingFinal=true
  Object.assign(window,{fixture:{...data,reads:0,dayReads:0,sharedChanges:0,hold:false,fail:false}})
 },{scope:captainScope,center,day:captainDayFixture(center),snapshot:captainSnapshotFixture()})
 await page.route('**/*',route=>{
  const u=new URL(route.request().url())
  if(u.origin!==origin||!u.pathname.startsWith(prefix))return route.abort()
  if(u.pathname.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:javascript})
  if(u.pathname.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:stylesheet})
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./style.css"></head><body data-screen="teams"><main id="app"></main><script type="module" src="./app.js"></script></body></html>'})
 })
})
async function bounded(page:Page,host:Locator){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(await host.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
 const escaped=await host.locator('button,input,select,dl>div').evaluateAll(nodes=>nodes.filter(el=>{
  const box=el.getBoundingClientRect(),container=(el.closest('dialog')||document.querySelector('main'))!.getBoundingClientRect()
  return box.width>0&&(box.left<container.left-1||box.right>container.right+1)
 }).map(el=>el.textContent?.trim()))
 expect(escaped).toEqual([])
}
for(const width of [320,390])test(`captain readiness and match steps stay usable at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.goto(origin+prefix)
 if(width===320)await page.addStyleTag({content:':root{font-size:24px!important}'})
 const home=page.locator('.captain-home')
 await expect(home.locator('.captain-fixture-hero')).toContainText('Riverside Racquet Club')
 await expect(home.locator('.website-captain-focus')).toContainText('Not checked')
 await bounded(page,page.locator('#app'))
 await home.getByRole('button',{name:'Check match readiness',exact:true}).click()
 await expect(home.locator('.website-captain-focus')).toContainText('1 of 2')
 await expect(home.locator('.website-captain-focus')).toContainText('1 selected player needs availability review.')
 await bounded(page,page.locator('#app'));await home.scrollIntoViewIfNeeded()
 await page.screenshot({path:info.outputPath('captain-home.png'),fullPage:true})
 await page.locator('[data-captain-center="0"]').focus();await page.keyboard.press('Enter')
 const center=page.getByRole('dialog',{name:'Captain Match Center',exact:true})
 await expect(center.getByRole('heading',{name:'Captain Match Center',exact:true})).toBeFocused()
 await expect(center.locator('.captain-fixture-details')).toContainText('6:30 PM')
 await expect(center.locator('.lineup-readiness')).toContainText('Waiting for reply')
 await bounded(page,center);await page.screenshot({path:info.outputPath('captain-match-center.png')})
 await center.locator('[data-step-next="availability"]').click()
 await expect(center.locator('[data-center-panel="availability"] [data-step-heading]')).toBeFocused()
 await center.getByLabel('Find a player',{exact:true}).fill('Jordan')
 await expect(center.locator('[data-center-replies] li')).toHaveCount(1)
 await center.locator('[data-step-next="messaging"]').click()
 await expect(center.locator('.match-center-progress')).toContainText('0 of 1 courts confirmed')
 await expect(center.locator('.match-center-progress [data-plan-state="saved"]')).toHaveCount(2)
 await bounded(page,center);await page.screenshot({path:info.outputPath('captain-lineup-progress.png')})
 await center.locator('[data-match-week-step="availability"]').click()
 await expect(center.getByLabel('Find a player',{exact:true})).toHaveValue('Jordan')
 await center.getByRole('button',{name:'Back to Captain',exact:true}).click()
 await expect(page.locator('[data-captain-center="0"]')).toBeFocused()
 expect(await page.evaluate(()=>(window as unknown as {fixture:{sharedChanges:number}}).fixture.sharedChanges)).toBe(0)
})
test('final match-day checks distinguish explicit arrivals from unanswered players',async({page})=>{
 await page.goto(origin+prefix+'?final=1');await page.locator('[data-captain-center="0"]').click()
 const center=page.getByRole('dialog',{name:'Captain Match Center',exact:true})
 await center.locator('[data-center-action="day"]').first().click()
 await expect(center.locator('.captain-arrivals')).toContainText('Running late')
 await expect(center.locator('.captain-arrivals>div')).toHaveCount(3)
 await expect(center.locator('.match-center-day')).toContainText('Missing check-ins do not mean a player is absent.')
 await expect(center.locator('.match-center-progress [data-plan-state="saved"]')).toHaveCount(3)
 await bounded(page,center)
})
test('pending final delivery keeps its warning text and review state',async({page})=>{
 await page.goto(origin+prefix+'?pending=1');await page.locator('[data-captain-center="0"]').click()
 const center=page.getByRole('dialog',{name:'Captain Match Center',exact:true})
 await expect(center.locator('.match-center-next')).toContainText('Review pending final update')
 await center.locator('[data-step-next="availability"]').click();await center.locator('[data-step-next="messaging"]').click()
 await expect(center.locator('[data-plan-state="attention"]')).toContainText('Final delivery needs attention')
})
test('switching fixture with a readiness read pending does not show stale counts',async({page})=>{
 await page.goto(origin+prefix);await page.evaluate(()=>{(window as unknown as {fixture:{hold:boolean}}).fixture.hold=true})
 const home=page.locator('.captain-home');await home.getByRole('button',{name:'Check match readiness',exact:true}).click()
 await expect(home.getByRole('status')).toContainText('Checking this fixture')
 await page.getByLabel('Choose fixture',{exact:true}).selectOption('fixture-two')
 await page.evaluate(()=>{(window as unknown as {fixture:{release:()=>void}}).fixture.release()})
 await expect(home.locator('.captain-fixture-hero')).toContainText('South Court Rallies')
 await expect(home.locator('.website-captain-focus')).toContainText('Not checked')
 await expect(home.getByRole('button',{name:'Check match readiness',exact:true})).toBeEnabled()
})
