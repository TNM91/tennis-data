import {test,expect,type Page} from '@playwright/test'
const origin='http://127.0.0.1:4283',first='88888888-8888-4888-8888-888888888891',second='88888888-8888-4888-8888-888888888892'
type Preview=Window&{coachChatFixture:{enabled:boolean};coachUnreadFixture:{enabled:boolean;longHistory:boolean;unavailable:boolean;holdLoad:boolean;loadFail:boolean;releaseLoad:()=>void;loads:number;reads:{message:string}[];add:(student:string,id:string,body:string)=>void};chatUnreadFixture:{emit:()=>void};switchNavigationOwner:()=>void;liveCoachDraft?:HTMLTextAreaElement}
async function open(page:Page,width=390){
 await page.routeWebSocket('**/*',ws=>ws.close());await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 await page.evaluate(()=>{const w=window as unknown as Preview;w.coachChatFixture.enabled=true;w.coachUnreadFixture.enabled=true;w.coachUnreadFixture.longHistory=true;w.chatUnreadFixture.emit()})
 await page.locator('.app-navigation [data-screen="teams"]').click();await page.locator('[data-coach-chat="student-one"]').click()
 const dialog=page.getByRole('dialog',{name:'Coach messages',exact:true});await expect(dialog).toContainText('Latest private note for student-one.');await expect(dialog.locator('[data-refresh]')).toBeEnabled();return dialog
}
const loads=(page:Page)=>page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.loads)
async function add(page:Page,id=first,body='Your next return drill is ready.'){
 await page.evaluate(({id,body})=>{const w=window as unknown as Preview;w.coachUnreadFixture.add('student-one',id,body);w.chatUnreadFixture.emit()},{id,body})
}
for(const width of [320,390])test('Coach automatic updates follow visible latest replies and retain the live draft at '+width+'px',async({page},info)=>{
 const dialog=await open(page,width);await dialog.getByRole('button',{name:'Jump to latest messages',exact:true}).click();await expect(page.locator('[data-chat-badge]')).toHaveText('8')
 const before=await loads(page);await add(page);await expect(dialog).toContainText('Your next return drill is ready.');await expect(dialog.locator('[data-coach-catchup]')).toBeHidden();expect(await loads(page)).toBe(before+1)
 await expect(dialog.locator('[data-coach-message-id="44444444-4444-4444-8444-444444444444"]')).toBeFocused()
 const last=dialog.locator('[data-coach-message-id]').last(),bounds=(await last.boundingBox())!,header=(await dialog.locator('header').boundingBox())!;expect(bounds.y+bounds.height).toBeLessThanOrEqual(845);expect(bounds.y+bounds.height).toBeGreaterThan(header.y+header.height);await expect(page.locator('[data-chat-badge]')).toHaveText('8')
 const draft=dialog.getByRole('textbox',{name:'Message',exact:true});await draft.fill('Keep my backhand return draft.');await draft.evaluate(el=>{(window as unknown as Preview).liveCoachDraft=el as HTMLTextAreaElement;(el as HTMLTextAreaElement).setSelectionRange(5,12)});await dialog.evaluate(el=>{el.scrollTop=el.scrollHeight})
 await add(page,second,'Recover to the middle after the return.');await expect(dialog).toContainText('Recover to the middle after the return.');await expect(draft).toHaveValue('Keep my backhand return draft.');await expect(draft).toBeFocused()
 expect(await draft.evaluate(el=>({same:el===(window as unknown as Preview).liveCoachDraft,selection:[(el as HTMLTextAreaElement).selectionStart,(el as HTMLTextAreaElement).selectionEnd]}))).toEqual({same:true,selection:[5,12]})
 expect(await loads(page)).toBe(before+2);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:info.outputPath('coach-auto-draft-'+width+'.png')})
 await page.waitForTimeout(2300);expect(await loads(page)).toBe(before+2)
})
test('Coach automatic updates leave earlier history and search in place until an explicit load',async({page})=>{
 const dialog=await open(page),anchor=dialog.locator('[data-coach-message-id="66666666-6666-4666-8666-000000000015"]');await anchor.scrollIntoViewIfNeeded();const before=await loads(page),y=(await anchor.boundingBox())!.y
 await add(page);await expect(dialog.locator('[data-coach-catchup]')).toBeVisible();await page.waitForTimeout(2300);expect(await loads(page)).toBe(before);expect(Math.abs((await anchor.boundingBox())!.y-y)).toBeLessThanOrEqual(2)
 await dialog.getByRole('button',{name:'Find in conversation',exact:true}).click();const search=dialog.getByRole('searchbox',{name:'Find a message',exact:true});await search.fill('Latest private');await search.press('Enter');await page.waitForTimeout(2300);expect(await loads(page)).toBe(before);await expect(dialog).not.toContainText('Your next return drill is ready.')
 await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(dialog).toContainText('Your next return drill is ready.');await expect(search).toHaveValue('Latest private');await expect(dialog.locator('[data-coach-search-panel]')).toBeVisible();expect(await loads(page)).toBe(before+1);expect(await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.reads.length)).toBe(0)
})
test('Coach automatic updates keep failed activity for explicit retry without idle retries',async({page})=>{
 const dialog=await open(page);await dialog.getByRole('button',{name:'Jump to latest messages',exact:true}).click();await expect(page.locator('[data-chat-badge]')).toHaveText('8');const before=await loads(page)
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.loadFail=true);await add(page);await expect(dialog).toContainText('Messages could not be confirmed.');await expect(dialog.locator('[data-coach-catchup]')).toBeVisible();expect(await loads(page)).toBe(before+1)
 await page.evaluate(()=>(window as unknown as Preview).chatUnreadFixture.emit());await page.waitForTimeout(2300);expect(await loads(page)).toBe(before+1)
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.loadFail=false);await dialog.getByRole('button',{name:'Load updated messages',exact:true}).click();await expect(dialog).toContainText('Your next return drill is ready.');await expect(dialog.locator('[data-coach-catchup]')).toBeHidden();expect(await loads(page)).toBe(before+2)
})
test('Coach automatic updates preserve an earlier reading position if the reader moves during a slow load',async({page})=>{
 const dialog=await open(page);await dialog.getByRole('button',{name:'Jump to latest messages',exact:true}).click();await expect(page.locator('[data-chat-badge]')).toHaveText('8');const before=await loads(page)
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.holdLoad=true);await add(page);await expect.poll(()=>loads(page)).toBe(before+1)
 const anchor=dialog.locator('[data-coach-message-id="66666666-6666-4666-8666-000000000015"]');await anchor.scrollIntoViewIfNeeded();const y=(await anchor.boundingBox())!.y
 await add(page,second,'A reply arriving after the snapshot.');await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.releaseLoad());await expect(dialog).toContainText('Your next return drill is ready.');await expect(dialog).not.toContainText('A reply arriving after the snapshot.');await expect(dialog.locator('[data-coach-catchup]')).toBeVisible();expect(Math.abs((await anchor.boundingBox())!.y-y)).toBeLessThanOrEqual(2)
 await page.waitForTimeout(2300);expect(await loads(page)).toBe(before+1);expect(await page.evaluate(ids=>(window as unknown as Preview).coachUnreadFixture.reads.some(read=>ids.includes(read.message)),[first,second])).toBe(false)
})
test('Coach automatic updates combine a burst during a slow response into one later load',async({page})=>{
 const dialog=await open(page);await dialog.getByRole('button',{name:'Jump to latest messages',exact:true}).click();await expect(page.locator('[data-chat-badge]')).toHaveText('8');const before=await loads(page)
 await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.holdLoad=true);await add(page);await expect.poll(()=>loads(page)).toBe(before+1)
 await add(page,second,'A reply after the first snapshot.');await page.evaluate(()=>{const w=window as unknown as Preview;for(let i=0;i<20;i++)w.chatUnreadFixture.emit();w.coachUnreadFixture.releaseLoad()})
 await expect(dialog).toContainText('Your next return drill is ready.');await expect(dialog).toContainText('A reply after the first snapshot.');await expect(dialog.locator('[data-coach-catchup]')).toBeHidden();expect(await loads(page)).toBe(before+2)
 await page.waitForTimeout(2300);expect(await loads(page)).toBe(before+2)
})
test('Coach automatic updates stop for a hidden view and discard an old account response',async({page})=>{
 const dialog=await open(page);await dialog.getByRole('button',{name:'Jump to latest messages',exact:true}).click();await expect(page.locator('[data-chat-badge]')).toHaveText('8');const before=await loads(page)
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))});await add(page);await page.waitForTimeout(2300);expect(await loads(page)).toBe(before)
 await page.evaluate(()=>{const w=window as unknown as Preview;w.coachUnreadFixture.holdLoad=true;Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))});await expect.poll(()=>loads(page)).toBe(before+1)
 await page.evaluate(()=>(window as unknown as Preview).switchNavigationOwner());await expect(dialog).toHaveCount(0);await page.evaluate(()=>(window as unknown as Preview).coachUnreadFixture.releaseLoad());await expect(page.getByText('Your next return drill is ready.',{exact:true})).toHaveCount(0)
})
