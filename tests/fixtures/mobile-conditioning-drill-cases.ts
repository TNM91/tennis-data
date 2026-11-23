import {test,expect,type Page} from '@playwright/test'

async function openConditioning(page:Page,title:string,query=''){
 await page.goto('http://127.0.0.1:4283/?training-inbox-review=1'+query)
 await page.evaluate(()=>{
  const writes:string[]=[],original=window.fetch.bind(window);Object.assign(window,{conditioningWrites:writes})
  window.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(url.pathname==='/api/player/level-up-sessions'&&init?.method==='POST')writes.push(String(init.body));return original(input,init)}
 })
 await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await page.locator('[data-app-destination="training"]').click()
 const training=page.getByRole('dialog',{name:'Level Up training',exact:true});await training.getByRole('searchbox',{name:'Find a drill',exact:true}).fill(title);await training.getByRole('button',{name:'Preview '+title,exact:true}).click();return training
}
const writes=(page:Page)=>page.evaluate(()=>(window as unknown as {conditioningWrites:string[]}).conditioningWrites)
const cases=[['Serve +1 Conditioning','serve-1-conditioning','serve recovery patterns','alone'],['Return +1 Conditioning','return-1-conditioning','return recovery patterns','partner']] as const
test.describe('Conditioning practice playbooks',()=>{
 for(const [title,id,label,context] of cases)for(const version of ['control','pressure'] as const)test('logs and repeats '+title+' · '+version,async({page})=>{
  const training=await openConditioning(page,title);await training.getByRole('combobox',{name:'Practice version',exact:true}).selectOption(version)
  await expect(training.getByRole('region',{name:'Drill setup',exact:true})).toContainText('3 rounds · 6 reps per round')
  await training.getByText('Quick coaching',{exact:true}).click();await expect(training.locator('[data-drill-fold="coaching"]')).toContainText(id==='serve-1-conditioning'?'keep shadow work separate from live-ball accuracy':'take more rest when balance fades')
  await training.getByRole('button',{name:'Start training',exact:true}).click();await expect(training.getByRole('combobox',{name:'Training context',exact:true})).toHaveValue(context);await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('2')
  await training.getByRole('textbox',{name:'Your training note',exact:true}).fill('Keep the rest.');await training.getByRole('button',{name:'On-court view',exact:true}).click();await training.getByRole('button',{name:'Rounds',exact:true}).click()
  await training.getByText('What counts?',{exact:true}).click();await expect(training.locator('.training-rounds')).toContainText(id==='serve-1-conditioning'?'not a fitness score':'not point wins or a fitness score')
  await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('0');await training.getByRole('spinbutton',{name:'Round 3',exact:true}).fill('4');await training.getByRole('button',{name:'Finish & log',exact:true}).click();await training.getByRole('button',{name:'Save completed session',exact:true}).click()
  await expect(training.locator('.training-history-latest')).toContainText(title);await training.getByRole('combobox',{name:'Drill',exact:true}).selectOption(id)
  const comparison=training.getByRole('region',{name:'Recent round results',exact:true});await expect(comparison).toContainText('4 / 12 '+label);await expect(comparison.locator('.training-round-result-head>span')).toHaveText('33%')
  const saved=JSON.parse((await writes(page))[0]).session;expect(saved).toMatchObject({cardId:id,workType:'physical',rating:2,context,sharedWithCoach:false});expect(saved.note).toContain('R1 0/6; R3 4/6. Total 4/12.');expect(saved).not.toHaveProperty('assignmentId')
  await training.getByRole('button',{name:'Practice this drill again',exact:true}).click();await expect(training.getByRole('combobox',{name:'Practice version',exact:true})).toHaveValue(version);await training.getByRole('button',{name:'Start training',exact:true}).click()
  for(const field of await training.locator('[data-drill-result]').all())await expect(field).toHaveValue('');expect(await writes(page)).toHaveLength(1)
 })
 for(const [index,[title]] of cases.entries())test('keeps '+title+' through a short-phone unconfirmed save',async({page},info)=>{
  await page.setViewportSize({width:index===0?390:320,height:568});const training=await openConditioning(page,title,'&training-session-lost-response=1'+(index===1?'&large=1':''))
  await training.getByRole('combobox',{name:'Practice version',exact:true}).selectOption('pressure');await training.getByRole('button',{name:'Start training',exact:true}).click();await training.getByRole('button',{name:'On-court view',exact:true}).click();await training.getByRole('button',{name:'Rounds',exact:true}).click()
  const first=training.getByRole('spinbutton',{name:'Round 1',exact:true}),third=training.getByRole('spinbutton',{name:'Round 3',exact:true});await first.fill('0');await third.fill('4');await third.press('Escape');await training.getByRole('button',{name:'Keep training',exact:true}).click()
  await expect(third).toBeFocused();await expect(third).toBeInViewport({ratio:1});expect(await third.evaluate(el=>{const rect=el.getBoundingClientRect();return document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)===el})).toBe(true)
  await expect(training.getByRole('spinbutton',{name:'Round 2',exact:true})).toHaveValue('');await expect(training.getByRole('button',{name:'Finish & log',exact:true})).toBeInViewport({ratio:1});expect(await training.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.screenshot({path:info.outputPath('conditioning-practice-short-phone.png')});await training.getByRole('button',{name:'Finish & log',exact:true}).click();await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('3');await training.getByRole('button',{name:'Save completed session',exact:true}).click()
  await expect(training.getByRole('button',{name:'Check whether this session saved',exact:true})).toBeVisible();await expect(first).toBeDisabled();await expect(third).toHaveValue('4');await training.getByRole('button',{name:'Check whether this session saved',exact:true}).click();await expect(training.locator('.training-history-latest')).toContainText('R1 0/6; R3 4/6');expect(await writes(page)).toHaveLength(1)
 })
 test('preserves solo adaptation notes and raw partner counts until the player corrects the setup',async({page})=>{
  const training=await openConditioning(page,'Return +1 Conditioning');await training.getByRole('button',{name:'Start training',exact:true}).click();await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('0');const context=training.getByRole('combobox',{name:'Training context',exact:true});await context.selectOption('alone');await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('2');await training.getByRole('textbox',{name:'Your training note',exact:true}).fill('Solo shadow recovery.');await training.getByRole('button',{name:'Save completed session',exact:true}).click()
  await expect(training.locator('.training-session-log [data-notice]')).toContainText('These round results need a partner');await expect(context).toBeFocused();await expect(training.getByRole('spinbutton',{name:'Round 1',exact:true})).toHaveValue('0');await expect(training.getByRole('textbox',{name:'Your training note',exact:true})).toHaveValue('Solo shadow recovery.');expect(await writes(page)).toHaveLength(0)
  await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('');await training.getByRole('button',{name:'Save completed session',exact:true}).click();await expect(training.locator('.training-history-latest')).toContainText('Solo');expect(JSON.parse((await writes(page))[0]).session).toMatchObject({context:'alone',note:'Solo shadow recovery.',workType:'physical',sharedWithCoach:false})
 })
})
