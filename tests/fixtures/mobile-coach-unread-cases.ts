import {test,expect,type Page} from '@playwright/test'
const origin='http://127.0.0.1:4283',last='44444444-4444-4444-8444-444444444444'
type Preview=Window&{coachChatFixture:{enabled:boolean};coachUnreadFixture:{enabled:boolean;unavailable:boolean;readFail:boolean;longHistory:boolean;newAfterRead:boolean;holdRead:boolean;releaseRead:()=>void;reads:{student:string;message:string}[]};chatUnreadFixture:{emit:()=>void};switchNavigationOwner:()=>void}
async function inbox(page:Page,width=390){
 await page.routeWebSocket('**/*',ws=>ws.close());await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 await page.evaluate(()=>{const w=window as unknown as Preview;w.coachChatFixture.enabled=true;w.coachUnreadFixture.enabled=true;w.chatUnreadFixture.emit()})
 await page.locator('.app-navigation [data-screen="teams"]').click();await expect(page.locator('[data-coach-chat]')).toHaveCount(2);await expect(page.locator('[data-chat-badge]')).toHaveText('10')
}
async function latest(page:Page){
 await page.locator('[data-coach-chat="student-one"]').click();const dialog=page.getByRole('dialog',{name:'Coach messages',exact:true});await expect(dialog).toContainText('Latest private note');await dialog.locator('[data-coach-message-id="'+last+'"]').scrollIntoViewIfNeeded();return dialog
}
for(const width of [320,390])test('Coach unread badges stay separate from team filters and clear after the latest note is visible at '+width+'px',async({page},info)=>{
 await inbox(page,width);await expect(page.locator('[data-team-unread]')).toHaveText('7');await expect(page.locator('[data-coach-chat="student-one"] [data-coach-unread]')).toHaveText('2')
 await page.getByRole('searchbox',{name:'Find a team'}).fill('Baseline');await page.locator('[data-chats-filter="unread"]').click();await page.locator('[data-coach-filter="unread"]').click()
 const dialog=await latest(page);await expect(page.locator('[data-chat-badge]')).toHaveText('8');await expect(page.locator('[data-team-unread]')).toHaveText('7')
 expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads)).toEqual([{student:'student-one',message:last}])
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('[data-coach-chat="student-one"]')).toHaveCount(0);await expect(page.locator('[data-coach-filter="unread"]')).toBeFocused();await expect(page.locator('[data-coach-filter="unread"]')).toHaveAttribute('aria-pressed','true')
 await expect(page.getByRole('searchbox',{name:'Find a team'})).toHaveValue('Baseline');await expect(page.locator('[data-chats-filter="unread"]')).toHaveAttribute('aria-pressed','true')
 await page.locator('[data-coach-filter="all"]').click();await expect(page.locator('[data-coach-chat="student-one"] [data-coach-unread]')).toBeHidden()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('coach-unread-'+width+'.png')})
})
test('Coach count outages keep the team badge and never claim that private conversations are caught up',async({page})=>{
 await inbox(page);await page.evaluate(()=>{const w=window as unknown as Preview;w.coachUnreadFixture.unavailable=true;w.chatUnreadFixture.emit()})
 await expect(page.locator('.app-navigation [data-screen="teams"]')).toHaveAttribute('aria-label','Chats, at least 7 unread messages. Some counts unavailable.');await expect(page.locator('[data-chat-badge]')).toHaveText('7')
 await page.locator('[data-coach-filter="unread"]').click();await expect(page.locator('[data-coach-chat-status]')).toContainText('Unread counts unavailable');await expect(page.locator('[data-coach-chat]')).toHaveCount(0)
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.unavailable=false);await page.getByRole('button',{name:'Refresh conversations',exact:true}).click();await expect(page.locator('[data-coach-chat]')).toHaveCount(2);await expect(page.locator('[data-chat-badge]')).toHaveText('10')
})
test('Coach reading waits for the latest message and the foreground, without a hidden read acknowledgement',async({page})=>{
 await inbox(page);await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.longHistory=true)
 await page.locator('[data-coach-chat="student-one"]').click();const dialog=page.getByRole('dialog',{name:'Coach messages',exact:true});await expect(dialog).toContainText('Latest private note');expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads)).toHaveLength(0)
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))})
 await dialog.locator('[data-coach-message-id="'+last+'"]').scrollIntoViewIfNeeded();await page.waitForTimeout(300);expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads)).toHaveLength(0)
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))});await expect(page.locator('[data-chat-badge]')).toHaveText('8')
 expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads)).toEqual([{student:'student-one',message:last}])
})
test('An unconfirmed Coach read keeps unread counts and retries only after an explicit refresh',async({page})=>{
 await inbox(page);await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.readFail=true);const dialog=await latest(page)
 await expect(dialog.locator('[data-coach-read-notice]')).toContainText('Couldn’t update your read status');await expect(page.locator('[data-chat-badge]')).toHaveText('10');expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads)).toHaveLength(1)
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.readFail=false);await dialog.getByRole('button',{name:'Refresh messages',exact:true}).click();await expect(dialog.getByRole('button',{name:'Refresh messages',exact:true})).toBeEnabled();await dialog.locator('[data-coach-message-id="'+last+'"]').scrollIntoViewIfNeeded();await expect(page.locator('[data-chat-badge]')).toHaveText('8');expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads)).toHaveLength(2)
})
test('Newer private messages remain unread after acknowledging an older rendered note',async({page})=>{
 await inbox(page);await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.newAfterRead=true);const dialog=await latest(page)
 await expect(page.locator('[data-chat-badge]')).toHaveText('9');await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('[data-coach-chat="student-one"] [data-coach-unread]')).toHaveText('1');await expect(page.locator('[data-team-unread]')).toHaveText('7')
 expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads)).toEqual([{student:'student-one',message:last}])
})
test('A Coach read confirmation preserves the draft and typing focus',async({page})=>{
 await inbox(page);await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.holdRead=true);const dialog=await latest(page)
 await expect.poll(()=>page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads.length)).toBe(1)
 const draft=dialog.getByRole('textbox',{name:'Message',exact:true});await draft.fill('Keep this private draft');await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.releaseRead())
 await expect(page.locator('[data-chat-badge]')).toHaveText('8');await expect(draft).toHaveValue('Keep this private draft');await expect(draft).toBeFocused()
})
test('A late Coach acknowledgement cannot restore the previous account’s conversation or badge',async({page})=>{
 await inbox(page);await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.holdRead=true);const dialog=await latest(page)
 await expect.poll(()=>page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads.length)).toBe(1)
 await page.evaluate(()=>(window as unknown as Preview).switchNavigationOwner());await expect(dialog).toHaveCount(0)
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.releaseRead());await expect(page.locator('[data-chat-badge]')).toHaveText('7');await expect(page.getByText('Latest private note for student-one.',{exact:true})).toHaveCount(0)
})
