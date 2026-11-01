import {test,expect,type Page} from '@playwright/test'
const origin='http://127.0.0.1:4283'
type CalendarWindow=Window&{calendarFixture:{loseWrite:boolean;fail:boolean;defer:boolean;release:()=>void;requests:{method:string;body:{action:string}}[];personal:{id:string;title:string;updatedAt:string}[]};refreshNavigationSession:()=>void;switchNavigationOwner:()=>void}
async function calendarScreen(page:Page,width=390){
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1');await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="calendar"]').click();const dialog=page.getByRole('dialog',{name:'Your calendar',exact:true});await expect(dialog.locator('.cal-event')).toHaveCount(3);return dialog
}
for(const width of [320,390])test('Calendar: week, month and event forms stay contained at '+width+'px with larger text',async({page},info)=>{
 const d=await calendarScreen(page,width);expect(await d.locator('.cal-type>span').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);return r.getClientRects().length})).toBe(1);await expect(d).toContainText('Serve + first ball');await expect(d).toContainText('Lesson: Jordan Lee');await expect(d).toContainText('Riverside Rally')
 await d.getByRole('button',{name:'Month',exact:true}).click();await expect(d.locator('.cal-grid button')).toHaveCount(new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate())
 await d.getByRole('combobox',{name:'Show',exact:true}).selectOption('competition');await expect(d.locator('.cal-event')).toHaveCount(1)
 expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);{const overflow=await d.locator('.cal-body').evaluate(el=>({ok:el.scrollWidth<=el.clientWidth,width:el.clientWidth,scroll:el.scrollWidth,children:[...el.querySelectorAll<HTMLElement>('*')].filter(n=>n.scrollWidth>n.clientWidth&&n.clientWidth>0).map(n=>({tag:n.tagName,class:n.className,width:n.clientWidth,scroll:n.scrollWidth,text:n.textContent?.slice(0,80)})).slice(0,20)}));expect(overflow.ok,JSON.stringify(overflow)).toBe(true)}
 await page.screenshot({path:info.outputPath('calendar-month-'+width+'.png')})
 await d.getByRole('button',{name:'Add event',exact:false}).click();await d.getByRole('textbox',{name:'Title',exact:true}).fill('A purposeful practice session with a long readable title');await d.getByRole('combobox',{name:'Type',exact:true}).selectOption('availability');await expect(d.getByRole('combobox',{name:'Personal availability',exact:true})).toBeVisible()
 {const overflow=await d.locator('.cal-body').evaluate(el=>({ok:el.scrollWidth<=el.clientWidth,width:el.clientWidth,scroll:el.scrollWidth,children:[...el.querySelectorAll<HTMLElement>('*')].filter(n=>n.scrollWidth>n.clientWidth&&n.clientWidth>0).map(n=>({tag:n.tagName,class:n.className,width:n.clientWidth,scroll:n.scrollWidth,text:n.textContent?.slice(0,80)})).slice(0,20)}));expect(overflow.ok,JSON.stringify(overflow)).toBe(true)};await page.screenshot({path:info.outputPath('calendar-editor-'+width+'.png')})
 await d.getByRole('button',{name:'Close',exact:true}).click();await expect(d).toContainText('Leave this calendar change?');await d.getByRole('button',{name:'Keep reviewing',exact:true}).click();await expect(d.getByRole('textbox',{name:'Title',exact:true})).toHaveValue('A purposeful practice session with a long readable title')
})
test('Calendar: review, save, edit and delete personal plans without changing competition availability',async({page})=>{
 const d=await calendarScreen(page);await d.getByRole('button',{name:'Add event',exact:false}).click();await d.getByRole('textbox',{name:'Title',exact:true}).fill('Footwork first');await d.getByRole('button',{name:'Review event',exact:true}).click();await expect(d).toContainText('Review personal event')
 expect(await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.filter(r=>r.method==='POST').length)).toBe(0)
 await d.getByRole('button',{name:'Save personal event',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(4)
 await d.locator('.cal-event').filter({hasText:'Footwork first'}).click();await d.getByRole('textbox',{name:'Title',exact:true}).fill('Footwork + split step');await d.getByRole('button',{name:'Review event',exact:true}).click();await d.getByRole('button',{name:'Save changes',exact:true}).click();await expect(d).toContainText('Footwork + split step')
 await d.locator('.cal-event').filter({hasText:'Footwork + split step'}).click();await d.getByRole('button',{name:'Delete event',exact:true}).click();await expect(d).toContainText('Delete personal event?');await d.getByRole('button',{name:'Delete event',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(3)
 const writes=await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.filter(r=>r.method==='POST').map(r=>r.body.action));expect(writes).toEqual(['create','update','delete'])
})
test('Calendar: a lost save response recovers the same record without a second write',async({page})=>{
 const d=await calendarScreen(page);await d.getByRole('button',{name:'Add event',exact:false}).click();await d.getByRole('textbox',{name:'Title',exact:true}).fill('Confirmed recovery');await d.getByRole('button',{name:'Review event',exact:true}).click();await page.evaluate(()=>{(window as unknown as CalendarWindow).calendarFixture.loseWrite=true});await d.getByRole('button',{name:'Save personal event',exact:true}).click()
 await expect(d).toContainText('Check the saved result');await expect(d.getByRole('button',{name:'Save personal event',exact:true})).toHaveCount(0);await d.getByRole('button',{name:'Check saved entry',exact:true}).click();await expect(d.locator('.cal-event').filter({hasText:'Confirmed recovery'})).toHaveCount(1)
 expect(await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.filter(r=>r.method==='POST').length)).toBe(1)
})
test('Calendar: recurring deletion reviews the whole series and availability sends only after confirmation',async({page})=>{
 const d=await calendarScreen(page);await d.locator('.cal-event').filter({hasText:'Serve + first ball'}).click();await d.getByRole('button',{name:'Delete repeating series',exact:true}).click();await expect(d).toContainText('Every occurrence');await d.getByRole('button',{name:'Keep event',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(3)
 await d.locator('.cal-event.competition').click();await expect(d).toContainText('Northside Tennis Center · Court 3');await d.getByRole('combobox',{name:'Your reply',exact:true}).selectOption('unavailable');expect(await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.filter(r=>r.method==='POST').length)).toBe(0)
 await d.getByRole('button',{name:'Confirm availability reply',exact:true}).click();await expect(d.locator('.cal-event.competition')).toContainText('Can’t play')
})
test('Calendar: draft survives token refresh and resume, then disappears on account change',async({page})=>{
 const d=await calendarScreen(page);await d.getByRole('button',{name:'Add event',exact:false}).click();await d.getByRole('textbox',{name:'Title',exact:true}).fill('Keep this practice draft')
 await page.evaluate(()=>{(window as unknown as CalendarWindow).refreshNavigationSession();window.dispatchEvent(new Event('online'));Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))})
 await expect(d.getByRole('textbox',{name:'Title',exact:true})).toHaveValue('Keep this practice draft');await page.evaluate(()=>(window as unknown as CalendarWindow).switchNavigationOwner());await expect(page.getByRole('dialog')).toHaveCount(0)
 expect(await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.filter(r=>r.method==='POST').length)).toBe(0)
})
test('Calendar: source failure is retryable and stale responses cannot cross accounts',async({page})=>{
 const d=await calendarScreen(page);await page.evaluate(()=>{(window as unknown as CalendarWindow).calendarFixture.fail=true});await d.getByRole('button',{name:'Refresh',exact:true}).click();await expect(d).toContainText('couldn’t load');await expect(d.locator('.cal-event')).toHaveCount(0);await d.getByRole('button',{name:'Retry',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(3)
 await page.evaluate(()=>{(window as unknown as CalendarWindow).calendarFixture.defer=true});await d.getByRole('button',{name:'Refresh',exact:true}).click();await page.evaluate(()=>(window as unknown as CalendarWindow).switchNavigationOwner());await expect(d).toHaveCount(0);await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.release());await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('Calendar: export reviews the chosen filter and shares a bounded one-time ICS file',async({page})=>{
 const d=await calendarScreen(page);await d.getByRole('combobox',{name:'Show',exact:true}).selectOption('coach');await d.getByRole('button',{name:'Export',exact:true}).click();await expect(d).toContainText('1 date');await expect(d).toContainText('one-time calendar file');await d.getByRole('combobox',{name:'Times are in',exact:true}).selectOption('America/New_York')
 const download=page.waitForEvent('download');await d.getByRole('button',{name:'Share calendar file',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toMatch(/^TenAceIQ-.*\.ics$/);const stream=await file.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk);const ics=Buffer.concat(chunks).toString('utf8');expect(ics).toContain('Lesson: Jordan Lee');expect(ics).toContain('America/New_York');expect(ics).not.toContain('Serve + first ball');expect(ics).not.toContain('URL:')
})

test('Calendar: editing an entry removed elsewhere recovers as a reviewed new copy',async({page})=>{
 const d=await calendarScreen(page);await d.locator('.cal-event').filter({hasText:'Serve + first ball'}).click();await d.getByRole('textbox',{name:'Title',exact:true}).fill('A new serve session');await d.getByRole('button',{name:'Review event',exact:true}).click();const old=await page.evaluate(()=>{const f=(window as unknown as CalendarWindow).calendarFixture,id=f.personal[0].id;f.personal=[];return id});await d.getByRole('button',{name:'Save changes',exact:true}).click();await d.getByRole('button',{name:'Check saved entry',exact:true}).click();await expect(d).toContainText('Review a new personal copy.');await d.getByRole('button',{name:'Review event',exact:true}).click();await d.getByRole('button',{name:'Save personal event',exact:true}).click();await expect(d.locator('.cal-event').filter({hasText:'A new serve session'})).toHaveCount(1);expect(await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.personal[0].id)).not.toBe(old)
})

test('Calendar: saving outside the current window opens its date and clears a hiding filter',async({page})=>{
 const d=await calendarScreen(page);await d.getByRole('combobox',{name:'Show',exact:true}).selectOption('coach');await d.getByRole('button',{name:'Add event',exact:false}).click();await d.getByRole('textbox',{name:'Title',exact:true}).fill('Next season practice');await d.locator('input[name="date"]').fill('2030-05-20');await d.getByRole('button',{name:'Review event',exact:true}).click();await d.getByRole('button',{name:'Save personal event',exact:true}).click();await expect(d.locator('.cal-event').filter({hasText:'Next season practice'})).toHaveCount(1);await expect(d.locator('.cal-event').filter({hasText:'Next season practice'})).toContainText('Next season practice');await expect(d.getByRole('combobox',{name:'Show',exact:true})).toHaveValue('all');await expect(d.locator('.cal-period')).toContainText('2030');await d.locator('.cal-event').filter({hasText:'Next season practice'}).click();await d.locator('input[name="date"]').fill('2031-06-10');await d.getByRole('button',{name:'Review event',exact:true}).click();await expect(d).toContainText('2031');await page.evaluate(()=>{(window as unknown as CalendarWindow).calendarFixture.loseWrite=true});await d.getByRole('button',{name:'Save changes',exact:true}).click();await d.getByRole('button',{name:'Check saved entry',exact:true}).click();await expect(d.locator('.cal-event').filter({hasText:'Next season practice'})).toHaveCount(1);await expect(d.locator('.cal-period')).toContainText('2031')
})

for(const width of [320,390])test('Calendar finder: local search keeps the input, literal text and narrow layout at '+width+'px',async({page},info)=>{
 const d=await calendarScreen(page,width),input=d.getByRole('searchbox',{name:'Find a date',exact:true}),node=await input.elementHandle(),before=await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.length)
 await input.fill('  RIVERSIDE  ');await expect(d.locator('.cal-event')).toHaveCount(1);await expect(d.locator('[data-cal-count]')).toHaveText('1 matching date')
 expect(await node!.evaluate(el=>el===document.querySelector('[data-cal-query]'))).toBe(true);await expect(input).toBeFocused();expect(await input.evaluate(el=>(el as HTMLInputElement).selectionStart)).toBe(13)
 await d.getByRole('button',{name:'Clear calendar search',exact:true}).click();await expect(input).toHaveValue('');await expect(input).toBeFocused();await expect(d.locator('.cal-event')).toHaveCount(3)
 await input.fill('No matching opponent');await expect(d).toContainText('No matching dates loaded.');await expect(d.getByRole('button',{name:'Export',exact:true})).toBeDisabled()
 await input.fill('x'.repeat(200));await expect(input).toHaveValue('x'.repeat(160))
 await input.press('Escape');await expect(d).toBeVisible();await expect(input).toHaveValue('');await expect(d.locator('.cal-event')).toHaveCount(3)
 await input.fill('.*');await expect(d.locator('.cal-event')).toHaveCount(0);await input.fill('Riverside');await d.getByRole('button',{name:'Month',exact:true}).click();await d.getByRole('combobox',{name:'Show',exact:true}).selectOption('competition');await expect(d.locator('.cal-event')).toHaveCount(1)
 expect(await d.locator('.cal-body').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 await input.scrollIntoViewIfNeeded();const bounds=await d.evaluate(el=>{const header=el.querySelector('.cal-heading')!.getBoundingClientRect(),footer=el.querySelector('.cal-actions')!.getBoundingClientRect();return {scroll:el.scrollTop,header:header.top,footer:footer.bottom,viewport:innerHeight}});expect(bounds.header,JSON.stringify(bounds)).toBeGreaterThanOrEqual(0);expect(bounds.footer,JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.viewport);await page.screenshot({path:info.outputPath('calendar-search-'+width+'.png')})
 expect(await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.length)).toBe(before+1)
})

test('Calendar finder: event return, type and day filters, refresh and session renewal retain the search',async({page})=>{
 const d=await calendarScreen(page),input=d.getByRole('searchbox',{name:'Find a date',exact:true});await input.fill('Northside');await expect(d.locator('.cal-event')).toHaveCount(2)
 await d.getByRole('combobox',{name:'Show',exact:true}).selectOption('competition');await d.locator('.cal-event').click();await d.getByRole('button',{name:'Back to calendar',exact:true}).click()
 await expect(input).toHaveValue('Northside');await expect(d.getByRole('combobox',{name:'Show',exact:true})).toHaveValue('competition');await expect(d.locator('.cal-event')).toBeFocused()
 const before=await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.length)
 await page.evaluate(()=>{(window as unknown as CalendarWindow).refreshNavigationSession();window.dispatchEvent(new Event('online'))});await expect(input).toHaveValue('Northside')
 await d.locator('[data-cal-day][aria-current="date"]').click();await expect(input).toHaveValue('Northside');await expect(d.locator('.cal-event')).toHaveCount(1)
 expect(await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.length)).toBe(before)
 await d.getByRole('button',{name:'Refresh',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(1);await expect(input).toHaveValue('Northside')
 await d.getByRole('button',{name:'Month',exact:true}).click();await expect(input).toHaveValue('Northside');await d.getByRole('button',{name:'Next month',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(0);await expect(input).toHaveValue('Northside');await expect(d.getByRole('combobox',{name:'Show',exact:true})).toHaveValue('competition')
})

test('Calendar finder: export reviews the query and includes only matching loaded dates',async({page})=>{
 const d=await calendarScreen(page);await d.getByRole('searchbox',{name:'Find a date',exact:true}).fill('Jordan');const before=await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.length)
 const detached=await d.getByRole('searchbox',{name:'Find a date',exact:true}).elementHandle();await d.getByRole('button',{name:'Export',exact:true}).click();await detached!.evaluate(el=>{(el as HTMLInputElement).value='Riverside';el.dispatchEvent(new Event('input',{bubbles:true}))});await expect(d).toContainText('Search: Jordan');await expect(d).toContainText('1 date')
 const download=page.waitForEvent('download');await d.getByRole('button',{name:'Share calendar file',exact:true}).click();const file=await download,stream=await file.createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(chunk);const ics=Buffer.concat(chunks).toString('utf8')
 expect(ics).toContain('Lesson: Jordan Lee');expect(ics).not.toContain('Serve + first ball');expect(ics).not.toContain('Riverside Rally');expect(ics).not.toContain('URL:')
 await d.getByRole('button',{name:'Back to calendar',exact:true}).click();await expect(d.getByRole('searchbox',{name:'Find a date',exact:true})).toHaveValue('Jordan');await expect(d.locator('.cal-event')).toHaveCount(1);await expect(d.getByRole('button',{name:'Export',exact:true})).toBeFocused()
 expect(await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.length)).toBe(before)
})

test('Calendar finder: a failed or held refresh clears stale dates and keeps unknown counts distinct from no matches',async({page})=>{
 const d=await calendarScreen(page),input=d.getByRole('searchbox',{name:'Find a date',exact:true});await input.fill('Riverside');await page.evaluate(()=>{(window as unknown as CalendarWindow).calendarFixture.fail=true});await d.getByRole('button',{name:'Refresh',exact:true}).click()
 await expect(d.locator('[data-cal-count]')).toHaveText('Unavailable');await expect(d.locator('.cal-event')).toHaveCount(0);await expect(input).toHaveValue('Riverside');await d.getByRole('button',{name:'Retry',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(1)
 await page.evaluate(()=>{(window as unknown as CalendarWindow).calendarFixture.defer=true});await d.getByRole('button',{name:'Refresh',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(0);await expect(input).toBeDisabled()
 await page.evaluate(()=>(window as unknown as CalendarWindow).switchNavigationOwner());await expect(d).toHaveCount(0);await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.release());await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Calendar finder: search sees dates beyond the first page and Show more restores keyboard focus',async({page})=>{
 const d=await calendarScreen(page)
 await page.evaluate(()=>{const f=(window as unknown as CalendarWindow).calendarFixture,base=f.personal[0];f.personal=Array.from({length:121},(_,i)=>({...base,id:'calendar-'+i,title:i===120?'Serve target beyond first page':'Practice '+String(i).padStart(3,'0')}))})
 await d.getByRole('button',{name:'Refresh',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(100)
 const before=await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.length),input=d.getByRole('searchbox',{name:'Find a date',exact:true})
 await input.fill('Serve target');await expect(d.locator('.cal-event')).toHaveCount(1);await expect(d.locator('.cal-event')).toContainText('Serve target beyond first page')
 await d.getByRole('button',{name:'Clear calendar search',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(100);await d.getByRole('button',{name:'Show more dates',exact:true}).click();await expect(d.locator('.cal-event')).toHaveCount(123);await expect(d.locator('.cal-event').nth(100)).toBeFocused()
 expect(await page.evaluate(()=>(window as unknown as CalendarWindow).calendarFixture.requests.length)).toBe(before)
 await d.getByRole('searchbox',{name:'Find a date',exact:true}).fill('Serve target');await d.getByRole('button',{name:'Close',exact:true}).click();await page.locator('[data-app-destination="calendar"]').click();await expect(page.getByRole('searchbox',{name:'Find a date',exact:true})).toHaveValue('')
})

test('Calendar finder: confirmed saves and recovered edits reveal the personal event by clearing a hiding query',async({page})=>{
 const d=await calendarScreen(page);await d.getByRole('searchbox',{name:'Find a date',exact:true}).fill('Jordan');await d.getByRole('button',{name:'Add event',exact:false}).click();await d.getByRole('textbox',{name:'Title',exact:true}).fill('Fresh footwork practice');await d.getByRole('button',{name:'Review event',exact:true}).click();await d.getByRole('button',{name:'Save personal event',exact:true}).click()
 await expect(d.getByRole('searchbox',{name:'Find a date',exact:true})).toHaveValue('');await expect(d.locator('.cal-event').filter({hasText:'Fresh footwork practice'})).toHaveCount(1)
 await d.getByRole('searchbox',{name:'Find a date',exact:true}).fill('Fresh footwork');await d.locator('.cal-event').click();await d.getByRole('textbox',{name:'Title',exact:true}).fill('Split step practice');await d.getByRole('button',{name:'Review event',exact:true}).click();await page.evaluate(()=>{(window as unknown as CalendarWindow).calendarFixture.loseWrite=true});await d.getByRole('button',{name:'Save changes',exact:true}).click();await d.getByRole('button',{name:'Check saved entry',exact:true}).click()
 await expect(d.getByRole('searchbox',{name:'Find a date',exact:true})).toHaveValue('');await expect(d.locator('.cal-event').filter({hasText:'Split step practice'})).toHaveCount(1)
})
