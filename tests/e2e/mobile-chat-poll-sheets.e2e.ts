import {test,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import type {PollAction,TeamPoll} from '../../lib/team-poll-contract'
const origin='http://127.0.0.1:4260',prefix='/__chat-poll-fixture/'
const roomId='33333333-3333-4333-8333-333333333333',owner='synthetic-owner'
const scope={teamName:'Review Aces / The Other Players',leagueName:'City Tennis League',flight:'4.0'}
let javascript='',stylesheet='',actions:PollAction[]=[],saved:TeamPoll|null=null,interruptCreate=false

test.beforeAll(async()=>{
 const bundled=await build({stdin:{resolveDir:process.cwd(),sourcefile:'chat-poll-fixture.ts',loader:'ts',contents:`
 import {openTeamPoll} from './mobile/src/team-polls-view';
 import {chatRoomHeaderHtml,bindTeamToolsClose} from './mobile/src/chat-room-chrome';
 const scope=${JSON.stringify(scope)},owner=${JSON.stringify(owner)},roomId=${JSON.stringify(roomId)};
 const client={auth:{getSession:async()=>({error:null,data:{session:{user:{id:owner},access_token:'synthetic-fixture-token'}}})}};
 const app=document.querySelector('#app');
 app.innerHTML=chatRoomHeaderHtml({...scope,canManage:true,muted:false},[scope],'Conversation',false)+'<button id="open-poll" type="button">Create a poll</button>';
 bindTeamToolsClose(app);
 document.querySelector('#open-poll').onclick=()=>openTeamPoll(client as never,owner,scope,roomId,()=>true,changed=>document.body.dataset.pollChanged=String(changed));
 `},bundle:true,platform:'browser',format:'esm',outfile:'chat-poll-fixture.js',write:false})
 javascript=bundled.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 stylesheet=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css'].map(file=>readFile('mobile/bundled/'+file,'utf8')))).join('\n')
})

test.beforeEach(async({page})=>{
 actions=[];saved=null;interruptCreate=false
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url())
  if(url.origin==='https://www.tenaceiq.com'&&url.pathname==='/api/team-rooms/polls'){
   expect(request.headers().authorization).toBe('Bearer synthetic-fixture-token')
   expect(url.searchParams.get('room')).toBe(roomId)
   const action=request.postDataJSON() as PollAction
   actions.push(action)
   if(action.action==='create'){
    saved={id:action.id,roomId,question:action.question,options:action.options.map(label=>({label,count:0})),total:0,mine:null,revision:0,closed:false,canClose:true}
    if(interruptCreate){interruptCreate=false;return route.abort('failed')}
   }
   if(!saved)return route.fulfill({status:404,json:{ok:false}})
   return route.fulfill({json:{ok:true,teamPoll:1,owner,scope,poll:saved}})
  }
  if(url.origin!==origin||!url.pathname.startsWith(prefix))return route.abort()
  if(url.pathname.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:stylesheet})
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="./style.css"></head><body class="native-chat-conversation"><main id="app"></main><script type="module" src="./app.js"></script></body></html>'})
 })
})
async function fillPoll(page:Page){
 await page.getByRole('button',{name:'Create a poll',exact:true}).click()
 await page.getByLabel('Question',{exact:true}).fill('When should we practice?')
 await page.getByLabel('Option 1',{exact:true}).fill('Saturday morning')
 await page.getByLabel('Option 2',{exact:true}).fill('Sunday afternoon')
}
async function expectBounded(page:Page,bottom=page.viewportSize()!.height){
 const dialog=page.getByRole('dialog'),action=dialog.getByRole('button',{name:'Review poll',exact:true})
 const sheet=await dialog.boundingBox(),button=await action.boundingBox()
 expect(sheet).toBeTruthy();expect(button).toBeTruthy()
 expect(sheet!.x).toBeGreaterThanOrEqual(0);expect(sheet!.x+sheet!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
 expect(button!.y+button!.height).toBeLessThanOrEqual(bottom)
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
}
for(const width of [320,390])test(`poll actions and six options stay usable at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:width===320?568:844})
 await page.goto(origin+prefix)
 await fillPoll(page)
 for(let option=3;option<=6;option++){
  await page.getByRole('button',{name:'+ Add option',exact:true}).click()
  await page.getByLabel('Option '+option,{exact:true}).fill('Practice choice '+option)
 }
 await expectBounded(page)
 await page.screenshot({path:info.outputPath('chat-poll-six-options.png'),fullPage:true})
 // Exercise the visualViewport events used by the iOS keyboard. This is a simulated viewport, not an iPhone keyboard test.
 await page.evaluate(()=>{
  const viewport=window.visualViewport!
  Object.defineProperties(viewport,{height:{configurable:true,get:()=>330},offsetTop:{configurable:true,get:()=>20}})
  viewport.dispatchEvent(new Event('resize'))
 })
 await expectBounded(page,350)
 expect(await page.locator('.poll-sheet-body').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true)
 await page.getByLabel('Option 6',{exact:true}).focus()
 await page.screenshot({path:info.outputPath('chat-poll-keyboard-viewport.png'),fullPage:true})
 await page.getByRole('button',{name:'Review poll',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Review your poll'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Post poll',exact:true})).toBeVisible()
 expect(actions).toHaveLength(0)
 await page.screenshot({path:info.outputPath('chat-poll-review.png'),fullPage:true})
 await page.getByRole('button',{name:'Post poll',exact:true}).click()
 await expect(page.getByText('Poll posted to this room.',{exact:true})).toBeVisible()
 expect(actions).toHaveLength(1);expect(actions[0].action).toBe('create')
 await page.getByRole('button',{name:'Close poll',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 expect(await page.locator('body').getAttribute('data-poll-changed')).toBe('true')
 await expect(page.getByRole('button',{name:'Create a poll',exact:true})).toBeFocused()
})

test('closing a draft asks before discarding and preserves its fields when kept',async({page})=>{
 await page.goto(origin+prefix);await fillPoll(page)
 await page.getByRole('button',{name:'Close poll',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Leave this poll?'})).toBeVisible()
 await page.getByRole('button',{name:'Keep working',exact:true}).click()
 await expect(page.getByLabel('Question',{exact:true})).toHaveValue('When should we practice?')
 await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Discard and leave poll',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0);expect(actions).toHaveLength(0)
})

test('an interrupted post keeps one identity and checks the saved poll without posting another',async({page})=>{
 await page.goto(origin+prefix);await fillPoll(page)
 await page.getByRole('button',{name:'Review poll',exact:true}).click()
 interruptCreate=true
 await page.getByRole('button',{name:'Post poll',exact:true}).click()
 await expect(page.getByText('Not confirmed. Check the saved poll or retry the same action.',{exact:true})).toBeVisible()
 expect(actions).toHaveLength(1)
 await page.getByRole('button',{name:'Check saved action',exact:true}).click()
 await expect(page.getByText('Saved choice confirmed.',{exact:true})).toBeVisible()
 expect(actions.map(action=>action.action)).toEqual(['create','lookup'])
 expect(actions[1].id).toBe(actions[0].id)
})

test('team tools fit a narrow phone and close back to the same trigger',async({page},info)=>{
 await page.setViewportSize({width:320,height:568})
 await page.goto(origin+prefix)
 const trigger=page.getByLabel('Team tools',{exact:true})
 await trigger.click()
 await expect(page.getByRole('button',{name:'Close team tools',exact:true})).toBeVisible()
 expect(await page.locator('.chat-room-options-panel').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 await page.screenshot({path:info.outputPath('chat-poll-team-tools.png'),fullPage:true})
 await page.getByRole('button',{name:'Close team tools',exact:true}).click()
 await expect(page.locator('.chat-room-options')).not.toHaveAttribute('open','')
 await expect(trigger).toBeFocused()
})
