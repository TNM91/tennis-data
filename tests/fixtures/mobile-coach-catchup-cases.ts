import {test,expect,type Page} from '@playwright/test'
const origin='http://127.0.0.1:4283',first='88888888-8888-4888-8888-888888888881',second='88888888-8888-4888-8888-888888888882'
type Preview=Window&{coachChatFixture:{enabled:boolean};coachUnreadFixture:{enabled:boolean;longHistory:boolean;unavailable:boolean;holdLoad:boolean;loadFail:boolean;releaseLoad:()=>void;loads:number;reads:unknown[];counts:Record<string,number>;add:(student:string,id:string,body?:string)=>void};chatUnreadFixture:{emit:()=>void};switchNavigationOwner:()=>void;preservedDraft?:HTMLTextAreaElement;promptAnnouncements:number}
async function open(page:Page,width=390,long=false){
 await page.routeWebSocket('**/*',ws=>ws.close());await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 await page.evaluate(long=>{const w=window as unknown as Preview;w.coachChatFixture.enabled=true;w.coachUnreadFixture.enabled=true;w.coachUnreadFixture.longHistory=long;w.chatUnreadFixture.emit()},long)
 await page.locator('.app-navigation [data-screen="teams"]').click();await page.locator('[data-coach-chat="student-one"]').click()
 const dialog=page.getByRole('dialog',{name:'Coach messages',exact:true});await expect(dialog).toContainText('Latest private note for student-one.');await expect(dialog.locator('[data-refresh]')).toBeEnabled();return dialog
}
async function add(page:Page,id:string,student='student-one',body='Fresh return practice note.'){
 await page.evaluate(({id,student,body})=>{const w=window as unknown as Preview;w.coachUnreadFixture.add(student,id,body);w.chatUnreadFixture.emit()},{id,student,body})
}
for(const width of [320,390])test('Coach explicit catch-up during search preserves the live draft node and caret while loading an already-read new note at '+width+'px',async({page},info)=>{
 const dialog=await open(page,width,true),draft=dialog.getByRole('textbox',{name:'Message',exact:true})
 await dialog.locator('[data-coach-message-id="44444444-4444-4444-8444-444444444444"]').scrollIntoViewIfNeeded();await expect(page.locator('[data-chat-badge]')).toHaveText('8');await draft.fill('Keep my slice return practice draft.')
 await dialog.getByRole('button',{name:'Find in conversation',exact:true}).click();await draft.focus()
 await draft.evaluate(el=>{const w=window as unknown as Preview;w.preservedDraft=el as HTMLTextAreaElement;(el as HTMLTextAreaElement).setSelectionRange(5,12)})
 const before=await page.evaluate(()=>{const f=(window as unknown as Preview).coachUnreadFixture;return {loads:f.loads,reads:f.reads.length}})
 await page.evaluate(id=>{const w=window as unknown as Preview;w.coachUnreadFixture.add('student-one',id,'Fresh return practice note.');w.coachUnreadFixture.counts['student-one']=0;w.chatUnreadFixture.emit()},first)
 const prompt=dialog.locator('[data-coach-catchup]');await expect(prompt).toBeVisible();await expect(dialog).not.toContainText('Fresh return practice note.');await expect(draft).toBeFocused()
 expect(await page.evaluate(()=>{const w=window as unknown as Preview;return {same:w.preservedDraft===document.querySelector('[name=body]'),selection:[w.preservedDraft?.selectionStart,w.preservedDraft?.selectionEnd],loads:w.coachUnreadFixture.loads,reads:w.coachUnreadFixture.reads.length}})).toEqual({same:true,selection:[5,12],...before})
 await page.screenshot({path:info.outputPath('coach-catchup-'+width+'.png')})
 await prompt.locator('[data-coach-catchup-status]').evaluate(el=>{const w=window as unknown as Preview;w.promptAnnouncements=0;new MutationObserver(rows=>{w.promptAnnouncements+=rows.length}).observe(el,{childList:true,characterData:true,subtree:true})})
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.holdLoad=true);await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(draft).toBeEnabled();await expect(dialog.getByRole('button',{name:'Send message',exact:true})).toBeDisabled()
 await draft.fill('Still typing while messages load.');await draft.evaluate(el=>(el as HTMLTextAreaElement).setSelectionRange(6,12));expect(await page.evaluate(()=>(window as unknown as Preview).promptAnnouncements)).toBe(0);await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.releaseLoad())
 await expect(dialog).toContainText('Fresh return practice note.');await expect(prompt).toBeHidden();await expect(draft).toHaveValue('Still typing while messages load.');await expect(draft).toBeFocused()
 expect(await draft.evaluate(el=>[(el as HTMLTextAreaElement).selectionStart,(el as HTMLTextAreaElement).selectionEnd])).toEqual([6,12]);expect(await page.evaluate(()=>(window as unknown as Preview).preservedDraft===document.querySelector('[name=body]'))).toBe(true)
 expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.loads)).toBe(before.loads+1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:info.outputPath('coach-catchup-loaded-'+width+'.png')})
 await page.evaluate(id=>{const w=window as unknown as Preview;w.coachUnreadFixture.add('student-one',id,'Immediate reply.');w.coachUnreadFixture.counts['student-one']=0;w.chatUnreadFixture.emit()},second);await expect(prompt).toBeVisible();await draft.focus();await draft.evaluate(el=>(el as HTMLTextAreaElement).setSelectionRange(2,9));await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(dialog).toContainText('Immediate reply.');await expect(prompt).toBeHidden();await expect(draft).toBeFocused();expect(await draft.evaluate(el=>[(el as HTMLTextAreaElement).selectionStart,(el as HTMLTextAreaElement).selectionEnd])).toEqual([2,9])
})
test('Coach explicit catch-up during search retains activity arriving after the refresh snapshot without prefetching it',async({page})=>{
 const dialog=await open(page);await expect(page.locator('[data-chat-badge]')).toHaveText('8');await dialog.getByRole('button',{name:'Find in conversation',exact:true}).click();await add(page,first,'student-one','First new reply.');await expect(dialog.locator('[data-coach-catchup]')).toBeVisible()
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.holdLoad=true);await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(dialog.locator('[data-refresh]')).toBeDisabled()
 await add(page,second,'student-one','Reply arriving during refresh.');await expect(page.locator('[data-chat-badge]')).toHaveText('10');await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.releaseLoad())
 await expect(dialog).toContainText('First new reply.');await expect(dialog).not.toContainText('Reply arriving during refresh.');await expect(dialog.locator('[data-coach-catchup]')).toBeVisible();await expect(dialog.locator('[data-refresh]')).toBeEnabled()
 const loads=await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.loads);await page.waitForTimeout(2200);expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.loads)).toBe(loads)
 await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(dialog).toContainText('Reply arriving during refresh.');await expect(dialog.locator('[data-coach-catchup]')).toBeHidden()
})
test('Coach catch-up ignores another conversation, retains known activity through an outage and discards a late old-account load',async({page})=>{
 const dialog=await open(page);await expect(page.locator('[data-chat-badge]')).toHaveText('8');await dialog.getByRole('button',{name:'Find in conversation',exact:true}).click();await add(page,first,'student-two');await expect(page.locator('[data-chat-badge]')).toHaveText('9');await expect(dialog.locator('[data-coach-catchup]')).toBeHidden()
 await add(page,second);await expect(dialog.locator('[data-coach-catchup]')).toBeVisible();await page.evaluate(()=>{const w=window as unknown as Preview;w.coachUnreadFixture.unavailable=true;w.chatUnreadFixture.emit()});await expect(page.locator('.app-navigation [data-screen="teams"]')).toHaveAttribute('aria-label','Chats, at least 7 unread messages. Some counts unavailable.');await expect(dialog.locator('[data-coach-catchup]')).toBeVisible()
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.holdLoad=true);await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(dialog.locator('[data-refresh]')).toBeDisabled();await page.evaluate(()=>(window as unknown as Preview).switchNavigationOwner());await expect(dialog).toHaveCount(0);await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.releaseLoad());await expect(page.locator('[data-chat-badge]')).toHaveText('7');await expect(page.getByText('Fresh return practice note.',{exact:true})).toHaveCount(0)
})
test('Coach catch-up keeps a reading anchor and unread state through a failed load and explicit retry',async({page})=>{
 const dialog=await open(page,390,true),anchor=dialog.locator('[data-coach-message-id="66666666-6666-4666-8666-000000000015"]')
 await anchor.scrollIntoViewIfNeeded();const before=(await anchor.boundingBox())!.y,reads=await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads.length)
 await add(page,first);await expect(dialog.locator('[data-coach-catchup]')).toBeVisible();expect(Math.abs((await anchor.boundingBox())!.y-before)).toBeLessThanOrEqual(2)
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.loadFail=true);await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(dialog).toContainText('Messages could not be confirmed.');await expect(dialog.locator('[data-coach-catchup]')).toBeVisible();expect(Math.abs((await anchor.boundingBox())!.y-before)).toBeLessThanOrEqual(2)
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.loadFail=false);await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(dialog).toContainText('Fresh return practice note.');await expect(dialog.locator('[data-coach-catchup]')).toBeHidden();expect(Math.abs((await anchor.boundingBox())!.y-before)).toBeLessThanOrEqual(2)
 expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads.length)).toBe(reads);await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).not.toBeFocused()
})

