import {test,expect,type Page,type Locator} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import type {ChatAction} from '../../mobile/src/team-chat-send'
test.describe.configure({retries:0,timeout:15000})
const origin='http://127.0.0.1:4261',prefix='/__chat-experience/'
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',roomId='33333333-3333-4333-8333-333333333333'
const ownId='44444444-4444-4444-8444-444444444444',pollId='55555555-5555-4555-8555-555555555555',practiceId='66666666-6666-4666-8666-666666666666',messageId='77777777-7777-4777-8777-777777777777'
const scope={teamName:'Review Aces',leagueName:'City Tennis League',flight:'4.0'}
let javascript='',stylesheet='',actions:ChatAction[]=[],messages:Record<string,unknown>[]=[]
const base={senderUserId:other,senderName:'Alex Rivera',kind:'message',deletedAt:'',isMine:false,replyToMessageId:'',card:null,reactions:[]}
test.beforeAll(async()=>{
 const bundled=await build({stdin:{resolveDir:process.cwd(),sourcefile:'chat-experience-fixture.ts',loader:'ts',contents:`
 import {showTeamRoom} from './mobile/src/team-room-view';
 const owner=${JSON.stringify(owner)},scope=${JSON.stringify(scope)};
 let active=true;(window as any).fixture={};
 const client={auth:{getSession:async()=>({error:null,data:{session:{user:{id:owner},access_token:'synthetic-fixture-token'}}})}};
 const view=showTeamRoom(document.querySelector('#app')!,client as never,owner,()=>active,scope);
 Object.assign((window as any).fixture,{dispose:()=>{view.dispose();active=false},invalidate:()=>{active=false},back:()=>view.back()});
 `},bundle:true,platform:'browser',format:'esm',outfile:'chat-experience-fixture.js',write:false,jsx:'automatic',loader:{'.module.css':'local-css'},plugins:[{name:'synthetic-live-signals',setup(builder){
 // Replace only the live transport. The real room parser, actions, auth checks and rendering remain in use.
 builder.onResolve({filter:/^\.\/team-chat-live$/},()=>({path:'synthetic-live',namespace:'fixture'}))
 builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'ts',contents:`export function watchTeamChat(_client,_owner,_room,_current,refresh,status){window.fixture.refresh=refresh;status('live');return {isForeground:()=>true,retry:()=>{},dispose:()=>{}}}` }))
 }}]})
 javascript=bundled.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 stylesheet=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css'].map(file=>readFile('mobile/bundled/'+file,'utf8')))).join('\n')
})
test.beforeEach(async({page})=>{
 actions=[]
 messages=[
  {...base,id:ownId,senderUserId:owner,senderName:'Jordan Lee',isMine:true,canManageOwn:true,createdAt:'2026-10-28T16:00:00Z',body:'Ready for Saturday!'},
  {...base,id:pollId,createdAt:'2026-10-28T16:01:00Z',body:`Poll: When should we practice?\n1. Saturday morning\n2. Sunday afternoon\nhttps://www.tenaceiq.com/team-room?poll=${pollId}`},
  {...base,id:practiceId,createdAt:'2026-10-28T16:02:00Z',body:`Practice cancelled\nDoubles drills\nReview Aces · City Tennis League · 4.0\nDate: 2026-11-03\nTime: 18:00\nLocation: North courts\nRain expected; bring cover.\nThis occurrence is cancelled. Already-saved future practices are unchanged.\nhttps://www.tenaceiq.com/practice/${practiceId}`},
  {...base,id:messageId,createdAt:'2026-10-28T16:03:00Z',body:'Who is up for doubles this weekend?',reactions:[{reaction:'laugh',count:2,reacted:false}]}
 ]
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url())
  if(url.origin==='https://www.tenaceiq.com'&&url.pathname.startsWith('/api/team-rooms')){
   expect(request.headers().authorization).toBe('Bearer synthetic-fixture-token')
   if(page.url().includes('photo=1'))messages[messages.length-1].attachment={size:4,mimeType:'image/jpeg'}
   const room={...scope,id:roomId,subject:scope.teamName,messages,members:[{id:owner,name:'Jordan Lee',roles:['captain']},{id:other,name:'Alex Rivera',roles:['player']}],nextScheduledMatch:null,activeCardId:'',muted:false,chatReady:true,lastReadAt:'2026-10-28T17:00:00Z',blockedMembers:[],blockedUserIds:[],canManage:!page.url().includes('member=1')}
   if(request.method()==='GET')return route.fulfill({json:url.pathname.endsWith('/chat')?{ok:true,chatUpdate:true,room,nextCursor:'',beforeCursor:''}:{ok:true,teams:[scope],room}})
   const action=request.postDataJSON() as ChatAction;actions.push(action)
   if(action.action==='set_chat_reaction'){
    const message=messages.find(message=>message.id===action.messageId)!
    const reactions=message.reactions as {reaction:string;count:number;reacted:boolean}[],previous=reactions.find(item=>item.reaction===action.reaction)
    message.reactions=[...reactions.filter(item=>item.reaction!==action.reaction),{reaction:action.reaction,count:(previous?.count||0)+(action.active?1:-1),reacted:action.active}]
    return route.fulfill({json:{ok:true,messageId:action.messageId,reaction:action.reaction,active:action.active}})
   }
   if(action.action==='send'){
    const message={...base,id:action.clientMessageId,senderUserId:owner,senderName:'Jordan Lee',isMine:true,canManageOwn:true,body:action.body,mentions:action.mentions||[],replyToMessageId:action.replyToMessageId,createdAt:'2026-10-28T16:04:00Z'}
    messages.push(message);return route.fulfill({json:{ok:true,message}})
   }
   if(action.action==='read_chat_photo')return route.fulfill({json:{ok:true,messageId:action.messageId,mimeType:'image/jpeg',base64:'AAAA'}})
   if(action.action==='mark_chat_read')return route.fulfill({json:{ok:true}})
   throw Error('Unexpected chat mutation: '+action.action)
  }
  if(url.origin!==origin||!url.pathname.startsWith(prefix))return route.abort()
  if(url.pathname.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:stylesheet})
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="./style.css"></head><body><main id="app"></main><script type="module" src="./app.js"></script></body></html>'})
 })
})
const post=(page:Page,id=messageId)=>page.locator(`[data-chat-message="${id}"]`)
async function hold(target:Locator){
 await target.scrollIntoViewIfNeeded()
 await target.dispatchEvent('pointerdown',{isPrimary:true,button:0,pointerId:1,clientX:80,clientY:200,pointerType:'touch'})
 await target.page().waitForTimeout(550)
 await target.dispatchEvent('pointerup',{isPrimary:true,button:0,pointerId:1,pointerType:'touch'})
}
async function bounded(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 const sheet=page.locator('.chat-message-sheet'),box=await sheet.boundingBox()
 expect(box).toBeTruthy();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
 expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
 expect(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
}
for(const width of [320,390])test(`hold, react and reply through the real conversation at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:width===320?568:844});await page.goto(origin+prefix)
 await expect(post(page).locator('.chat-message-text')).toBeVisible()
 await hold(post(page).locator('.chat-message-text'))
 const sheet=page.getByRole('dialog',{name:'Alex Rivera',exact:true})
 await expect(sheet).toBeVisible();await expect(sheet.locator('.chat-press-reactions button')).toHaveCount(6)
 await expect(sheet.getByRole('button',{name:'Edit',exact:true})).toHaveCount(0)
 await expect(sheet.getByRole('button',{name:'Report',exact:true})).toBeVisible()
 await bounded(page);await page.screenshot({path:info.outputPath('chat-experience-message-actions.png'),fullPage:true})
 await sheet.getByRole('button',{name:'Love: 0 reactions',exact:true}).click()
 await expect(page.locator('.chat-message-sheet')).toHaveCount(0)
 await expect(post(page).getByRole('button',{name:'Love: 1 reactions',exact:true})).toBeVisible()
 expect(actions.filter(action=>action.action==='set_chat_reaction')).toEqual([{...scope,action:'set_chat_reaction',messageId,reaction:'heart',active:true}])
 const trigger=post(page).getByRole('button',{name:'Message actions for Alex Rivera',exact:true})
 await trigger.focus();await page.keyboard.press('Enter')
 await sheet.getByRole('button',{name:'Reply',exact:true}).click()
 await expect(page.locator('.chat-reply-context')).toContainText('Replying to Alex Rivera')
 await expect(page.getByLabel('Message your team',{exact:true})).toBeFocused()
 expect(actions.filter(action=>action.action==='send')).toHaveLength(0)
 await page.getByLabel('Message your team',{exact:true}).fill('See you there!')
 await page.getByRole('button',{name:'Send',exact:true}).click()
 await expect(page.locator('.team-conversation')).toContainText('See you there!')
 const sends=actions.filter(action=>action.action==='send')
 expect(sends).toHaveLength(1);expect(sends[0]).toMatchObject({...scope,body:'See you there!',replyToMessageId:messageId})
 await page.screenshot({path:info.outputPath('chat-experience-conversation.png'),fullPage:true})
})
test('movement, scroll, cancellation and a short tap never open actions or post',async({page})=>{
 await page.goto(origin+prefix);const target=post(page).locator('.chat-message-text');await expect(target).toBeVisible()
 for(const cancel of ['pointermove','pointercancel','scroll','pointerup']){
  await target.dispatchEvent('pointerdown',{isPrimary:true,button:0,pointerId:1,clientX:80,clientY:200,pointerType:'touch'})
  if(cancel==='scroll')await page.locator('.team-conversation').dispatchEvent('scroll')
  else await target.dispatchEvent(cancel,{isPrimary:true,button:0,pointerId:1,clientX:110,clientY:240,pointerType:'touch'})
  await page.waitForTimeout(550);await expect(page.locator('.chat-message-sheet')).toHaveCount(0)
 }
 expect(actions.filter(action=>action.action!=='mark_chat_read')).toHaveLength(0)
})
test('own actions, dismissal, stale sessions and disposal preserve guarded writes',async({page})=>{
 await page.goto(origin+prefix)
 await post(page,ownId).getByRole('button',{name:'Message actions for Jordan Lee',exact:true}).click()
 await expect(page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true})).toBeVisible()
 await expect(page.getByRole('dialog').getByRole('button',{name:'Remove',exact:true})).toBeVisible()
 await expect(page.getByRole('dialog').getByRole('button',{name:'Block',exact:true})).toHaveCount(0)
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(post(page,ownId).getByRole('button',{name:'Message actions for Jordan Lee',exact:true})).toBeFocused()
 await hold(post(page).locator('.chat-message-text'))
 await page.evaluate(()=>{(window as unknown as {fixture:{invalidate:()=>void}}).fixture.invalidate()})
 await page.getByRole('dialog').getByRole('button',{name:'Love: 0 reactions',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 expect(actions.filter(action=>action.action!=='mark_chat_read')).toHaveLength(0)
 await page.reload();await hold(post(page).locator('.chat-message-text'))
 await page.evaluate(()=>{(window as unknown as {fixture:{dispose:()=>void}}).fixture.dispose()})
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await post(page).locator('.chat-message-text').dispatchEvent('pointerdown',{isPrimary:true,button:0,pointerId:1,pointerType:'touch'})
 await page.waitForTimeout(550);await expect(page.getByRole('dialog')).toHaveCount(0)
})
for(const width of [320,390])test(`media, team activities and preserved plan context at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:width===320?568:844});await page.goto(origin+prefix)
 await expect(post(page,pollId).locator('.chat-plan-card')).toContainText('When should we practice?')
 await expect(post(page,practiceId).locator('.chat-plan-card')).toContainText('Practice cancelled')
 await expect(post(page,practiceId).locator('.chat-plan-caption')).toContainText('future practices are unchanged')
 await post(page,pollId).scrollIntoViewIfNeeded()
 await page.screenshot({path:info.outputPath('chat-experience-team-cards.png'),fullPage:true})
 const trigger=page.locator('summary[aria-label="Add to message"]');await trigger.click()
 const menu=page.locator('.chat-attachment-menu')
 await expect(menu.getByRole('button',{name:'Choose photo',exact:true})).toBeVisible()
 await expect(menu.getByRole('button',{name:'GIFs',exact:true})).toBeVisible()
 await expect(menu.locator('[data-chat-create-poll]')).toBeVisible()
 await expect(menu.locator('[data-chat-plan-practice]')).toHaveCount(1)
 expect(await menu.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 await page.screenshot({path:info.outputPath('chat-experience-attachments.png'),fullPage:true})
 await menu.getByRole('button',{name:'Close attachments',exact:true}).click();await expect(trigger).toBeFocused()
 expect(actions.filter(action=>action.action!=='mark_chat_read')).toHaveLength(0)
 await page.goto(origin+prefix+'?member=1');await trigger.click()
 await expect(menu.locator('[data-chat-plan-practice]')).toHaveCount(0)
 await expect(menu.getByRole('button',{name:'Match availability',exact:true})).toBeVisible()
 await expect(menu.getByRole('button',{name:'Request match availability',exact:true})).toHaveCount(0)
 await expect(menu.locator('[data-chat-create-poll]')).toBeVisible()
})

