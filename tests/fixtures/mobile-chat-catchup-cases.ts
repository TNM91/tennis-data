import {test,expect,type Page} from '@playwright/test'
const origin='http://127.0.0.1:4283',roomId='33333333-3333-4333-8333-333333333333'
type Preview=Window&{chatUnreadFixture:{total:number;fail:boolean;detailed:boolean;secondTeam:boolean;denyRoom:boolean;opened:string[];roomName:string;emit:()=>void};navigationFixture:{requests:number};switchNavigationOwner:()=>void;oldUnreadButton?:HTMLButtonElement}
async function inbox(page:Page,width:number){
 await page.setViewportSize({width,height:844});await page.goto(origin+'/?large=1')
 await page.evaluate(()=>{const f=(window as unknown as Preview).chatUnreadFixture;f.detailed=true;f.secondTeam=true;f.emit()})
 await page.locator('.app-navigation [data-screen="teams"]').click()
 await expect(page.locator('.chats-team-card')).toHaveCount(2);await expect(page.locator('[data-inbox-room]')).toHaveCount(2)
}
for(const width of [320,390]){
 test('Chats finds exact teams and opens unread rooms without losing inbox filters at '+width+'px',async({page},info)=>{
  await inbox(page,width)
  const search=page.getByRole('searchbox',{name:'Find a team'}),all=page.locator('[data-chats-filter="all"]'),unread=page.locator('[data-chats-filter="unread"]')
  await expect(page.locator('.chats-unread-rooms img')).toHaveCount(0);await expect(page.locator('[data-room-label]').last()).toHaveText('Practice & match prep <img src=x>')
  const before=await page.evaluate(()=>(window as unknown as Preview).navigationFixture.requests)
  await search.fill('Evening');await expect(page.locator('[data-chat-team-row]:visible')).toHaveCount(1)
  await unread.click();await expect(page.locator('[data-chat-team-row]:visible')).toHaveCount(0);await expect(page.locator('[data-chats-status]')).toHaveText('No teams match your search.')
  await all.click();await search.fill('Baseline');await unread.click();await expect(page.locator('[data-chat-team-row]:visible')).toHaveCount(1)
  expect(await page.evaluate(()=>(window as unknown as Preview).navigationFixture.requests)).toBe(before)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  for(const button of await page.locator('.chats-unread-room').all()){const box=await button.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)}
  await page.screenshot({path:info.outputPath('chat-catchup-'+width+'.png')})
  await page.locator('[data-inbox-room="'+roomId+'"]').click();await expect(page.locator('#open-team-rooms')).toContainText('Practice & match prep <img src=x>')
  const named=new URLSearchParams(await page.evaluate(()=>(window as unknown as Preview).chatUnreadFixture.opened.at(-1)!))
  expect(Object.fromEntries(named)).toEqual({read:'0',team:'Baseline Aces',league:'City League',flight:'4.0',chatRoom:roomId})
  await page.getByRole('button',{name:'All team chats',exact:true}).click();await expect(search).toHaveValue('Baseline');await expect(unread).toHaveAttribute('aria-pressed','true')
  await page.locator('[data-inbox-room=""]').click();await expect(page.locator('#open-team-rooms')).toContainText('General')
  expect(new URLSearchParams(await page.evaluate(()=>(window as unknown as Preview).chatUnreadFixture.opened.at(-1)!)).has('chatRoom')).toBe(false)
  await page.getByRole('button',{name:'All team chats',exact:true}).click();await search.focus()
  await page.evaluate(()=>{const f=(window as unknown as Preview).chatUnreadFixture;f.total=2;f.emit()})
  await expect(page.locator('[data-inbox-room="'+roomId+'"]')).toHaveCount(0);await expect(page.locator('[data-inbox-room=""] [data-room-count]')).toHaveText('2');await expect(search).toBeFocused();await expect(search).toHaveValue('Baseline')
 })
 test('Chats distinguishes unavailable counts from caught up and rejects old room actions at '+width+'px',async({page})=>{
  await inbox(page,width);await page.locator('[data-chats-filter="unread"]').click()
  await page.evaluate(()=>{const w=window as unknown as Preview;w.oldUnreadButton=document.querySelector<HTMLButtonElement>('[data-inbox-room="33333333-3333-4333-8333-333333333333"]')!;w.chatUnreadFixture.fail=true;w.chatUnreadFixture.emit()})
  await expect(page.locator('[data-chats-status]')).toHaveText('Unread counts unavailable. Refresh teams to try again.');await expect(page.locator('[data-inbox-room]')).toHaveCount(0)
  await page.evaluate(()=>(window as unknown as Preview).oldUnreadButton!.click());expect(await page.evaluate(()=>(window as unknown as Preview).chatUnreadFixture.opened.length)).toBe(0)
  await page.evaluate(()=>{const f=(window as unknown as Preview).chatUnreadFixture;f.fail=false;f.total=0;f.emit()})
  await expect(page.locator('[data-chats-status]')).toHaveText('You’re all caught up.')
  await page.evaluate(()=>{const f=(window as unknown as Preview).chatUnreadFixture;f.total=7;f.emit()});await expect(page.locator('[data-inbox-room]')).toHaveCount(2)
  await page.locator('[data-inbox-room="'+roomId+'"]').focus();await page.evaluate(()=>{const f=(window as unknown as Preview).chatUnreadFixture;f.total=2;f.emit()});await expect(page.locator('[data-open-team-chat="0"]')).toBeFocused()
  await page.evaluate(()=>{const f=(window as unknown as Preview).chatUnreadFixture;f.total=7;f.emit()});await expect(page.locator('[data-inbox-room]')).toHaveCount(2)
  await page.evaluate(()=>(window as unknown as Preview).chatUnreadFixture.denyRoom=true);await page.locator('[data-inbox-room="'+roomId+'"]').click();await expect(page.locator('[role="alert"]')).toContainText('team membership');await expect(page.locator('[data-inbox-room]')).toHaveCount(0)
 })
}

test('Chats keeps equal team names separated by league and clears filters on account change',async({page})=>{
 await inbox(page,390);const search=page.getByRole('searchbox',{name:'Find a team'})
 await search.fill('Evening');await page.locator('[data-open-team-chat="1"]').click();await expect(page.locator('#open-team-rooms')).toContainText('General')
 expect(new URLSearchParams(await page.evaluate(()=>(window as unknown as Preview).chatUnreadFixture.opened.at(-1)!)).get('league')).toBe('Evening League')
 await page.getByRole('button',{name:'All team chats',exact:true}).click();await expect(search).toHaveValue('Evening')
 await page.evaluate(()=>(window as unknown as Preview).switchNavigationOwner());await page.locator('.app-navigation [data-screen="teams"]').click();await expect(search).toHaveValue('');await expect(page.locator('[data-chats-filter="all"]')).toHaveAttribute('aria-pressed','true')
})
