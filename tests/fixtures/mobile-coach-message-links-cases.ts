import {test,expect,type Page} from '@playwright/test'
const origin='http://127.0.0.1:4283',id='77777777-7777-4777-8777-777777777771',next='77777777-7777-4777-8777-777777777772'
type Preview=Window&{coachChatFixture:{enabled:boolean};coachUnreadFixture:{enabled:boolean;loads:number;reads:unknown[];add:(student:string,id:string,body:string)=>void};chatUnreadFixture:{emit:()=>void};switchNavigationOwner:()=>void;coachOpenedLinks:string[]}
async function open(page:Page,width=390,body='Court notes: https://example.com/return?side=deuce&rep=2. Try [a+b].'){
 await page.routeWebSocket('**/*',ws=>ws.close());await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 await page.evaluate(({id,body})=>{const w=window as unknown as Preview;w.coachChatFixture.enabled=true;w.coachUnreadFixture.enabled=true;w.coachUnreadFixture.add('student-one',id,body);w.coachOpenedLinks=[];window.open=url=>{w.coachOpenedLinks.push(String(url));return null};w.chatUnreadFixture.emit()},{id,body})
 await page.locator('.app-navigation [data-screen="teams"]').click();await page.locator('[data-coach-chat="student-one"]').click()
 const dialog=page.getByRole('dialog',{name:'Coach messages',exact:true});await expect(dialog.locator('[data-refresh]')).toBeEnabled();await expect(dialog.locator('[data-coach-message-id="'+id+'"]').getByRole('button')).toHaveCount(1);return dialog
}
for(const width of [320,390])test('Coach links review the exact destination and retain search and draft at '+width+'px',async({page},info)=>{
 const dialog=await open(page,width),draft=dialog.getByRole('textbox',{name:'Message',exact:true});await draft.fill('Keep my lesson notes.')
 await dialog.getByRole('button',{name:'Find in conversation',exact:true}).click();const query=dialog.getByRole('searchbox',{name:'Find a message',exact:true});await query.fill('return')
 const source=dialog.getByRole('button',{name:'Review link to example.com',exact:true});await expect(source.locator('mark')).toHaveText('return')
 await source.click();const review=page.getByRole('dialog',{name:'Open shared link',exact:true});await expect(review).toContainText('https://example.com/return?side=deuce&rep=2');await expect(review.getByRole('button',{name:'Cancel',exact:true})).toBeFocused()
 expect(await page.evaluate(()=>(window as unknown as Preview).coachOpenedLinks)).toEqual([])
 const counts=await page.evaluate(()=>{const f=(window as unknown as Preview).coachUnreadFixture;return {loads:f.loads,reads:f.reads.length}})
 await page.evaluate(({next})=>{const w=window as unknown as Preview;w.coachUnreadFixture.add('student-one',next,'A reply while reviewing the link.');w.chatUnreadFixture.emit()},{next})
 await expect(dialog.locator('[data-coach-catchup]')).toBeVisible();await page.waitForTimeout(2200)
 expect(await page.evaluate(()=>{const f=(window as unknown as Preview).coachUnreadFixture;return {loads:f.loads,reads:f.reads.length}})).toEqual(counts)
 await review.getByRole('button',{name:'Cancel',exact:true}).click();await expect(review).toHaveCount(0);await expect(source).toBeFocused();await expect(query).toHaveValue('return');await expect(draft).toHaveValue('Keep my lesson notes.')
 await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(dialog).toContainText('A reply while reviewing the link.');await expect(source.locator('mark')).toHaveText('return')
 await source.click();await review.getByRole('button',{name:'Open website',exact:true}).click();await expect(review).toHaveCount(0);await expect(source).toBeFocused()
 expect(await page.evaluate(()=>(window as unknown as Preview).coachOpenedLinks)).toEqual(['https://example.com/return?side=deuce&rep=2'])
 await expect(draft).toHaveValue('Keep my lesson notes.');expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(await source.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 await page.screenshot({path:info.outputPath('coach-message-links-'+width+'.png')})
})
test('Coach link review closes on account change and cannot open a stale account destination',async({page})=>{
 const dialog=await open(page);await dialog.getByRole('button',{name:'Review link to example.com',exact:true}).click();await expect(page.getByRole('dialog',{name:'Open shared link',exact:true})).toBeVisible()
 await page.evaluate(()=>(window as unknown as Preview).switchNavigationOwner());await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>(window as unknown as Preview).coachOpenedLinks)).toEqual([])
})
test('Coach internal links keep unsent drafts under the existing app navigation review',async({page})=>{
 const dialog=await open(page,390,'Open https://www.tenaceiq.com/tournaments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),draft=dialog.getByRole('textbox',{name:'Message',exact:true});await draft.fill('Check the draw first.')
 await dialog.getByRole('button',{name:'Review link to www.tenaceiq.com',exact:true}).click();await expect(dialog).toContainText('Close this conversation to open the shared link.');await expect(page.getByRole('dialog',{name:'Open shared link',exact:true})).toHaveCount(0)
 await expect(draft).toHaveValue('Check the draw first.');expect(await page.evaluate(()=>(window as unknown as Preview).coachOpenedLinks)).toEqual([])
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).toContainText('Leave this message?');await dialog.getByRole('button',{name:'Keep writing',exact:true}).click();await expect(draft).toHaveValue('Check the draw first.')
})
test('Coach link review pauses automatic catch-up and restores link focus after fresh replies',async({page})=>{
 const dialog=await open(page),source=dialog.getByRole('button',{name:'Review link to example.com',exact:true});await source.click();const review=page.getByRole('dialog',{name:'Open shared link',exact:true})
 const before=await page.evaluate(()=>{const f=(window as unknown as Preview).coachUnreadFixture;return {loads:f.loads,reads:f.reads.length}})
 await page.evaluate(({next})=>{const w=window as unknown as Preview;w.coachUnreadFixture.add('student-one',next,'Fresh reply after link review.');w.chatUnreadFixture.emit()},{next})
 await expect(dialog.locator('[data-coach-catchup]')).toBeVisible();await page.waitForTimeout(2200);expect(await page.evaluate(()=>{const f=(window as unknown as Preview).coachUnreadFixture;return {loads:f.loads,reads:f.reads.length}})).toEqual(before)
 await review.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toContainText('Fresh reply after link review.');await expect(source).toBeFocused();expect(await page.evaluate(()=>(window as unknown as Preview).coachOpenedLinks)).toEqual([])
})
test('Coach browser failures retain the reviewed destination and unsent message',async({page})=>{
 const dialog=await open(page),draft=dialog.getByRole('textbox',{name:'Message',exact:true});await draft.fill('I can still send this.')
 await page.evaluate(()=>{window.open=()=>{throw Error('Synthetic browser failure')}});await dialog.getByRole('button',{name:'Review link to example.com',exact:true}).click();const review=page.getByRole('dialog',{name:'Open shared link',exact:true})
 await review.getByRole('button',{name:'Open website',exact:true}).click();await expect(review).toContainText('Could not open this website.');await expect(review).toContainText('https://example.com/return?side=deuce&rep=2');await expect(review.getByRole('button',{name:'Open website',exact:true})).toBeEnabled()
 await review.getByRole('button',{name:'Cancel',exact:true}).click();await expect(draft).toHaveValue('I can still send this.');await expect(dialog.getByRole('button',{name:'Review link to example.com',exact:true})).toBeFocused()
})
