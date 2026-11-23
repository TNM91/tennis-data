import {test,expect,type Page} from '@playwright/test'

async function openCoaching(page:Page,title='Return Depth Lane',query=''){
 await page.goto('http://127.0.0.1:4283/?training-inbox-review=1'+query)
 await page.evaluate(()=>{
  const writes:string[]=[],original=window.fetch.bind(window)
  Object.assign(window,{coachingWrites:writes})
  window.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
   if(url.pathname==='/api/player/level-up-sessions'&&init?.method==='POST')writes.push(String(init.body))
   return original(input,init)
  }
 })
 await page.getByRole('button',{name:'More',exact:true}).click()
 await page.locator('[data-app-destination="coach"]').click();await page.locator('[data-app-destination="training"]').click()
 const training=page.getByRole('dialog',{name:'Level Up training',exact:true})
 await training.getByRole('searchbox',{name:'Find a drill',exact:true}).fill(title)
 await training.getByRole('button',{name:'Preview '+title,exact:true}).click()
 return training
}
const writes=(page:Page)=>page.evaluate(()=>(window as unknown as {coachingWrites:string[]}).coachingWrites)

test.describe('Drill quick coaching',()=>{
 for(const [title,correction] of [
  ['Serve Target Call','Keep the fault in the count'],
  ['Crosscourt Consistency','without adding an attempt for you'],
  ['Poach Timing Shadow','free of live balls'],
 ] as const)test('offers a drill-specific correction for '+title,async({page})=>{
  const training=await openCoaching(page,title),coaching=training.locator('[data-drill-fold="coaching"]'),summary=coaching.locator('summary')
  await expect(coaching).not.toHaveAttribute('open','');await summary.click()
  await expect(coaching).toContainText(correction);await expect(coaching.locator('li')).toHaveCount(3)
  await training.getByRole('combobox',{name:'Practice version',exact:true}).selectOption('pressure')
  await expect(coaching).toHaveAttribute('open','');await expect(coaching.locator('.training-coaching-focus')).toContainText('Add pressure')
  await expect(training.getByRole('combobox',{name:'Practice version',exact:true})).toBeFocused();expect(await writes(page)).toHaveLength(0)
 })
 test('keeps coaching open through views, backgrounding and Close without changing the log',async({page})=>{
  const training=await openCoaching(page)
  await training.getByRole('button',{name:'Start training',exact:true}).click()
  await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('2')
  await training.getByRole('textbox',{name:'Your training note',exact:true}).fill('Recover first.')
  const coaching=training.locator('[data-session-coaching]'),summary=coaching.locator('summary')
  await summary.click();await training.getByRole('button',{name:'On-court view',exact:true}).click()
  await expect(coaching).toHaveAttribute('open','');await training.getByRole('button',{name:'Rounds',exact:true}).click()
  await expect(coaching).toHaveAttribute('open','');await expect(summary).toBeVisible()
  await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('0');await training.getByRole('spinbutton',{name:'Round 3',exact:true}).fill('8')
  await summary.focus()
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))})
  await expect(coaching).toHaveAttribute('open','');await summary.press('Escape');await training.getByRole('button',{name:'Keep training',exact:true}).click()
  await expect(summary).toBeFocused();await expect(coaching).toHaveAttribute('open','');expect(await writes(page)).toHaveLength(0)
  await training.getByRole('button',{name:'Finish & log',exact:true}).click()
  await expect(coaching).toHaveAttribute('open','');await expect(training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true})).toBeFocused()
  await training.getByRole('button',{name:'Save completed session',exact:true}).click()
  await expect(training.locator('.training-history-latest')).toContainText('R1 0/10; R3 8/10')
  const saved=JSON.parse((await writes(page))[0]).session
  expect(saved.rating).toBe(2);expect(saved.note).toContain('Recover first.');expect(saved.note).not.toContain('Quick coaching');expect(saved.note).not.toContain('R2')
 })
 test('resets session coaching for a fresh repeat',async({page})=>{
  const training=await openCoaching(page)
  await training.getByRole('button',{name:'Start training',exact:true}).click()
  await training.locator('[data-session-coaching]>summary').click()
  await training.getByRole('button',{name:'Close Level Up',exact:true}).click();await training.getByRole('button',{name:'Discard and close',exact:true}).click()
  await page.locator('[data-app-destination="training"]').click()
  await training.getByRole('searchbox',{name:'Find a drill',exact:true}).fill('Return Depth Lane')
  await training.getByRole('button',{name:'Preview Return Depth Lane',exact:true}).click();await training.getByRole('button',{name:'Start training',exact:true}).click()
  await expect(training.locator('[data-session-coaching]')).not.toHaveAttribute('open','');expect(await writes(page)).toHaveLength(0)
 })
 test('keeps expanded guidance and Finish reachable on a short phone with larger text',async({page},info)=>{
  await page.setViewportSize({width:320,height:568})
  const training=await openCoaching(page,'Middle Ball Rule','&large=1')
  await training.getByRole('button',{name:'Start training',exact:true}).click();await training.getByRole('button',{name:'On-court view',exact:true}).click()
  await training.getByRole('button',{name:'Rounds',exact:true}).click()
  const coaching=training.locator('[data-session-coaching]'),summary=coaching.locator('summary')
  await summary.scrollIntoViewIfNeeded();await summary.focus();await summary.press('Enter');await expect(coaching).toHaveAttribute('open','')
  const correction=coaching.locator('.training-coaching-correction');await correction.scrollIntoViewIfNeeded();await expect(correction).toBeVisible()
  const size=await training.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));expect(size.scroll).toBeLessThanOrEqual(size.client+1)
  await expect(training.getByRole('button',{name:'Finish & log',exact:true})).toBeInViewport({ratio:1})
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.screenshot({path:info.outputPath('drill-coaching-short-phone.png')})
  await training.getByRole('button',{name:'Finish & log',exact:true}).click();await expect(training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true})).toBeFocused()
  expect(await writes(page)).toHaveLength(0)
 })
})
