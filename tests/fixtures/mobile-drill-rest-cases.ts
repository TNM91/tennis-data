import {test,expect,type Page} from '@playwright/test'

type RestCapture={writes:string[];failFirst:boolean;stale:HTMLElement[];announcements:string[]}
type RestWindow=Window&{restCapture:RestCapture;switchNavigationOwner:()=>void}
async function openRest(page:Page,query='',title='Return Depth Lane'){
 await page.clock.install({time:new Date('2026-11-23T04:00:00Z')})
 await page.goto('http://127.0.0.1:4283/?training-inbox-review=1'+query)
 // Keep locator actions from adding real elapsed time to exact countdown checks.
 await page.clock.pauseAt(new Date('2026-11-23T04:01:00Z'))
 await page.evaluate(()=>{
  const state:RestCapture={writes:[],failFirst:false,stale:[],announcements:[]},original=window.fetch.bind(window)
  ;(window as unknown as RestWindow).restCapture=state
  window.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
   if(url.pathname==='/api/player/level-up-sessions'&&init?.method==='POST'){
    state.writes.push(String(init.body));if(state.failFirst&&state.writes.length===1)return Response.json({ok:false},{status:503})
   }
   return original(input,init)
  }
 })
 await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click();await page.locator('[data-app-destination="training"]').click()
 const training=page.getByRole('dialog',{name:'Level Up training',exact:true})
 await training.getByRole('searchbox',{name:'Find a drill',exact:true}).fill(title);await training.getByRole('button',{name:'Preview '+title,exact:true}).click()
 await training.getByRole('button',{name:'Start training',exact:true}).click();await training.getByRole('button',{name:'On-court view',exact:true}).click();await training.getByRole('button',{name:'Rest',exact:true}).click()
 return training
}
const writes=(page:Page)=>page.evaluate(()=>(window as unknown as RestWindow).restCapture.writes)
async function background(page:Page){await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))})}

