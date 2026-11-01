import {test,expect,type Page} from '@playwright/test'
const origin='http://127.0.0.1:4283'
type Preview=Window&{coachChatFixture:{enabled:boolean};coachUnreadFixture:{enabled:boolean;longHistory:boolean;more:boolean;loads:number;reads:unknown[];add:(student:string,id:string,body:string)=>void;holdLoad:boolean;releaseLoad:()=>void};chatUnreadFixture:{emit:()=>void};switchNavigationOwner:()=>void;savedCoachDraft?:HTMLTextAreaElement}
async function open(page:Page,width=390){
 await page.routeWebSocket('**/*',ws=>ws.close());await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 await page.evaluate(()=>{const w=window as unknown as Preview;w.coachChatFixture.enabled=true;w.coachUnreadFixture.enabled=true;w.coachUnreadFixture.longHistory=true;w.coachUnreadFixture.more=true;w.chatUnreadFixture.emit()})
 await page.locator('.app-navigation [data-screen="teams"]').click();await page.locator('[data-coach-chat="student-one"]').click()
 const dialog=page.getByRole('dialog',{name:'Coach messages',exact:true});await expect(dialog).toContainText('Latest private note for student-one.');await expect(dialog.locator('[data-refresh]')).toBeEnabled();return dialog
}
for(const width of [320,390])test('Coach conversation tools find literal text, navigate safely and jump to latest at '+width+'px',async({page},info)=>{
 const dialog=await open(page,width),before=await page.evaluate(()=>{const f=(window as unknown as Preview).coachUnreadFixture;return {loads:f.loads,reads:f.reads.length}})
 await expect(dialog.locator('.coach-message-day')).toHaveCount(1);await expect(dialog.locator('.coach-message-meta time').first()).toHaveAttribute('datetime','2026-10-31T11:00:00Z')
 await dialog.getByRole('button',{name:'Find in conversation',exact:true}).click();const search=dialog.getByRole('searchbox',{name:'Find a message',exact:true});await expect(search).toBeFocused();await search.fill('practice note 1.')
 await expect(dialog.locator('[data-coach-search-status]')).toHaveText('1 matching message');await expect(dialog).toContainText('Searching the latest 100 messages.');await expect(dialog.locator('mark')).toHaveCount(1)
 await search.press('Enter');const hit=dialog.locator('.is-search-current');await expect(hit).toContainText('Return practice note 1.');const box=(await hit.boundingBox())!,header=(await dialog.locator('.native-coach-header').boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(header.y+header.height-1)
 await search.fill('practice note');await dialog.getByRole('button',{name:'Previous matching message',exact:true}).click();await expect(dialog.locator('[data-coach-search-status]')).toHaveText('35 of 35 matching messages');await dialog.getByRole('button',{name:'Next matching message',exact:true}).click();await expect(dialog.locator('[data-coach-search-status]')).toHaveText('1 of 35 matching messages')
 await search.fill('<img src=x>');await expect(dialog.locator('[data-coach-search-status]')).toHaveText('No matches in loaded messages.');await expect(dialog.getByRole('button',{name:'Next matching message',exact:true})).toBeDisabled();await expect(dialog.locator('img[src=x]')).toHaveCount(0)
 await search.fill('Latest private');await search.press('Enter');await expect(dialog.locator('.is-search-current')).toContainText('Latest private note');await page.waitForTimeout(100)
 expect(await page.evaluate(()=>{const f=(window as unknown as Preview).coachUnreadFixture;return {loads:f.loads,reads:f.reads.length}})).toEqual(before)
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:info.outputPath('coach-search-'+width+'.png')})
 await dialog.getByRole('button',{name:'Jump to latest messages',exact:true}).click();await expect(dialog.locator('[data-coach-search-panel]')).toBeHidden();await expect(dialog.locator('mark')).toHaveCount(0);await expect(page.locator('[data-chat-badge]')).toHaveText('8');await expect(dialog.locator('[data-coach-message-id]').last()).toBeFocused()
 await page.screenshot({path:info.outputPath('coach-latest-'+width+'.png')})
})
test('Coach search keeps a live draft and reading target through an explicit refresh, then clears on owner change',async({page})=>{
 const dialog=await open(page),draft=dialog.getByRole('textbox',{name:'Message',exact:true});await draft.fill('Keep my return lesson draft.');await draft.evaluate(el=>{(window as unknown as Preview).savedCoachDraft=el as HTMLTextAreaElement;(el as HTMLTextAreaElement).setSelectionRange(3,9)})
 const find=dialog.getByRole('button',{name:'Find in conversation',exact:true});await find.focus();await find.press('Enter');const search=dialog.getByRole('searchbox',{name:'Find a message',exact:true});await search.fill('Return practice note 15.');await search.press('Enter');const anchor=dialog.locator('.is-search-current'),y=(await anchor.boundingBox())!.y
 await page.evaluate(()=>{const w=window as unknown as Preview;w.coachUnreadFixture.add('student-one','88888888-8888-4888-8888-888888888883','Another return practice note.');w.chatUnreadFixture.emit()})
 await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(dialog).toContainText('Another return practice note.');await expect(search).toHaveValue('Return practice note 15.');await expect(dialog.locator('.is-search-current')).toContainText('Return practice note 15.');expect(Math.abs((await anchor.boundingBox())!.y-y)).toBeLessThanOrEqual(2)
 expect(await draft.evaluate(el=>({same:el===(window as unknown as Preview).savedCoachDraft,selection:[(el as HTMLTextAreaElement).selectionStart,(el as HTMLTextAreaElement).selectionEnd]}))).toEqual({same:true,selection:[3,9]});await expect(draft).toHaveValue('Keep my return lesson draft.')
 await search.focus();await search.press('Escape');await expect(dialog.locator('[data-coach-search-panel]')).toBeHidden();await expect(dialog.getByRole('button',{name:'Find in conversation',exact:true})).toBeFocused();await expect(dialog.locator('mark')).toHaveCount(0)
 await dialog.getByRole('button',{name:'Find in conversation',exact:true}).click();await expect(search).toHaveValue('');await search.fill('private');await page.evaluate(()=>(window as unknown as Preview).switchNavigationOwner());await expect(dialog).toHaveCount(0);await expect(page.getByRole('searchbox',{name:'Find a message',exact:true})).toHaveCount(0)
})
