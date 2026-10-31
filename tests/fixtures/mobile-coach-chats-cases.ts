import {test,expect,type Page} from '@playwright/test'
const origin='http://127.0.0.1:4283'
type State={enabled:boolean;fail:boolean;removed:boolean;teamFail:boolean;loseSend:boolean;requests:{method:string;student:string;message:string}[];messages:{id:string;body:string}[]}
type Preview=Window&{coachChatFixture:State;switchNavigationOwner:()=>void;oldCoachButton?:HTMLButtonElement}
async function inbox(page:Page,width=390){
 await page.routeWebSocket('**/*',ws=>ws.close())
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 await page.evaluate(()=>(window as unknown as Preview).coachChatFixture.enabled=true)
 await page.locator('.app-navigation [data-screen="teams"]').click()
 await expect(page.locator('[data-coach-chat]')).toHaveCount(2)
}
for(const width of [320,390]){
 test('Coach conversations open from Chats with exact identity and retained team filters at '+width+'px',async({page},info)=>{
  await inbox(page,width)
  await page.getByRole('searchbox',{name:'Find a team'}).fill('Baseline');await page.locator('[data-chats-filter="unread"]').click()
  await expect(page.locator('[data-coach-chat] img')).toHaveCount(0);await expect(page.locator('[data-coach-chat="student-one"]')).toContainText('Alex Rivera <img src=x>')
  expect(await page.evaluate(()=>(window as unknown as Preview).coachChatFixture.requests)).toEqual([{method:'GET',student:'',message:''}])
  await page.getByRole('searchbox',{name:'Find a conversation'}).fill('Jordan');await expect(page.locator('[data-coach-chat]')).toHaveCount(1)
  await page.locator('[data-coach-chat="student-two"]').click()
  const dialog=page.getByRole('dialog',{name:'Coach messages',exact:true})
  await expect(dialog.getByRole('combobox',{name:'Conversation',exact:true})).toHaveValue('student-two');await expect(dialog).toContainText('Ready for our lesson.')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await dialog.getByRole('button',{name:'Close',exact:true}).click()
  await expect(page.locator('[data-coach-chat="student-two"]')).toBeFocused();await expect(page.getByRole('searchbox',{name:'Find a conversation'})).toHaveValue('Jordan')
  await expect(page.getByRole('searchbox',{name:'Find a team'})).toHaveValue('Baseline');await expect(page.locator('[data-chats-filter="unread"]')).toHaveAttribute('aria-pressed','true')
  for(const button of await page.locator('[data-coach-chat]').all()){expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)}
  await page.screenshot({path:info.outputPath('coach-chats-'+width+'.png')})
 })
 test('Coach Chats keeps drafts and recovers a saved send without duplicates at '+width+'px',async({page})=>{
  await inbox(page,width);await page.locator('[data-coach-chat="student-one"]').click()
  const dialog=page.getByRole('dialog',{name:'Coach messages',exact:true});await expect(dialog).toContainText('Bring your return notes.')
  await dialog.getByRole('textbox',{name:'Message',exact:true}).fill('See you at practice')
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).toContainText('Leave this message?');await dialog.getByRole('button',{name:'Keep writing'}).click()
  await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('See you at practice')
  await page.evaluate(()=>(window as unknown as Preview).coachChatFixture.loseSend=true)
  await dialog.getByRole('button',{name:'Send message',exact:true}).click();await expect(dialog).toContainText('Send not confirmed.')
  await dialog.getByRole('button',{name:'Refresh messages',exact:true}).click();await expect(dialog).toContainText('Message sent.');await expect(dialog.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('')
  expect(await page.evaluate(()=>(window as unknown as Preview).coachChatFixture.messages)).toHaveLength(1)
  expect(await page.evaluate(()=>(window as unknown as Preview).coachChatFixture.requests.filter(r=>r.method==='POST'))).toHaveLength(1)
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('[data-coach-chat="student-one"]')).toBeFocused()
 })
}
test('Coach Chats distinguishes an unavailable service and rejects disconnected conversation targets',async({page})=>{
 await inbox(page);await page.evaluate(()=>{const w=window as unknown as Preview;w.oldCoachButton=document.querySelector<HTMLButtonElement>('[data-coach-chat="student-one"]')!;w.coachChatFixture.fail=true})
 await page.getByRole('button',{name:'Refresh conversations',exact:true}).click();await expect(page.locator('[data-coach-chat-status]')).toContainText('unavailable');await expect(page.locator('[data-coach-chat]')).toHaveCount(0)
 await page.evaluate(()=>(window as unknown as Preview).oldCoachButton!.click());await expect(page.getByRole('dialog',{name:'Coach messages',exact:true})).toHaveCount(0)
 await page.evaluate(()=>(window as unknown as Preview).coachChatFixture.fail=false);await page.getByRole('button',{name:'Refresh conversations',exact:true}).click();await expect(page.locator('[data-coach-chat]')).toHaveCount(2)
 await page.evaluate(()=>(window as unknown as Preview).coachChatFixture.removed=true);await page.locator('[data-coach-chat="student-one"]').click()
 const dialog=page.getByRole('dialog',{name:'Coach messages',exact:true});await expect(dialog).toContainText('This conversation is no longer available.');await expect(dialog.getByRole('combobox',{name:'Conversation',exact:true})).toHaveValue('');await expect(dialog.getByRole('button',{name:'Send message',exact:true})).toHaveCount(0)
 expect(await page.evaluate(()=>(window as unknown as Preview).coachChatFixture.requests.filter(r=>r.student))).toHaveLength(0)
})
test('Coach Chats clears private conversation drafts and search on an account change',async({page})=>{
 await inbox(page);await page.getByRole('searchbox',{name:'Find a conversation'}).fill('Alex');await page.locator('[data-coach-chat="student-one"]').click()
 const dialog=page.getByRole('dialog',{name:'Coach messages',exact:true});await expect(dialog).toContainText('Bring your return notes.');await dialog.getByRole('textbox',{name:'Message',exact:true}).fill('Private draft')
 await page.evaluate(()=>(window as unknown as Preview).switchNavigationOwner());await expect(dialog).toHaveCount(0)
 await page.locator('.app-navigation [data-screen="teams"]').click();await expect(page.getByRole('searchbox',{name:'Find a conversation'})).toHaveValue('');await expect(page.locator('[data-coach-chat]')).toHaveCount(2)
})
test('Coach Chats stays available when the team directory fails',async({page})=>{
 await page.goto(origin);await page.evaluate(()=>{const f=(window as unknown as Preview).coachChatFixture;f.enabled=true;f.teamFail=true})
 await page.locator('.app-navigation [data-screen="teams"]').click();await expect(page.getByRole('alert')).toContainText('Can’t open this team.');await expect(page.locator('[data-coach-chat]')).toHaveCount(2)
 await page.locator('[data-coach-chat="student-two"]').click();await expect(page.getByRole('dialog',{name:'Coach messages',exact:true})).toContainText('Ready for our lesson.')
})
