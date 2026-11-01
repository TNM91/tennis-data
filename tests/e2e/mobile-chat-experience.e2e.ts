import {test,expect,type Page,type Locator} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import {practiceRsvpPath} from '../../lib/captain-practice-rsvp'
import type {ChatAction} from '../../mobile/src/team-chat-send'
test.describe.configure({retries:0,timeout:15000})
const origin='http://127.0.0.1:4261',prefix='/__chat-experience/'
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',roomId='33333333-3333-4333-8333-333333333333'
const ownId='44444444-4444-4444-8444-444444444444',pollId='55555555-5555-4555-8555-555555555555',practiceId='66666666-6666-4666-8666-666666666666',messageId='77777777-7777-4777-8777-777777777777'
const scope={teamName:'Review Aces',leagueName:'City Tennis League',flight:'4.0'}
let javascript='',stylesheet='',actions:ChatAction[]=[],messages:Record<string,unknown>[]=[],historyQueries:string[]=[]
const base={senderUserId:other,senderName:'Alex Rivera',kind:'message',deletedAt:'',isMine:false,replyToMessageId:'',card:null,reactions:[]}
test.beforeAll(async()=>{
 const bundled=await build({stdin:{resolveDir:process.cwd(),sourcefile:'chat-experience-fixture.ts',loader:'ts',contents:`
 import {showTeamRoom} from './mobile/src/team-room-view';
 import {navigationHtml} from './mobile/src/app-navigation';
 document.querySelector('.app-navigation')!.innerHTML=navigationHtml();
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
 actions=[];historyQueries=[]
 messages=[
  {...base,id:ownId,senderUserId:owner,senderName:'Jordan Lee',isMine:true,canManageOwn:true,createdAt:'2026-10-28T16:00:00Z',body:'Ready for Saturday!'},
  {...base,id:pollId,createdAt:'2026-10-28T16:01:00Z',body:`Poll: When should we practice?\n1. Saturday morning\n2. Sunday afternoon\nhttps://www.tenaceiq.com/team-room?poll=${pollId}`},
  {...base,id:practiceId,createdAt:'2026-10-28T16:02:00Z',body:`Practice cancelled\nDoubles drills\nReview Aces · City Tennis League · 4.0\nDate: 2026-11-03\nTime: 18:00\nLocation: North courts\nRain expected; bring cover.\nThis occurrence is cancelled. Already-saved future practices are unchanged.\nhttps://www.tenaceiq.com${practiceRsvpPath(practiceId)}`},
  {...base,id:messageId,createdAt:'2026-10-28T16:03:00Z',body:'Who is up for doubles this weekend?',reactions:[{reaction:'laugh',count:2,reacted:false}]}
 ]
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url())
  if(url.origin==='https://www.tenaceiq.com'&&url.pathname.startsWith('/api/team-rooms')){
   expect(request.headers().authorization).toBe('Bearer synthetic-fixture-token')
   if(url.pathname==='/api/team-rooms/search'){historyQueries.push(url.search);return route.fulfill({json:{ok:true,chatSearch:1,roomId,query:url.searchParams.get('q')||'',kind:url.searchParams.get('kind')||'all',beforeCursor:url.searchParams.get('before')||'',nextCursor:'',results:[]}})}
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
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="./style.css"></head><body data-screen="teams"><header class="app-header">TenAceIQ</header><main id="app"></main><nav class="app-navigation" aria-label="Main navigation"></nav><script type="module" src="./app.js"></script></body></html>'})
 })
})
const post=(page:Page,id=messageId)=>page.locator(`[data-chat-message="${id}"]`)
async function hold(target:Locator){
 await target.scrollIntoViewIfNeeded()
 await target.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
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
 await expect(post(page).locator('.chat-message-text')).toBeVisible();await expect(page.locator('.app-navigation')).toHaveCount(1);await expect(page.locator('.app-navigation')).toBeHidden()
 const avatar=post(page).locator('.chat-sender-avatar')
 await expect(avatar).toBeVisible();await expect(avatar).toHaveText('AR');await expect(avatar).toHaveAttribute('aria-hidden','true')
 const avatarBox=await avatar.boundingBox();expect(avatarBox!.x).toBeGreaterThanOrEqual(0)
 await expect(post(page,ownId).locator('.chat-sender-avatar')).toHaveCount(0)
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
 await post(page).getByRole('button',{name:'Message actions for Alex Rivera',exact:true}).click();await expect(page.locator('.chat-message-sheet')).toBeVisible()
 await page.evaluate(()=>{(window as unknown as {fixture:{invalidate:()=>void}}).fixture.invalidate()})
 await page.getByRole('dialog').getByRole('button',{name:'Love: 0 reactions',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 expect(actions.filter(action=>action.action!=='mark_chat_read')).toHaveLength(0)
 await page.reload();await post(page).getByRole('button',{name:'Message actions for Alex Rivera',exact:true}).click();await expect(page.locator('.chat-message-sheet')).toBeVisible()
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

for(const width of [320,390])test(`team timeline keeps dates, filters, actions and a live draft at ${width}px`,async({page},info)=>{
 const second='88888888-8888-4888-8888-888888888888',tomorrow='99999999-9999-4999-8999-999999999999'
 messages=[
  {...base,id:ownId,senderUserId:owner,senderName:'Jordan Lee',isMine:true,canManageOwn:true,createdAt:'2026-10-28T16:00:00Z',body:'Ready for Saturday!'},
  {...base,id:messageId,createdAt:'2026-10-28T16:01:00Z',body:'Meet at the north courts.'},
  {...base,id:second,createdAt:'2026-10-28T16:02:00Z',body:'Unique needle: bring a new can of balls.'},
  {...base,id:tomorrow,createdAt:'2026-10-29T16:03:00Z',body:'The courts are dry today.'}
 ]
 await page.setViewportSize({width,height:width===320?568:844});await page.goto(origin+prefix)
 await page.addStyleTag({content:'html{font-size:20px} .team-bubble p{font-size:20px!important} .chat-room-heading h1{font-size:20px!important}'})
 await expect(post(page,second)).toHaveClass(/team-bubble-continuation/)
 await expect(post(page,second).locator('.chat-sender-avatar')).toBeHidden()
 await expect(post(page,messageId).locator('.chat-sender-avatar')).toBeVisible()
 await expect(post(page,second).locator('.team-message-meta strong')).toHaveClass(/sr-only/)
 await expect(post(page,second).locator('time')).toHaveAttribute('datetime','2026-10-28T16:02:00Z')
 await expect(post(page,second).locator('time')).toHaveAttribute('aria-label',/2026/)
 await expect(page.locator('[data-chat-date-for]')).toHaveCount(2)
 await expect(post(page,tomorrow)).not.toHaveClass(/team-bubble-continuation/)
 const draft=page.locator('#chat-draft');await draft.fill('My unsent team message');await draft.evaluate(el=>{(window as unknown as {timelineInput:Element}).timelineInput=el;(el as HTMLTextAreaElement).setSelectionRange(3,8)})
 await page.getByRole('button',{name:'Find in conversation',exact:true}).click()
 const query=page.locator('#chat-search');await query.fill('Unique needle')
 await expect(page.locator('[data-chat-message]:not([hidden])')).toHaveCount(1)
 await expect(page.locator('[data-chat-date-for]')).toHaveCount(1)
 await expect(post(page,second)).not.toHaveClass(/team-bubble-continuation/)
 await expect(post(page,second).locator('.team-message-meta strong')).not.toHaveClass(/sr-only/)
 await query.fill('No matching message');await expect(page.locator('[data-chat-date-for]')).toHaveCount(0)
 await page.locator('#chat-search-clear').click();await expect(page.locator('[data-chat-date-for]')).toHaveCount(2)
 await page.locator('[data-chat-find-close]').click()
 await expect(post(page,second)).toHaveClass(/team-bubble-continuation/)
 await draft.focus();await draft.evaluate(el=>(el as HTMLTextAreaElement).setSelectionRange(3,8))
 messages.push({...base,id:pollId,createdAt:'2026-10-29T16:04:00Z',body:'See you there!'})
 await page.evaluate(async()=>{await (window as unknown as {fixture:{refresh:()=>Promise<void>}}).fixture.refresh()})
 await expect(post(page,pollId)).toHaveClass(/team-bubble-continuation/)
 expect(await draft.evaluate(el=>el===(window as unknown as {timelineInput:Element}).timelineInput)).toBe(true)
 await expect(draft).toHaveValue('My unsent team message')
 expect(await draft.evaluate(el=>[(el as HTMLTextAreaElement).selectionStart,(el as HTMLTextAreaElement).selectionEnd])).toEqual([3,8])
 await post(page,second).getByRole('button',{name:'Message actions for Alex Rivera',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Alex Rivera',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Close message actions',exact:true}).click()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(await page.locator('.team-conversation').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 expect(actions.filter(action=>action.action!=='mark_chat_read')).toHaveLength(0)
 await post(page,second).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('chat-timeline-large-text.png'),fullPage:true})
})

test('the first unread message keeps its sender when it follows the same teammate',async({page})=>{
 const second='88888888-8888-4888-8888-888888888888'
 messages=[{...base,id:ownId,createdAt:'2026-10-28T16:58:00Z',body:'First message'},
  {...base,id:second,createdAt:'2026-10-28T16:59:00Z',body:'Second message'},
  {...base,id:messageId,createdAt:'2026-10-28T17:01:00Z',body:'Unread message'}]
 await page.goto(origin+prefix)
 await expect(post(page,second)).toHaveClass(/team-bubble-continuation/)
 await expect(post(page).locator('#chat-unread-marker')).toHaveText('Unread messages')
 await expect(post(page)).not.toHaveClass(/team-bubble-continuation/)
 await expect(post(page).locator('.chat-sender-avatar')).toBeVisible()
 await expect(post(page).locator('.team-message-meta strong')).not.toHaveClass(/sr-only/)
 expect(actions.filter(action=>action.action!=='mark_chat_read')).toHaveLength(0)
})

test('a visible date divider never replaces the message reading anchor during live updates',async({page})=>{
 messages=Array.from({length:45},(_,index)=>({...base,id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(index+1).padStart(12,'0'),createdAt:new Date(Date.UTC(2026,9,25+Math.floor(index/15),16,index%15)).toISOString(),body:'Court plans and team practice details '+index}))
 await page.goto(origin+prefix)
 const list=page.locator('.team-conversation');await expect(list.locator('[data-chat-date-for]')).toHaveCount(3)
 await list.evaluate(el=>{const divider=el.querySelectorAll('[data-chat-date-for]')[1];el.scrollTop+=divider.getBoundingClientRect().top-el.getBoundingClientRect().top})
 const reading=()=>list.evaluate(el=>{const top=el.getBoundingClientRect().top,item=Array.from(el.querySelectorAll<HTMLElement>('[data-chat-message]')).find(row=>!row.hidden&&row.getBoundingClientRect().bottom>top+1)!;return {id:item.dataset.chatMessage,delta:item.getBoundingClientRect().top-top}})
 const before=await reading()
 messages.push({...base,id:messageId,createdAt:'2026-10-28T16:00:00Z',body:'A newer day below your reading position'})
 await page.evaluate(async()=>{await (window as unknown as {fixture:{refresh:()=>Promise<void>}}).fixture.refresh()})
 await expect(list.locator('[data-chat-date-for]')).toHaveCount(4)
 const after=await reading();expect(after.id).toBe(before.id);expect(Math.abs(after.delta-before.delta)).toBeLessThan(2)
 expect(actions.filter(action=>action.action!=='mark_chat_read')).toHaveLength(0)
})

for(const width of [320,390])test(`quick find keeps links, local transport, history and drafts at ${width}px`,async({page},info)=>{
 messages=[{...base,id:ownId,senderUserId:owner,senderName:'Jordan Lee',isMine:true,canManageOwn:true,createdAt:'2026-10-28T16:00:00Z',body:'Ready for Saturday'},
  {...base,id:messageId,createdAt:'2026-10-28T16:01:00Z',body:'İ 🎾 Try [a+b]. See https://example.com/court?rep=2&side=deuce, then <img src=x>.'},
  {...base,id:pollId,createdAt:'2026-10-28T16:02:00Z',body:'Another [A+B] from a teammate'}]
 await page.setViewportSize({width,height:width===320?568:844});await page.goto(origin+prefix)
 await page.addStyleTag({content:'html{font-size:20px}.team-bubble p{font-size:20px!important}'})
 const draft=page.locator('#chat-draft');await draft.fill('My unsent reply');const draftNode=await draft.elementHandle()
 const reads:string[]=[];page.on('request',request=>{if(new URL(request.url()).origin==='https://www.tenaceiq.com')reads.push(request.url())})
 const toggle=page.getByRole('button',{name:'Find in conversation',exact:true});await toggle.click()
 await expect(toggle).toHaveAttribute('aria-expanded','true');const query=page.getByRole('searchbox',{name:'Find a message',exact:true}),node=await query.elementHandle()
 const before=reads.length,acknowledgements=actions.filter(action=>action.action==='mark_chat_read').length
 await query.fill('[a+b]');await expect(page.locator('[data-chat-message]:not([hidden])')).toHaveCount(2)
 await expect(post(page).locator('mark[data-chat-highlight]')).toHaveText('[a+b]')
 await query.press('Enter');expect(reads).toHaveLength(before);expect(historyQueries).toHaveLength(0)
 await query.fill('Jordan');await expect(post(page,ownId).locator('.team-message-meta strong mark')).toHaveText('Jordan')
 await query.fill('court?rep=2&side');const link=post(page).locator('[data-chat-url]'),linkNode=await link.elementHandle(),url=await link.getAttribute('data-chat-url')
 await expect(link.locator('mark')).toHaveText('court?rep=2&side');await query.fill('deuce')
 expect(await linkNode!.evaluate(el=>el===document.querySelector('[data-chat-url]'))).toBe(true);await expect(link).toHaveAttribute('data-chat-url',url!)
 await link.click();const review=page.getByRole('dialog',{name:'Open shared link',exact:true});await expect(review.locator('.chat-link-destination')).toHaveText(url!);await review.getByRole('button',{name:'Cancel',exact:true}).click()
 await query.fill('<img');await expect(post(page).locator('mark')).toHaveText('<img');await expect(post(page).locator('img')).toHaveCount(0)
 await query.fill('[A+B]');await query.evaluate(el=>(el as HTMLInputElement).setSelectionRange(1,4))
 messages.push({...base,id:practiceId,createdAt:'2026-10-28T16:04:00Z',body:'[A+B] just arrived'})
 await page.evaluate(async()=>{await (window as unknown as {fixture:{refresh:()=>Promise<void>}}).fixture.refresh()})
 await expect(post(page,practiceId)).toBeVisible();expect(await node!.evaluate(el=>el===document.querySelector('#chat-search'))).toBe(true)
 expect(await query.evaluate(el=>[(el as HTMLInputElement).selectionStart,(el as HTMLInputElement).selectionEnd])).toEqual([1,4])
 expect(actions.filter(action=>action.action==='mark_chat_read')).toHaveLength(acknowledgements)
 expect(await draftNode!.evaluate(el=>el===document.querySelector('#chat-draft'))).toBe(true);await expect(draft).toHaveValue('My unsent reply')
 await page.getByRole('button',{name:'Search older history',exact:true}).click();const history=page.getByRole('dialog',{name:'Search team history',exact:true})
 await expect(history.locator('#history-query')).toHaveValue('[A+B]');await expect.poll(()=>historyQueries.length).toBe(1)
 expect(new URLSearchParams(historyQueries[0]).get('q')).toBe('[A+B]')
 await history.getByRole('button',{name:'Back to conversation',exact:true}).click();await expect(page.locator('#chat-history-open')).toBeFocused()
 await expect(query).toHaveValue('[A+B]');expect(await node!.evaluate(el=>el===document.querySelector('#chat-search'))).toBe(true)
 await query.press('Escape');await expect(toggle).toBeFocused();await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(page.locator('#chat-active-filter')).toBeVisible()
 await toggle.click();await expect(query).toHaveValue('[A+B]');await page.locator('#chat-search-clear').click();await expect(page.locator('mark[data-chat-highlight]')).toHaveCount(0)
 await page.locator('#chat-filter').selectOption('media');await expect(page.locator('[data-chat-date-for]')).toHaveCount(0);await page.locator('#chat-filter').selectOption('all')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(await page.locator('.chat-quick-find').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 const box=await draft.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
 expect(actions.filter(action=>action.action!=='mark_chat_read')).toHaveLength(0)
 await page.screenshot({path:info.outputPath('chat-quick-find-large-text.png'),fullPage:true})
})

test('a one-character quick query never starts an older-history request',async({page})=>{
 await page.goto(origin+prefix);await page.getByRole('button',{name:'Find in conversation',exact:true}).click()
 await page.locator('#chat-search').fill('a');await page.locator('#chat-history-open').click()
 const history=page.getByRole('dialog',{name:'Search team history',exact:true});await expect(history.locator('#history-status')).toContainText('two or more characters')
 expect(historyQueries).toHaveLength(0);await history.getByRole('button',{name:'Back to conversation',exact:true}).click()
 await expect(page.locator('#chat-search')).toHaveValue('a')
})

for(const failure of [false,true])test(`opening an older result ${failure?'retains finding on failure':'reveals the confirmed message outside the filter'}`,async({page})=>{
 await page.goto(origin+prefix);await page.locator('#chat-draft').fill('Keep my reply')
 const draftNode=await page.locator('#chat-draft').elementHandle()
 await page.getByRole('button',{name:'Find in conversation',exact:true}).click();await page.locator('#chat-search').fill('Saturday')
 await page.route('**/api/team-rooms/search?*',route=>{const u=new URL(route.request().url());return route.fulfill({json:{ok:true,chatSearch:1,roomId,query:u.searchParams.get('q'),kind:'all',beforeCursor:'',nextCursor:'',results:[{id:messageId,senderName:'Alex Rivera',preview:'Saturday practice',kind:'message',createdAt:'2026-10-28T16:03:00Z',photoMimeType:''}]}})})
 await page.route('**/api/team-rooms/chat?*',route=>{
  const u=new URL(route.request().url());if(!u.searchParams.has('focus'))return route.fallback()
  expect(u.searchParams.get('focus')).toBe(messageId)
  if(failure)return route.fulfill({status:503,json:{ok:false}})
  return route.fulfill({json:{ok:true,chatUpdate:true,beforeCursor:'',nextCursor:'',focusMessageId:messageId,focusCursor:'2026-10-28T16:03:00Z|'+messageId,room:{...scope,id:roomId,messages:[{...base,id:messageId,createdAt:'2026-10-28T16:03:00Z',body:'Practice moved to Sunday'}],lastReadAt:'2026-10-28T17:00:00Z',blockedUserIds:[]}}})
 })
 const acknowledgements=actions.filter(action=>action.action==='mark_chat_read').length
 await page.locator('#chat-history-open').click();await page.getByRole('button',{name:'Open in chat',exact:true}).click()
 if(failure){
  await expect(page.locator('#chat-history-status')).toContainText('could not be opened')
  await expect(page.locator('#chat-quick-find-panel')).toBeVisible();await expect(page.locator('#chat-search')).toHaveValue('Saturday')
  await expect(post(page,ownId)).toBeVisible();await expect(post(page)).toBeHidden()
 }else{
  await expect(post(page).locator('.chat-message-text')).toHaveText('Practice moved to Sunday');await expect(post(page)).toBeVisible();await expect(post(page)).toBeFocused()
  await expect(page.locator('#chat-quick-find-panel')).toBeHidden();await expect(page.locator('#chat-active-filter')).toBeHidden();await expect(page.locator('#chat-search')).toHaveValue('')
  await page.getByRole('button',{name:'Find in conversation',exact:true}).click();await page.locator('#chat-search').fill('No match')
  await page.locator('#chat-latest').click();await expect(post(page).locator('.chat-message-text')).toHaveText('Who is up for doubles this weekend?')
  await expect(page.locator('#chat-quick-find-panel')).toBeHidden();await expect(page.locator('#chat-search')).toHaveValue('');await expect(page.locator('[data-chat-message]:not([hidden])')).toHaveCount(4)
 }
 if(failure)expect(await draftNode!.evaluate(el=>el===document.querySelector('#chat-draft'))).toBe(true)
 await expect(page.locator('#chat-draft')).toHaveValue('Keep my reply')
 expect(actions.filter(action=>action.action==='mark_chat_read')).toHaveLength(acknowledgements)
 expect(actions.filter(action=>action.action!=='mark_chat_read')).toHaveLength(0)
})

test('same-room full refresh retains the finder input, selection and draft',async({page})=>{
 await page.goto(origin+prefix);await page.locator('#chat-draft').fill('Retain this draft')
 await page.getByRole('button',{name:'Find in conversation',exact:true}).click();const query=page.locator('#chat-search');await query.fill('Saturday')
 const node=await query.elementHandle()
 let release!:()=>void,started!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve}),requested=new Promise<void>(resolve=>{started=resolve})
 await page.route(/\/api\/team-rooms\?/,async route=>{started();await pending;return route.fallback()})
 await page.locator('.chat-room-options>summary').click();await page.locator('.chat-room-extra>summary').click();await page.locator('#refresh-team').click();await requested
 await page.locator('.chat-room-options>summary').click();await query.focus();await query.evaluate(el=>(el as HTMLInputElement).setSelectionRange(1,5));messages[0].body='Saturday confirmed after refresh';release()
 await expect(post(page,ownId).locator('.chat-message-text')).toHaveText('Saturday confirmed after refresh')
 await expect.poll(()=>node!.evaluate(el=>el===document.querySelector('#chat-search')&&document.activeElement===el&&(el as HTMLInputElement).selectionStart===1&&(el as HTMLInputElement).selectionEnd===5)).toBe(true)
 await expect(page.locator('.chat-room-options')).not.toHaveAttribute('open','')
 await expect(page.locator('#chat-draft')).toHaveValue('Retain this draft')
 await expect(query).toHaveValue('Saturday');await expect(post(page,ownId)).toBeVisible();await expect(post(page)).toBeHidden()
})
