import {test,expect,type Page} from '@playwright/test'
import {LEVEL_UP_CARDS} from '../../lib/level-up/level-up-cards'
import {freezeTrainingSave} from '../../mobile/src/level-up-model'
import type {TrainingSave} from '../../mobile/src/level-up-data'
import {newDrillPractice,drillSessionNote} from '../../mobile/src/drill-playbook'
import {competitionOwner} from './competitions-data'
type HistoryRow=TrainingSave&{playerUserId:string;sessionJson:{cardId:string}}
type HistoryCapture={rows:HistoryRow[];writes:string[];reads:number;fail:boolean;hold:boolean;release:(()=>void)|null;stale:HTMLElement[]}
type HistoryWindow=Window&{historyCapture:HistoryCapture;switchNavigationOwner:()=>void}
function historyRows():HistoryRow[]{
 return [
  ['return-depth-lane','pressure',['0','','8'],'partner'],['return-depth-lane','control',['10','10','10'],'partner'],
  ['return-depth-lane','pressure',['9','',''],'doubles'],['return-depth-lane','pressure',['2','4','6'],'partner'],
  ['return-depth-lane','pressure',['0','',''],'partner'],['return-depth-lane','pressure',['9','',''],'partner'],
  ['wall-rally-rhythm','control',['8','8',''],'alone'],['cone-recover-shadow-swing','control',null,'alone'],
 ].map(([id,version,results,context],index)=>{
  const card=LEVEL_UP_CARDS.find(card=>card.id===id)??LEVEL_UP_CARDS.find(card=>card.title==='Cone Recover + Shadow Swing')!
  const practice=newDrillPractice(card,version as 'control'|'pressure')
  if(practice&&Array.isArray(results))practice.results=results
  const note=practice?drillSessionNote(card,practice,'Private focus '+index+'.'):'Original private note.'
  const saved=freezeTrainingSave(card,2,note,String(context),'ready',300,'level-up-11111111-1111-4111-8111-'+String(index).padStart(12,'0'),new Date(Date.UTC(2026,10,22-index,12)).toISOString())
  return {...saved,playerUserId:competitionOwner,sessionJson:{cardId:card.id}}
 })
}
async function openHistory(page:Page,query=''){
 await page.goto('http://127.0.0.1:4283/?training-inbox-review=1'+query)
 await page.evaluate(({rows,owner})=>{
  const state:HistoryCapture={rows,writes:[],reads:0,fail:false,hold:false,release:null,stale:[]},original=window.fetch.bind(window)
  ;(window as unknown as HistoryWindow).historyCapture=state
  window.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
   if(url.pathname!=='/api/player/level-up-sessions')return original(input,init)
   if(init?.method==='POST'){
    state.writes.push(String(init.body));const saved:TrainingSave=JSON.parse(String(init.body)).session
    const row={...saved,playerUserId:owner,sessionJson:{cardId:saved.cardId}};state.rows.unshift(row);return Response.json({ok:true,session:row})
   }
   state.reads++;if(state.fail)return Response.json({ok:false},{status:503})
   const snapshot=structuredClone(state.rows)
   if(state.hold)await new Promise<void>(resolve=>{state.release=resolve})
   return Response.json({ok:true,sessions:snapshot})
  }
 },{rows:historyRows(),owner:competitionOwner})
 await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await page.locator('[data-app-destination="training-progress"]').click()
 const progress=page.getByRole('dialog',{name:'Level Up training',exact:true})
 await expect(progress.locator('.training-history-item')).toHaveCount(8)
 return progress
}
const writes=(page:Page)=>page.evaluate(()=>(window as unknown as HistoryWindow).historyCapture.writes)
test.describe('Drill progress comparison',()=>{
 test('filters the log and compares three sessions from the same version and context',async({page})=>{
  const progress=await openHistory(page),filter=progress.getByRole('combobox',{name:'Drill',exact:true})
  await filter.selectOption('return-depth-lane');await expect(filter).toBeFocused()
  await expect(progress.locator('.training-history-item')).toHaveCount(6);await expect(progress.locator('.training-history-overview dd').first()).toHaveText('6')
  const comparison=progress.getByRole('region',{name:'Recent round results',exact:true})
  await expect(comparison.locator('.training-round-result-head strong')).toHaveText(['8 / 20 deep returns','12 / 30 deep returns','0 / 10 deep returns'])
  await expect(comparison.locator('.training-round-result-head>span')).toHaveText(['40%','40%','0%'])
  await expect(comparison).toContainText('Add pressure · With a partner');await expect(comparison).toContainText('Conditions may differ')
  await expect(progress.locator('.training-history-latest')).toContainText('2 / 5');await expect(progress.locator('.training-history-latest')).toContainText('R1 0/10; R3 8/10')
  await filter.selectOption('wall-rally-rhythm');await expect(progress.locator('.training-history-item')).toHaveCount(1);await expect(comparison).toContainText('16 / 20 controlled contacts')
  await filter.selectOption('');await expect(progress.locator('.training-history-item')).toHaveCount(8);await expect(comparison).toHaveCount(0);expect(await writes(page)).toHaveLength(0)
 })
 test('repeats the selected version with blank rounds and returns to the same filtered log',async({page})=>{
  const progress=await openHistory(page),filter=progress.getByRole('combobox',{name:'Drill',exact:true})
  await filter.selectOption('return-depth-lane');const repeat=progress.getByRole('button',{name:'Practice this drill again',exact:true})
  await repeat.click();await expect(progress.getByRole('combobox',{name:'Practice version',exact:true})).toHaveValue('pressure')
  await progress.getByRole('button',{name:'Back to training progress',exact:true}).click();await expect(filter).toHaveValue('return-depth-lane');await expect(repeat).toBeFocused()
  await repeat.click();await progress.getByRole('button',{name:'Start training',exact:true}).click();await expect(progress.locator('[data-drill-result]')).toHaveCount(3)
  for(const input of await progress.locator('[data-drill-result]').all())await expect(input).toHaveValue('')
  await progress.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('0');await progress.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('3');await progress.getByRole('textbox',{name:'Your training note',exact:true}).fill('Recover first.');await progress.getByRole('button',{name:'Save completed session',exact:true}).click()
  await expect(filter).toHaveValue('return-depth-lane');await expect(progress.locator('.training-history-item')).toHaveCount(7);await expect(progress.locator('.training-history-latest')).toContainText('Recover first.')
  const saved=JSON.parse((await writes(page))[0]).session;expect(saved.note).toContain('Add pressure');expect(saved.note).toContain('R1 0/10');expect(saved.sharedWithCoach).toBe(false);expect(saved.rating).toBe(3)
 })
 test('keeps the drill selection and comparison after a failed refresh',async({page})=>{
  const progress=await openHistory(page),filter=progress.getByRole('combobox',{name:'Drill',exact:true});await filter.selectOption('return-depth-lane')
  await page.evaluate(()=>{(window as unknown as HistoryWindow).historyCapture.fail=true})
  const refresh=progress.getByRole('button',{name:'Refresh account progress',exact:true});await refresh.click()
  await expect(progress.getByRole('alert')).toContainText('Showing your last loaded sessions');await expect(refresh).toBeFocused();await expect(filter).toHaveValue('return-depth-lane');await expect(progress.locator('.training-drill-comparison li')).toHaveCount(3)
  await page.evaluate(()=>{(window as unknown as HistoryWindow).historyCapture.fail=false});await refresh.click();await expect(progress.getByRole('alert')).toHaveCount(0);await expect(filter).toHaveValue('return-depth-lane');expect(await writes(page)).toHaveLength(0)
 })
 test('retains a selected drill that disappears from the loaded history without changing the selection',async({page})=>{
  const progress=await openHistory(page),filter=progress.getByRole('combobox',{name:'Drill',exact:true});await filter.selectOption('return-depth-lane')
  await page.evaluate(()=>{(window as unknown as HistoryWindow).historyCapture.rows=[]})
  await progress.getByRole('button',{name:'Refresh account progress',exact:true}).click();await expect(progress.getByRole('heading',{name:'No loaded sessions for this drill',exact:true})).toBeVisible();await expect(filter).toHaveValue('return-depth-lane');await expect(progress.getByRole('region',{name:'Recent round results',exact:true})).toHaveCount(0)
  await page.evaluate(()=>{(window as unknown as HistoryWindow).historyCapture.fail=true});await progress.getByRole('button',{name:'Refresh account progress',exact:true}).click();await expect(progress.getByRole('alert')).toBeVisible();await expect(filter).toHaveValue('return-depth-lane')
  await filter.selectOption('');await expect(progress.locator('.training-history-item')).toHaveCount(0);await expect(progress.getByRole('heading',{name:'Your practice starts here',exact:true})).toHaveCount(0);expect(await writes(page)).toHaveLength(0)
 })
 test('keeps an unrecognized latest note and legacy sessions without inventing a count',async({page})=>{
  const progress=await openHistory(page)
  await page.evaluate(()=>{(window as unknown as HistoryWindow).historyCapture.rows[0].note='Private <img src=x> note.\n\n8/20 today.'})
  await progress.getByRole('button',{name:'Refresh account progress',exact:true}).click();const filter=progress.getByRole('combobox',{name:'Drill',exact:true});await filter.selectOption('return-depth-lane')
  await expect(progress.getByRole('region',{name:'Recent round results',exact:true})).toContainText('Round results are not available for the latest session.');await expect(progress.locator('.training-round-result-head')).toHaveCount(0);await expect(progress.locator('.training-history-latest')).toContainText('Private <img src=x> note.');await expect(progress.locator('.training-history-latest img')).toHaveCount(0)
  const legacy=historyRows()[7].sessionJson.cardId;await filter.selectOption(legacy);await expect(progress.getByRole('region',{name:'Recent round results',exact:true})).toContainText('This drill uses notes and self-rated proof.');await expect(progress.locator('.training-history-latest')).toContainText('Original private note.');expect(await writes(page)).toHaveLength(0)
 })
 test('clears private comparisons on account change and ignores a held refresh and detached controls',async({page})=>{
  const progress=await openHistory(page);await progress.getByRole('combobox',{name:'Drill',exact:true}).selectOption('return-depth-lane')
  await page.evaluate(()=>{const state=(window as unknown as HistoryWindow).historyCapture;state.hold=true;state.stale=Array.from(document.querySelectorAll<HTMLElement>('[data-history-drill],.training-history-action'))})
  await progress.getByRole('button',{name:'Refresh account progress',exact:true}).click();await expect.poll(()=>page.evaluate(()=>Boolean((window as unknown as HistoryWindow).historyCapture.release))).toBe(true)
  await page.evaluate(()=>{(window as unknown as HistoryWindow).switchNavigationOwner()});await expect(progress).toHaveCount(0)
  await page.evaluate(()=>{const state=(window as unknown as HistoryWindow).historyCapture;for(const control of state.stale){control.dispatchEvent(new Event('change',{bubbles:true}));control.dispatchEvent(new Event('click',{bubbles:true}))}state.release?.()})
  await expect(progress).toHaveCount(0);await expect(page.getByText('Private focus 0.',{exact:false})).toHaveCount(0);expect(await writes(page)).toHaveLength(0)
 })
 for(const width of [320,390])test('keeps the comparison readable without overflow at '+width+'px',async({page},info)=>{
  await page.setViewportSize({width,height:844});const progress=await openHistory(page,width===320?'&large=1':'')
  const filter=progress.getByRole('combobox',{name:'Drill',exact:true});await filter.selectOption('return-depth-lane');await expect(filter).toBeFocused();expect((await filter.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  const comparison=progress.getByRole('region',{name:'Recent round results',exact:true});await comparison.scrollIntoViewIfNeeded();expect(await progress.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);expect(await comparison.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  const bars=await comparison.locator('.training-round-result-track').evaluateAll(nodes=>nodes.map(el=>({width:el.getBoundingClientRect().width,fill:el.lastElementChild!.getBoundingClientRect().width})))
  for(const bar of bars)expect(bar.fill).toBeLessThanOrEqual(bar.width+1);expect(bars[2].fill).toBe(0)
  await page.screenshot({path:info.outputPath('drill-progress-'+width+'.png')})
  await progress.getByRole('button',{name:'Practice this drill again',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('drill-progress-repeat-'+width+'.png')})
 })
})
