import {test,expect,type Page} from '@playwright/test'

async function openPractice(page:Page,query=''){
 await page.goto('http://127.0.0.1:4283/?training-inbox-review=1'+query)
 await page.evaluate(()=>{
  const writes:string[]=[],original=window.fetch.bind(window);Object.assign(window,{partnerContextWrites:writes})
  window.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(url.pathname==='/api/player/level-up-sessions'&&init?.method==='POST')writes.push(String(init.body));return original(input,init)}
 })
 await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await page.locator('[data-app-destination="training"]').click()
 const training=page.getByRole('dialog',{name:'Level Up training',exact:true});await training.getByRole('searchbox',{name:'Find a drill',exact:true}).fill('Return +1 Conditioning');return training
}
const writes=(page:Page)=>page.evaluate(()=>(window as unknown as {partnerContextWrites:string[]}).partnerContextWrites)
test.describe('Partner conditioning context',()=>{
 test('finds partner conditioning and saves its physical work and selected partner context privately',async({page})=>{
  const training=await openPractice(page);await training.getByRole('button',{name:'Solo',exact:true}).click();await expect(training.getByRole('heading',{name:'No matching drills',exact:true})).toBeVisible()
  await training.getByRole('button',{name:'With a partner',exact:true}).click();await expect(training.locator('[data-catalog-count]')).toHaveText('1 drill');const preview=training.getByRole('button',{name:'Preview Return +1 Conditioning',exact:true});await expect(preview).toHaveAccessibleDescription(/With a partner/);await preview.click();await training.getByRole('button',{name:'Start training',exact:true}).click()
  const context=training.getByRole('combobox',{name:'Training context',exact:true});await expect(context).toHaveValue('partner');await expect(context.locator('option')).toHaveText(['Solo','With a partner']);await expect(context).toHaveAccessibleDescription(/This drill uses a partner/)
  await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('2');await training.getByRole('textbox',{name:'Your training note',exact:true}).fill('Keep a balanced recovery.');await training.getByRole('button',{name:'Save completed session',exact:true}).click()
  const latest=training.locator('.training-history-latest');await expect(latest).toContainText('Return +1 Conditioning');await expect(latest).toContainText('With a partner')
  const saved=JSON.parse((await writes(page))[0]).session;expect(saved).toMatchObject({cardId:'return-1-conditioning',context:'partner',workType:'physical',rating:2,note:'Keep a balanced recovery.',sharedWithCoach:false});expect(saved).not.toHaveProperty('assignmentId')
 })
 test('retains an explicit solo adaptation in history while a fresh repeat offers the usual partner setup',async({page})=>{
  const training=await openPractice(page);await training.getByRole('button',{name:'Preview Return +1 Conditioning',exact:true}).click();await training.getByRole('button',{name:'Start training',exact:true}).click();await training.getByRole('combobox',{name:'Training context',exact:true}).selectOption('alone');await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('3');await training.getByRole('button',{name:'Save completed session',exact:true}).click()
  await expect(training.locator('.training-history-latest')).toContainText('Solo');expect(JSON.parse((await writes(page))[0]).session.context).toBe('alone')
  await training.getByRole('button',{name:'Practice this drill again',exact:true}).click();await training.getByRole('button',{name:'Start training',exact:true}).click();await expect(training.getByRole('combobox',{name:'Training context',exact:true})).toHaveValue('partner');expect(await writes(page)).toHaveLength(1)
 })
 test('keeps partner context frozen through Close and an interrupted save on a small phone',async({page},info)=>{
  await page.setViewportSize({width:320,height:568});const training=await openPractice(page,'&training-session-lost-response=1&large=1');await training.getByRole('button',{name:'Preview Return +1 Conditioning',exact:true}).click();await training.getByRole('button',{name:'Start training',exact:true}).click()
  const context=training.getByRole('combobox',{name:'Training context',exact:true});await context.focus();await context.press('Escape');await training.getByRole('button',{name:'Keep training',exact:true}).click();await expect(context).toHaveValue('partner');await expect(context).toBeFocused();expect(await training.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('2');await training.getByRole('button',{name:'Save completed session',exact:true}).click();await expect(training.getByRole('button',{name:'Check whether this session saved',exact:true})).toBeVisible();await expect(context).toBeDisabled();await expect(context).toHaveValue('partner');await context.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('partner-context-small-phone.png')})
  await training.getByRole('button',{name:'Check whether this session saved',exact:true}).click();await expect(training.locator('.training-history-latest')).toContainText('With a partner');expect(await writes(page)).toHaveLength(1)
 })
})