test('holding a photo suppresses the release tap while a fresh tap still opens it',async({page})=>{
 await page.goto(origin+prefix+'?photo=1')
 const photo=post(page).locator('[data-chat-photo]');await expect(photo).toBeVisible()
 await hold(photo);await expect(page.locator('.chat-message-sheet')).toBeVisible()
 await photo.dispatchEvent('click',{bubbles:true,detail:1})
 await expect(page.getByRole('dialog',{name:'Team photo',exact:true})).toHaveCount(0)
 expect(actions.filter(action=>action.action==='read_chat_photo'&&!action.photoPreview)).toHaveLength(0)
 await page.getByRole('button',{name:'Close message actions',exact:true}).click()
 await photo.click();await expect(page.getByRole('dialog',{name:'Team photo',exact:true})).toBeVisible()
 expect(actions.filter(action=>action.action==='read_chat_photo'&&!action.photoPreview)).toHaveLength(1)
 await page.getByRole('button',{name:'Close photo',exact:true}).click()
})
test('a live signal waits for the message menu to close before replacing its content',async({page})=>{
 await page.goto(origin+prefix);await hold(post(page).locator('.chat-message-text'))
 messages[messages.length-1].body='Updated team message'
 const reads: string[]=[];page.on('request',request=>{if(new URL(request.url()).pathname==='/api/team-rooms/chat')reads.push(request.url())})
 await page.evaluate(async()=>{await (window as unknown as {fixture:{refresh:()=>Promise<void>}}).fixture.refresh()})
 await expect(page.locator('.chat-message-sheet')).toBeVisible();expect(reads).toHaveLength(0)
 await expect(post(page).locator('.chat-message-text')).toHaveText('Who is up for doubles this weekend?')
 await page.getByRole('button',{name:'Close message actions',exact:true}).click()
 await expect(post(page).locator('.chat-message-text')).toHaveText('Updated team message')
 expect(reads).toHaveLength(1)
 expect(actions.filter(action=>action.action!=='mark_chat_read')).toHaveLength(0)
})