test('Coach catch-up keeps Close and draft-leave review available during a slow message load',async({page})=>{
 const dialog=await open(page),draft=dialog.getByRole('textbox',{name:'Message',exact:true});await draft.fill('Keep writing during a refresh.')
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.holdLoad=true);await dialog.locator('[data-refresh]').click();await expect(dialog.locator('[data-refresh]')).toBeDisabled()
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).toContainText('Leave this message?');await dialog.getByRole('button',{name:'Keep writing',exact:true}).click();await expect(draft).toHaveValue('Keep writing during a refresh.');await expect(draft).toBeEnabled();await draft.fill('My updated draft stays here.');await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.releaseLoad())
 await expect(dialog.locator('[data-refresh]')).toBeEnabled();await expect(draft).toHaveValue('My updated draft stays here.')
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.holdLoad=true);await dialog.locator('[data-refresh]').click();await expect(dialog.locator('[data-refresh]')).toBeDisabled();await dialog.getByRole('button',{name:'Close',exact:true}).click();await dialog.getByRole('button',{name:'Discard and leave',exact:true}).click();await expect(dialog).toHaveCount(0);await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.releaseLoad());await expect(dialog).toHaveCount(0)
})

test('Coach catch-up does not mark a latest message read while its end is covered by the sticky header',async({page})=>{
 const dialog=await open(page,390,true);await page.setViewportSize({width:390,height:420})
 const last=dialog.locator('[data-coach-message-id="44444444-4444-4444-8444-444444444444"]')
 await dialog.evaluate(el=>{const last=el.querySelector('[data-coach-message-id="44444444-4444-4444-8444-444444444444"]')!;el.scrollTop+=last.getBoundingClientRect().bottom-el.querySelector('header')!.getBoundingClientRect().bottom+2})
 const covered=await last.evaluate(el=>({end:el.getBoundingClientRect().bottom,header:el.closest('dialog')!.querySelector('header')!.getBoundingClientRect().bottom}));expect(covered.end).toBeGreaterThan(0);expect(covered.end).toBeLessThanOrEqual(covered.header)
 await page.waitForTimeout(300);expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads.length)).toBe(0);await expect(page.locator('[data-chat-badge]')).toHaveText('10')
 await dialog.evaluate(el=>{el.scrollTop-=160});await expect(page.locator('[data-chat-badge]')).toHaveText('8');expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads.length)).toBe(1)
})
