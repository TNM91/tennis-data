import {test,expect,type Page} from '@playwright/test'
const origin='http://127.0.0.1:4283'
type Fixture=Window&{updatesFixture:{failList:boolean;loseWrite:boolean;deferList:boolean;release:()=>void;queries:{method:string;ids:string[]}[];rows:{id:string;title:string;body:string;created_at:string;read_at:string|null}[]};refreshNavigationSession:()=>void;switchNavigationOwner:()=>void}
async function open(page:Page,width=390){
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1');await expect(page.locator('.native-updates-entry')).toHaveAttribute('aria-label','Updates, 23 unread');await page.locator('.native-updates-entry').click()
 const dialog=page.getByRole('dialog',{name:'Updates',exact:true});await expect(dialog.locator('.updates-item')).toHaveCount(25);return dialog
}
const calls=(page:Page)=>page.evaluate(()=>(window as unknown as Fixture).updatesFixture.queries.length)
for(const width of [320,390])test('Updates finder: local literal search retains its input and fits at '+width+'px',async({page},info)=>{
 const dialog=await open(page,width),input=dialog.getByRole('searchbox',{name:'Find an update',exact:true}),count=dialog.locator('[data-updates-matches]'),original=await input.elementHandle(),before=await calls(page)
 await expect(input).toHaveAttribute('maxlength','160');await input.fill('  LEAGUE  ');await expect(dialog.locator('.updates-item')).toHaveCount(1);await expect(count).toHaveText('1 of 25 loaded updates')
 await expect(dialog).toContainText('23 unread updates');await expect(dialog.locator('.updates-summary')).toBeVisible()
 await input.fill('.*');await expect(dialog.locator('.updates-item')).toHaveCount(0);await expect(dialog).toContainText('No matching updates loaded.');await expect(dialog.getByRole('button',{name:'Load older updates',exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:'Mark shown read',exact:true})).toBeHidden()
 await input.fill('<img');await expect(dialog.locator('.updates-item')).toHaveCount(1);await expect(dialog.locator('img[src=x]')).toHaveCount(0)
 await input.fill('review your next');await expect(dialog.locator('.updates-item')).toHaveCount(24);expect(await calls(page)).toBe(before)
 expect(await original!.evaluate(el=>el===document.querySelector('[data-updates-query]'))).toBe(true)
 await input.press('Escape');await expect(input).toHaveValue('');await expect(input).toBeFocused();await expect(dialog).toBeVisible();await expect(count).toHaveText('25 loaded updates')
 await input.fill('league');await dialog.getByRole('button',{name:'Clear',exact:true}).click();await expect(input).toBeFocused();await expect(input).toHaveValue('')
 await input.fill('season');expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(await dialog.getByRole('button',{name:'Unread',exact:true}).evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length})).toBe(1)
 await page.screenshot({path:info.outputPath('updates-finder-'+width+'.png')})
})
test('Updates finder: bulk review freezes only matching unread IDs',async({page})=>{
 const dialog=await open(page),input=dialog.getByRole('searchbox',{name:'Find an update',exact:true});await input.fill('league');await dialog.getByRole('button',{name:'Mark shown read',exact:true}).click()
 await expect(dialog).toContainText('Mark 1 update read?');await expect(dialog.locator('.updates-review li')).toHaveText(['Your league season is ready']);await expect(input).toBeDisabled()
 await input.evaluate(el=>{(el as HTMLInputElement).value='Tennis';el.dispatchEvent(new Event('input',{bubbles:true}))})
 await dialog.getByRole('button',{name:'Mark 1 read',exact:true}).click();await expect(dialog).toContainText('Update marked read.');await expect(input).toHaveValue('league');await expect(input).toBeEnabled()
 const patches=await page.evaluate(()=>(window as unknown as Fixture).updatesFixture.queries.filter(q=>q.method==='PATCH'));expect(patches).toHaveLength(1);expect(patches[0].ids).toEqual(['aaaa0000-0000-4000-8000-000000000002'])
 expect(await page.evaluate(()=>(window as unknown as Fixture).updatesFixture.rows.filter(r=>!r.read_at).length)).toBe(22);await expect(page.locator('.native-updates-entry')).toHaveAttribute('aria-label','Updates, 22 unread')
})
test('Updates finder: cancel and Escape keep the reviewed matching items unread',async({page})=>{
 const dialog=await open(page),input=dialog.getByRole('searchbox',{name:'Find an update',exact:true}),review=dialog.getByRole('button',{name:'Mark shown read',exact:true});await input.fill('league');await review.click();await dialog.getByRole('button',{name:'Keep unread',exact:true}).click();await expect(review).toBeFocused();await expect(input).toHaveValue('league')
 await review.click();await page.keyboard.press('Escape');await expect(dialog.locator('.updates-review')).toHaveCount(0);await expect(review).toBeFocused();expect(await page.evaluate(()=>(window as unknown as Fixture).updatesFixture.queries.filter(q=>q.method==='PATCH').length)).toBe(0)
})
test('Updates finder: older matching results preserve query, input and pagination scope',async({page})=>{
 const dialog=await open(page),input=dialog.getByRole('searchbox',{name:'Find an update',exact:true}),original=await input.elementHandle();await input.fill('Tennis update 31');await expect(dialog.locator('.updates-item')).toHaveCount(0)
 const before=await calls(page);await dialog.getByRole('button',{name:'Load older updates',exact:true}).click();await expect(dialog.locator('.updates-item')).toHaveCount(1);await expect(dialog.locator('[data-updates-matches]')).toHaveText('1 of 31 loaded updates');expect(await calls(page)).toBe(before+1)
 await expect(dialog.locator('.updates-item').getByRole('button').first()).toBeFocused();await expect(input).toHaveValue('Tennis update 31');expect(await original!.evaluate(el=>el===document.querySelector('[data-updates-query]'))).toBe(true)
 await dialog.getByRole('button',{name:'Refresh',exact:true}).click();await expect(dialog.locator('[data-updates-matches]')).toHaveText('0 of 25 loaded updates');await expect(input).toHaveValue('Tennis update 31');await expect(dialog.getByRole('button',{name:'Refresh',exact:true})).toBeFocused()
})
test('Updates finder: typing through a held refresh keeps the actual input and caret',async({page})=>{
 const dialog=await open(page),input=dialog.getByRole('searchbox',{name:'Find an update',exact:true}),original=await input.elementHandle();await input.fill('league');await page.evaluate(()=>{(window as unknown as Fixture).updatesFixture.deferList=true;document.querySelector<HTMLButtonElement>('[data-updates-refresh]')!.click()})
 await expect(dialog.locator('[data-updates-matches]')).toHaveText('Loading updates…');await expect(dialog.locator('.updates-empty')).toHaveCount(0);await input.fill('tournament');await input.evaluate(el=>(el as HTMLInputElement).setSelectionRange(2,5));await page.evaluate(()=>(window as unknown as Fixture).updatesFixture.release())
 await expect(dialog.locator('.updates-item')).toHaveCount(1);await expect(input).toHaveValue('tournament');await expect(input).toBeFocused();expect(await input.evaluate(el=>[(el as HTMLInputElement).selectionStart,(el as HTMLInputElement).selectionEnd])).toEqual([2,5]);expect(await original!.evaluate(el=>el===document.querySelector('[data-updates-query]'))).toBe(true)
})
test('Updates finder: search covers all 100 loaded notices without reaching unseen records',async({page})=>{
 const dialog=await open(page)
 await page.evaluate(()=>{const f=(window as unknown as Fixture).updatesFixture,base=f.rows[0];f.rows=Array.from({length:105},(_,i)=>({...base,id:'bbbb0000-0000-4000-8000-'+String(i+1).padStart(12,'0'),title:'Notice '+(i+1),body:'Saved tennis date',created_at:new Date(Date.UTC(2026,9,31,12,0)-i*60000).toISOString(),read_at:i%4?null:'2026-10-31T13:00:00Z'}))})
 await dialog.getByRole('button',{name:'Refresh',exact:true}).click();const input=dialog.getByRole('searchbox',{name:'Find an update',exact:true});await input.fill('Notice 101')
 for(const count of [50,75,100]){await dialog.getByRole('button',{name:'Load older updates',exact:true}).click();await expect(dialog.locator('[data-updates-matches]')).toHaveText('0 of '+count+' loaded updates')}
 await expect(dialog.locator('[data-updates-older]')).toHaveCount(0);await expect(dialog.locator('.updates-limit')).toContainText('100 updates loaded')
 const before=await calls(page);await input.fill('Notice 100');await expect(dialog.locator('.updates-item')).toHaveCount(1);await expect(dialog.locator('[data-updates-matches]')).toHaveText('1 of 100 loaded updates');expect(await calls(page)).toBe(before)
 expect(await page.evaluate(()=>(window as unknown as Fixture).updatesFixture.queries.filter(q=>q.method==='PATCH').length)).toBe(0)
})
test('Updates finder: query combines with source and unread filters and read-row focus recovers',async({page})=>{
 const dialog=await open(page),input=dialog.getByRole('searchbox',{name:'Find an update',exact:true});await input.fill('league');await dialog.getByRole('combobox',{name:'Type',exact:true}).selectOption('schedule');await expect(dialog.locator('[data-updates-matches]')).toHaveText('1 of 8 loaded updates')
 await dialog.getByRole('button',{name:'Unread',exact:true}).click();await expect(input).toHaveValue('league');await dialog.locator('.updates-item').getByRole('button',{name:'Mark read',exact:true}).click();await expect(dialog.locator('.updates-item')).toHaveCount(0);await expect(input).toBeFocused();await expect(dialog.locator('[data-updates-matches]')).toHaveText('0 of 7 loaded updates')
})
test('Updates finder: league destination returns to its same matching row and query',async({page})=>{
 const dialog=await open(page),input=dialog.getByRole('searchbox',{name:'Find an update',exact:true});await input.fill('league');const button=dialog.getByRole('button',{name:'Open league',exact:false});await button.click()
 const child=page.getByRole('dialog',{name:'Competitions',exact:true});await expect(child).toContainText('Northside Night League');await child.getByRole('button',{name:'← Competitions',exact:true}).click();await child.getByRole('button',{name:'Close',exact:true}).click();await expect(input).toHaveValue('league');await expect(button).toBeFocused();await expect(dialog.locator('.updates-item')).toHaveCount(1)
})
test('Updates finder: failed refresh, interrupted read status and account changes retain isolation',async({page})=>{
 const dialog=await open(page),input=dialog.getByRole('searchbox',{name:'Find an update',exact:true});await input.fill('league');await page.evaluate(()=>{(window as unknown as Fixture).updatesFixture.failList=true});await dialog.getByRole('button',{name:'Refresh',exact:true}).click()
 await expect(dialog.locator('[data-updates-matches]')).toHaveText('Updates unavailable');await expect(dialog.locator('.updates-empty')).toHaveCount(0);await expect(input).toHaveValue('league');await dialog.getByRole('button',{name:'Retry updates',exact:true}).click();await expect(dialog.locator('.updates-item')).toHaveCount(1)
 await page.evaluate(()=>{(window as unknown as Fixture).updatesFixture.loseWrite=true});await dialog.getByRole('button',{name:'Mark read',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByRole('button',{name:'Mark shown read',exact:true})).toBeDisabled();await input.fill('Taylor');await expect(dialog.getByRole('button',{name:'Mark read',exact:true})).toBeDisabled()
 await dialog.getByRole('button',{name:'Refresh',exact:true}).click();await expect(input).toHaveValue('Taylor');await expect(dialog.getByRole('button',{name:'Mark read',exact:true})).toBeEnabled();expect(await page.evaluate(()=>(window as unknown as Fixture).updatesFixture.queries.filter(q=>q.method==='PATCH').length)).toBe(1)
 await page.evaluate(()=>(window as unknown as Fixture).refreshNavigationSession());await expect(input).toHaveValue('Taylor');await page.evaluate(()=>(window as unknown as Fixture).switchNavigationOwner());await expect(dialog).toHaveCount(0)
 await page.locator('.native-updates-entry').click();const next=page.getByRole('dialog',{name:'Updates',exact:true});await expect(next.getByRole('searchbox')).toHaveValue('');await expect(next).toContainText('No updates in this view.')
})