test.describe('On-court rest countdown',()=>{
 test('starts only on request, pauses precisely and finishes without filling rounds',async({page})=>{
  const training=await openRest(page),remaining=training.getByRole('timer',{name:'Rest remaining',exact:true}),duration=training.getByRole('combobox',{name:'Rest duration',exact:true})
  await expect(remaining).toHaveText('01:00');await page.clock.fastForward(10000);await expect(remaining).toHaveText('01:00')
  await duration.selectOption('45');await training.getByRole('button',{name:'Start rest',exact:true}).click();await expect(duration).toBeDisabled()
  await page.clock.fastForward(12500);await expect(remaining).toHaveText('00:33');await training.getByRole('button',{name:'Pause rest',exact:true}).click()
  await page.clock.fastForward(90000);await expect(remaining).toHaveText('00:33');await expect(training.locator('[data-rest-state]')).toHaveText('Paused')
  await training.getByRole('button',{name:'Resume rest',exact:true}).click();await page.clock.fastForward(33000)
  await expect(remaining).toHaveText('00:00');await expect(training.locator('[data-rest-state]')).toHaveText('Rest finished');await expect(duration).toBeEnabled();expect(await writes(page)).toHaveLength(0)
  await page.clock.fastForward(90000);await expect(remaining).toHaveText('00:00');await training.getByRole('button',{name:'Start rest again',exact:true}).click();await expect(remaining).toHaveText('00:45')
  await training.getByRole('button',{name:'Rounds',exact:true}).click();await expect(training.locator('[data-drill-tally]')).toHaveText('No round results entered.');expect(await writes(page)).toHaveLength(0)
 })
 test('pauses on background even with the session timer paused and retains its chosen duration across views',async({page})=>{
  const training=await openRest(page),remaining=training.getByRole('timer',{name:'Rest remaining',exact:true})
  await training.getByRole('combobox',{name:'Rest duration',exact:true}).selectOption('90');await training.getByRole('button',{name:'Pause timer',exact:true}).click()
  await training.getByRole('button',{name:'Start rest',exact:true}).click();await page.clock.fastForward(10000);await expect(remaining).toHaveText('01:20')
  await background(page);await page.clock.fastForward(90000);await expect(remaining).toHaveText('01:20');await expect(training.locator('[data-rest-state]')).toHaveText('Paused')
  await training.getByRole('button',{name:'Resume rest',exact:true}).click();await page.clock.fastForward(5000)
  await training.getByRole('button',{name:'Steps',exact:true}).click();await page.clock.fastForward(10000);await training.getByRole('button',{name:'Rest',exact:true}).click();await expect(remaining).toHaveText('01:05')
  await training.getByRole('button',{name:'Full log',exact:true}).click();await page.clock.fastForward(90000)
  await training.getByRole('button',{name:'On-court view',exact:true}).click();await expect(remaining).toHaveText('01:05');await expect(training.locator('[data-rest-state]')).toHaveText('Paused');expect(await writes(page)).toHaveLength(0)
 })
 test('continues while logging rounds and reading steps, then pauses through Close and Keep',async({page})=>{
  const training=await openRest(page)
  await training.getByRole('button',{name:'Start rest',exact:true}).click();await training.getByRole('button',{name:'Rounds',exact:true}).click()
  await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('0');await training.getByRole('spinbutton',{name:'Round 3',exact:true}).fill('8');await page.clock.fastForward(15000)
  await expect(training.locator('[data-rest-indicator]')).toHaveAttribute('data-rest-phase','running');await expect(training.getByRole('button',{name:'Rest',exact:true})).toHaveAccessibleDescription('Rest countdown running.')
  await training.getByRole('button',{name:'Steps',exact:true}).click();const next=training.getByRole('button',{name:'Next instruction',exact:true});await next.click();await page.clock.fastForward(10000)
  await expect(next).toBeFocused();await expect(training.locator('[data-court-position]')).toHaveText('Instruction 2 of 4')
  await next.press('Escape');await training.getByRole('button',{name:'Keep training',exact:true}).click();await expect(next).toBeFocused();await expect(training.locator('[data-rest-indicator]')).toHaveAttribute('data-rest-phase','paused')
  await page.clock.fastForward(90000);await training.getByRole('button',{name:'Rest',exact:true}).click();await expect(training.getByRole('timer',{name:'Rest remaining',exact:true})).toHaveText('00:35')
  await training.getByRole('button',{name:'Resume rest',exact:true}).click();await training.getByRole('button',{name:'Rounds',exact:true}).click();const third=training.getByRole('spinbutton',{name:'Round 3',exact:true});await third.focus();await page.clock.fastForward(5000)
  await expect(third).toBeFocused();await expect(third).toHaveValue('8');await expect(training.getByRole('spinbutton',{name:'Round 1',exact:true})).toHaveValue('0');await expect(training.getByRole('spinbutton',{name:'Round 2',exact:true})).toHaveValue('');expect(await writes(page)).toHaveLength(0)
 })
 test('announces one completion while another pane is open without moving focus or creating results',async({page})=>{
  const training=await openRest(page)
  await training.getByRole('button',{name:'Start rest',exact:true}).click();await training.getByRole('button',{name:'Rounds',exact:true}).click();const third=training.getByRole('spinbutton',{name:'Round 3',exact:true});await third.fill('8')
  await training.locator('[data-rest-live-state]').evaluate(el=>{new MutationObserver(()=>{(window as unknown as RestWindow).restCapture.announcements.push(el.textContent||'')}).observe(el,{subtree:true,childList:true,characterData:true})})
  await page.clock.fastForward(65000);await expect(training.locator('[data-rest-live-state]')).toHaveText('Rest finished.');await expect(training.locator('[data-rest-indicator]')).toHaveAttribute('data-rest-phase','complete')
  await expect(third).toBeFocused();await expect(third).toHaveValue('8');await expect(training.getByRole('button',{name:'Rounds',exact:true})).toHaveAttribute('aria-pressed','true');await expect(training.getByRole('button',{name:'Rest',exact:true})).toHaveAccessibleDescription('Rest finished.')
  await page.clock.fastForward(90000);expect(await page.evaluate(()=>(window as unknown as RestWindow).restCapture.announcements)).toEqual(['Rest finished.'])
  await expect(training.getByRole('spinbutton',{name:'Round 1',exact:true})).toHaveValue('');await expect(training.getByRole('spinbutton',{name:'Round 2',exact:true})).toHaveValue('');expect(await writes(page)).toHaveLength(0)
  await training.getByRole('button',{name:'Rest',exact:true}).click();await expect(training.getByRole('timer',{name:'Rest remaining',exact:true})).toHaveText('00:00');await expect(training.getByRole('button',{name:'Start rest again',exact:true})).toBeEnabled()
 })
 test('keeps focus through Close and saves only the player round evidence before a fresh repeat',async({page})=>{
  const training=await openRest(page)
  await training.getByRole('button',{name:'Rounds',exact:true}).click();await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('0');await training.getByRole('spinbutton',{name:'Round 3',exact:true}).fill('8')
  await training.getByRole('button',{name:'Rest',exact:true}).click();await training.getByRole('combobox',{name:'Rest duration',exact:true}).selectOption('45');await training.getByRole('button',{name:'Start rest',exact:true}).click();await page.clock.fastForward(10000)
  await training.getByRole('button',{name:'Pause rest',exact:true}).press('Escape');await training.getByRole('button',{name:'Keep training',exact:true}).click()
  await expect(training.getByRole('button',{name:'Resume rest',exact:true})).toBeFocused();await expect(training.getByRole('timer',{name:'Rest remaining',exact:true})).toHaveText('00:35')
  await training.getByRole('button',{name:'Reset rest',exact:true}).click();await expect(training.getByRole('button',{name:'Start rest',exact:true})).toBeFocused();await expect(training.getByRole('timer',{name:'Rest remaining',exact:true})).toHaveText('00:45')
  await training.getByRole('button',{name:'Finish & log',exact:true}).click();await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('2');await training.getByRole('textbox',{name:'Your training note',exact:true}).fill('Clear the net with margin.')
  await training.getByRole('button',{name:'Save completed session',exact:true}).click();await expect(training.locator('.training-history-latest')).toContainText('R1 0/10; R3 8/10')
  const session=JSON.parse((await writes(page))[0]).session;expect(session).toMatchObject({rating:2,context:'partner',sharedWithCoach:false});expect(session.note).toContain('Clear the net with margin.');expect(JSON.stringify(session)).not.toMatch(/restDuration|remainingMs|Rest finished|Between rounds/)
  await training.getByRole('button',{name:'Practice this drill again',exact:true}).click();await training.getByRole('button',{name:'Start training',exact:true}).click();await expect(training.getByRole('spinbutton',{name:'Round 1',exact:true})).toHaveValue('')
  await training.getByRole('button',{name:'On-court view',exact:true}).click();await training.getByRole('button',{name:'Rest',exact:true}).click();await expect(training.getByRole('timer',{name:'Rest remaining',exact:true})).toHaveText('01:00');await expect(training.locator('[data-rest-state]')).toHaveText('Ready when you are')
 })
 test('opens the first blank round after rest without filling it or changing an entered zero',async({page})=>{
  const training=await openRest(page)
  await training.getByRole('button',{name:'Rounds',exact:true}).click();await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('0');await training.getByRole('spinbutton',{name:'Round 3',exact:true}).fill('8')
  await training.getByRole('button',{name:'Rest',exact:true}).click();await training.getByRole('button',{name:'Start rest',exact:true}).click();await page.clock.fastForward(65000)
  const open=training.getByRole('button',{name:'Open round 2',exact:true})
  await open.evaluate(el=>{new MutationObserver(()=>{(window as unknown as RestWindow).restCapture.announcements.push(el.textContent||'')}).observe(el,{subtree:true,childList:true,characterData:true})})
  await page.clock.fastForward(5000);expect(await page.evaluate(()=>(window as unknown as RestWindow).restCapture.announcements)).toEqual([])
  await open.click();const second=training.getByRole('spinbutton',{name:'Round 2',exact:true})
  await expect(second).toBeFocused();await expect(second).toHaveValue('');await expect(second).toBeInViewport({ratio:1});await expect(training.getByRole('spinbutton',{name:'Round 1',exact:true})).toHaveValue('0');await expect(training.getByRole('spinbutton',{name:'Round 3',exact:true})).toHaveValue('8')
  await expect(training.locator('[data-rest-indicator]')).toHaveAttribute('data-rest-phase','complete');expect(await writes(page)).toHaveLength(0)
 })
 test('prioritizes a correction, refreshes the next blank and reviews fully entered rounds',async({page})=>{
  const training=await openRest(page)
  await training.getByRole('button',{name:'Rounds',exact:true}).click();await training.getByRole('spinbutton',{name:'Round 3',exact:true}).fill('11');await training.getByRole('button',{name:'Rest',exact:true}).click()
  await training.getByRole('button',{name:'Start rest',exact:true}).click();await page.clock.fastForward(65000);await training.getByRole('button',{name:'Review round 3',exact:true}).click()
  const third=training.getByRole('spinbutton',{name:'Round 3',exact:true});await expect(third).toBeFocused();await expect(third).toHaveValue('11');await third.fill('8')
  await training.getByRole('button',{name:'Rest',exact:true}).click();await training.getByRole('button',{name:'Open round 1',exact:true}).click();await expect(training.getByRole('spinbutton',{name:'Round 1',exact:true})).toBeFocused()
  await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('0');await training.getByRole('spinbutton',{name:'Round 2',exact:true}).fill('0');await training.getByRole('button',{name:'Rest',exact:true}).click();await training.getByRole('button',{name:'Review rounds',exact:true}).click()
  await expect(training.getByRole('spinbutton',{name:'Round 1',exact:true})).toBeFocused();await expect(training.getByRole('spinbutton',{name:'Round 2',exact:true})).toHaveValue('0');await expect(third).toHaveValue('8');expect(await writes(page)).toHaveLength(0)
 })
 test('keeps early and detached handoffs inert and respects a two-round drill',async({page})=>{
  const training=await openRest(page,'','Middle Ball Rule'),shortcut=training.locator('[data-rest-round]')
  await expect(shortcut).toBeHidden();await shortcut.evaluate(el=>el.dispatchEvent(new Event('click',{bubbles:true})));await expect(training.getByRole('button',{name:'Rest',exact:true})).toHaveAttribute('aria-pressed','true')
  await training.getByRole('button',{name:'Start rest',exact:true}).click();await training.getByRole('button',{name:'Rounds',exact:true}).click();await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('0');await training.getByRole('button',{name:'Rest',exact:true}).click();await page.clock.fastForward(65000)
  await shortcut.evaluate(el=>{(window as unknown as RestWindow).restCapture.stale=[el as HTMLElement]});await training.getByRole('button',{name:'Open round 2',exact:true}).click();await expect(training.getByRole('spinbutton',{name:'Round 2',exact:true})).toBeFocused();await expect(training.getByRole('spinbutton',{name:'Round 3',exact:true})).toHaveCount(0)
  const first=training.getByRole('spinbutton',{name:'Round 1',exact:true});await first.focus();await page.evaluate(()=>{for(const el of (window as unknown as RestWindow).restCapture.stale)el.dispatchEvent(new Event('click',{bubbles:true}))})
  await expect(first).toBeFocused();await expect(first).toHaveValue('0');await expect(training.getByRole('spinbutton',{name:'Round 2',exact:true})).toHaveValue('');expect(await writes(page)).toHaveLength(0)
 })
 test('keeps detached countdown controls inert through an unconfirmed private save',async({page})=>{
  const training=await openRest(page);await training.getByRole('button',{name:'Start rest',exact:true}).click();await page.evaluate(()=>{const state=(window as unknown as RestWindow).restCapture;state.failFirst=true;state.stale=Array.from(document.querySelectorAll<HTMLElement>('[data-rest-action],[data-rest-duration],[data-rest-round]'))})
  await training.getByRole('button',{name:'Rounds',exact:true}).click();await training.getByRole('spinbutton',{name:'Round 1',exact:true}).fill('8');await training.getByRole('button',{name:'Finish & log',exact:true}).click();await training.getByRole('combobox',{name:'Self-rated proof (0–5)',exact:true}).selectOption('3')
  await training.getByRole('button',{name:'Save completed session',exact:true}).click();await expect(training.locator('[data-notice]')).toContainText('Check whether this session saved')
  await page.evaluate(()=>{for(const el of (window as unknown as RestWindow).restCapture.stale){el.dispatchEvent(new Event('click',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}});await page.clock.fastForward(120000)
  expect(await writes(page)).toHaveLength(1);await expect(training.getByRole('button',{name:'On-court view',exact:true})).toBeDisabled()
  await training.getByRole('button',{name:'Check whether this session saved',exact:true}).click();await training.getByRole('button',{name:'Retry same session',exact:true}).click();await expect(training.locator('.training-history-latest')).toContainText('R1 8/10')
  const saved=await writes(page);expect(saved).toHaveLength(2);expect(saved[1]).toBe(saved[0])
 })
 test('disposes the countdown and its controls when the account changes',async({page})=>{
  const training=await openRest(page);await training.getByRole('button',{name:'Start rest',exact:true}).click();await training.getByRole('button',{name:'Rounds',exact:true}).click();await page.evaluate(()=>{(window as unknown as RestWindow).restCapture.stale=Array.from(document.querySelectorAll<HTMLElement>('[data-rest-action],[data-court-pane]'));(window as unknown as RestWindow).switchNavigationOwner()})
  await page.clock.fastForward(120000);await expect(training).toHaveCount(0);await page.evaluate(()=>{for(const el of (window as unknown as RestWindow).restCapture.stale)el.dispatchEvent(new Event('click',{bubbles:true}))})
  await expect(page.getByRole('timer',{name:'Rest remaining',exact:true})).toHaveCount(0);expect(await writes(page)).toHaveLength(0)
 })
 for(const width of [320,390])test('keeps equal rest tabs and countdown controls reachable at '+width+'px',async({page},info)=>{
  await page.setViewportSize({width,height:width===320?568:844});const training=await openRest(page,width===320?'&large=1':'')
  if(width===320)await training.evaluate(el=>{(el as HTMLElement).style.setProperty('--training-top-clearance','60px');(el as HTMLElement).style.setProperty('--training-bottom-clearance','36px');const title=el.querySelector<HTMLElement>('h1')!;title.style.fontSize='28px';title.replaceChildren(document.createTextNode('On-court'),document.createElement('br'),document.createTextNode('practice'))})
  expect(await training.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);expect(await training.locator('[data-court-body]').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  const tabs=await training.locator('[data-court-pane]').evaluateAll(nodes=>nodes.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,overflow:el.scrollWidth>el.clientWidth})))
  expect(tabs).toHaveLength(3);for(const tab of tabs){expect(tab.height).toBeGreaterThanOrEqual(44);expect(tab.overflow).toBe(false);expect(Math.abs(tab.width-tabs[0].width)).toBeLessThanOrEqual(1)}
  await expect(training.getByRole('button',{name:'Finish & log',exact:true})).toBeInViewport({ratio:1})
  await expect(training.getByRole('timer',{name:'Rest remaining',exact:true})).toBeInViewport({ratio:1})
  expect(await training.getByRole('combobox',{name:'Rest duration',exact:true}).evaluate(el=>getComputedStyle(el).appearance)).toBe('none')
  await page.screenshot({path:info.outputPath('on-court-rest-'+width+'.png')})
  for(const control of [training.getByRole('combobox',{name:'Rest duration',exact:true}),training.getByRole('button',{name:'Start rest',exact:true})]){await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport({ratio:1});expect(await control.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===el})).toBe(true);expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)}
  await training.getByRole('button',{name:'Start rest',exact:true}).click();await expect(training.getByRole('button',{name:'Pause rest',exact:true})).toBeFocused();await training.getByRole('button',{name:'Reset rest',exact:true}).click();await expect(training.getByRole('button',{name:'Start rest',exact:true})).toBeFocused();expect(await writes(page)).toHaveLength(0)
  await training.getByRole('button',{name:'Start rest',exact:true}).click();await training.getByRole('button',{name:'Rounds',exact:true}).click();const third=training.getByRole('spinbutton',{name:'Round 3',exact:true});await third.fill('8');await third.scrollIntoViewIfNeeded();await page.clock.fastForward(5000)
  const indicator=training.locator('[data-rest-indicator]');await expect(indicator).toHaveAttribute('data-rest-phase','running');await expect(indicator).toBeInViewport({ratio:1});await expect(indicator.locator('circle')).toBeVisible()
  expect(await training.getByRole('button',{name:'Rest',exact:true}).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await expect(third).toBeFocused();await expect(third).toBeInViewport({ratio:1})
  await page.screenshot({path:info.outputPath('on-court-rest-continuity-'+width+'.png')})
  await page.clock.fastForward(60000);await expect(indicator).toHaveAttribute('data-rest-phase','complete');await expect(indicator.locator('path')).toBeVisible();await expect(third).toBeFocused();await expect(third).toHaveValue('8');expect(await writes(page)).toHaveLength(0)
  await training.getByRole('button',{name:'Rest',exact:true}).click()
  if(width===320)await training.evaluate(el=>{const title=el.querySelector<HTMLElement>('h1')!;title.style.fontSize='28px';title.replaceChildren(document.createTextNode('On-court'),document.createElement('br'),document.createTextNode('practice'))})
  const handoff=training.getByRole('button',{name:'Open round 1',exact:true});await expect(handoff).toBeInViewport({ratio:1})
  expect((await handoff.boundingBox())!.height).toBeGreaterThanOrEqual(44);expect(await handoff.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===el})).toBe(true)
  await page.screenshot({path:info.outputPath('on-court-rest-handoff-'+width+'.png')});await handoff.click();const first=training.getByRole('spinbutton',{name:'Round 1',exact:true});await expect(first).toBeFocused();await expect(first).toBeInViewport({ratio:1});await expect(first).toHaveValue('');await expect(third).toHaveValue('8');expect(await writes(page)).toHaveLength(0)
 })
})
