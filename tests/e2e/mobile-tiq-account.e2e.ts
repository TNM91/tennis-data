import {test as base,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {tiqAccountServer,tiqAnswers,tiqPlayer,tiqStudent,type TiqFixtureRequest} from '../fixtures/tiq-account-server'
const origin='http://127.0.0.1:4285'
let javascript='',stylesheet='',shell=''
type Server=ReturnType<typeof tiqAccountServer>
const test=base.extend<{server:Server}>({server:async({},provide)=>{await provide(tiqAccountServer())}})
test.describe.configure({retries:0,timeout:45000})
test.beforeAll(async()=>{
  const bundle=await build({entryPoints:['tests/fixtures/mobile-navigation.ts'],bundle:true,platform:'browser',format:'esm',outfile:'fixture.js',write:false,
    jsx:'automatic',define:{TIQ_FIRST_PARTY_BUILD:'true'},loader:{'.module.css':'local-css'},
    alias:{'next/image':path.resolve('mobile/src/native-website-image.tsx'),'next/link':path.resolve('mobile/src/native-website-link.tsx')},
    plugins:[{name:'tiq-account-preview',setup(builder){
      builder.onResolve({filter:/^@capacitor\/app$/},()=>({path:path.resolve('tests/fixtures/mobile-navigation-app.ts')}))
      builder.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:path.resolve('tests/fixtures/mobile-navigation-client.ts')}))
    }}]})
  javascript=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text
  stylesheet=(await Promise.all(['style.css','website-ui.css','app.css','website-parity.css','app-atmosphere.css','premium-surfaces.css'].map(file=>file==='app.css'?Promise.resolve(bundle.outputFiles.find(f=>f.path.endsWith('.css'))!.text):readFile('mobile/bundled/'+file,'utf8')))).join('\n')
  shell=await readFile('mobile/bundled/index.html','utf8')
})
async function install(page:Page,server:Server){
  await page.exposeFunction('tiqAccountServer',(request:TiqFixtureRequest)=>server.request(request))
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.origin!==origin)return route.abort()
    if(url.pathname==='/app.js')return route.fulfill({contentType:'text/javascript',body:javascript})
    if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:url.pathname==='/style.css'?stylesheet+(url.searchParams.has('large')?'\n:root{font-size:22px!important}':''):''})
    if(url.pathname.startsWith('/brand/')||url.pathname==='/logo.png')return route.fulfill({contentType:'image/png',body:await readFile('mobile/bundled'+url.pathname)})
    return route.fulfill({contentType:'text/html',body:url.searchParams.has('large')?shell.replace('./style.css','./style.css?large=1'):shell})
  })
}
test.beforeEach(async({page,server})=>{await install(page,server)})
const card=(page:Page)=>page.getByRole('region',{name:'Your TiQ',exact:true})
async function open(page:Page,large=false){await page.goto(origin+'/?unlinked=1&tiq-account=1'+(large?'&large=1':''));await expect(card(page)).toHaveAttribute('data-tiq-account','ready')}
async function history(page:Page){await card(page).getByRole('button',{name:'Rating history & sharing'}).click();const dialog=page.getByRole('dialog',{name:'Your TiQ history',exact:true});await expect(dialog).toBeVisible();await expect(dialog.locator('[data-tiq-status]')).not.toContainText('Loading');return dialog}
async function assess(page:Page){
  await card(page).getByRole('button',{name:'Find my level',exact:true}).click()
  for(const label of ['How reliable is your serve?','What can you do against a match-speed serve?','How steady is your baseline rally?'])await card(page).getByRole('combobox',{name:label,exact:true}).selectOption('2')
  await card(page).getByRole('button',{name:'Continue',exact:true}).click()
  for(const label of ['How do you move between shots?','How comfortable are you finishing at net?','How do you build a point when the score gets tight?'])await card(page).getByRole('combobox',{name:label,exact:true}).selectOption('2')
  await card(page).getByRole('button',{name:'Continue',exact:true}).click()
}
test('preserves device-only assessments until explicit import and restores the account rating on another device',async({page,browser,server})=>{
  const device=JSON.stringify({current:{date:'2026-11-17',answers:tiqAnswers},previous:{date:'2026-11-16',answers:{...tiqAnswers,serve:1}}})
  await page.addInitScript(({owner,device})=>localStorage.setItem('starter-tiq:v2:'+owner,device),{owner:tiqPlayer,device})
  await open(page);expect(server.ordered(tiqPlayer)).toHaveLength(0)
  await expect(card(page)).toContainText('Private on this device')
  let dialog=await history(page);await dialog.locator('.tiq-device-history>summary').click()
  await dialog.getByRole('button',{name:'Save device assessment to account',exact:true}).first().click()
  await expect(dialog.getByRole('status')).toContainText('Assessment saved to your account.')
  expect(server.ordered(tiqPlayer)).toHaveLength(1);expect(server.shares).toHaveLength(0)
  expect(await page.evaluate(owner=>localStorage.getItem('starter-tiq:v2:'+owner),tiqPlayer)).toBe(device)
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(card(page)).toContainText('Saved to your account')
  const context=await browser.newContext({viewport:{width:390,height:844}})
  try{
    const second=await context.newPage();await install(second,server);await open(second)
    await expect(card(second).locator('.starter-tiq-level')).toContainText('7 / 10')
    expect(await second.evaluate(owner=>localStorage.getItem('starter-tiq:v2:'+owner),tiqPlayer)).toBeNull()
    dialog=await history(page);await dialog.locator('.tiq-device-history>summary').click()
    await dialog.getByRole('button',{name:'Save device assessment to account',exact:true}).first().click()
    await expect(dialog.getByRole('status')).toContainText('Assessment saved');expect(server.ordered(tiqPlayer)).toHaveLength(1)
  }finally{await context.close()}
})
test('browses earlier ratings and all six skill changes without phone overflow',async({page,server},info)=>{
  await page.setViewportSize({width:320,height:720})
  for(let n=1;n<=27;n++)server.add(tiqPlayer,{...tiqAnswers,serve:n===27?3:1},'2026-10-'+String(n).padStart(2,'0'))
  await open(page,true);const dialog=await history(page)
  await expect(dialog.locator('.tiq-account-entry')).toHaveCount(25)
  await dialog.locator('.tiq-account-entry details>summary').first().click()
  await expect(dialog.locator('.tiq-account-entry').first()).toContainText('Previously Building')
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await dialog.screenshot({path:info.outputPath('tiq-account-history.png')})
  await dialog.getByRole('button',{name:'Load earlier assessments'}).click();await expect(dialog.locator('.tiq-account-entry')).toHaveCount(27)
  expect(server.reads).toBe(3)
})
test('saves a new private account assessment and restores it after relaunch',async({page,server})=>{
  await open(page);await assess(page)
  await expect(card(page)).toContainText('Sharing with a coach is a separate choice.')
  await card(page).getByRole('button',{name:'Save to my account',exact:true}).click()
  await expect(card(page)).toContainText('Saved to your account');expect(server.ordered(tiqPlayer)).toHaveLength(1);expect(server.shares).toHaveLength(0)
  await page.reload();await expect(card(page).locator('.starter-tiq-level')).toContainText('7 / 10')
})
test('recovers a lost account save across relaunch without creating a second assessment',async({page,server})=>{
  await open(page);await assess(page);server.loseSaveReply=true
  await card(page).getByRole('button',{name:'Save to my account',exact:true}).click()
  await expect(card(page)).toContainText('An account save needs confirmation.')
  expect(server.ordered(tiqPlayer)).toHaveLength(1)
  await page.reload();await expect(card(page)).toContainText('An account save needs confirmation.')
  const dialog=await history(page);await dialog.getByRole('button',{name:'Check saved assessment',exact:true}).click()
  await expect(dialog.getByRole('status')).toContainText('Assessment saved to your account.')
  expect(server.ordered(tiqPlayer)).toHaveLength(1)
  expect(await page.evaluate(owner=>localStorage.getItem('tiq-account-pending:v1:'+owner),tiqPlayer)).toBeNull()
})
test('keeps answers after another device saves and requires reviewing the latest rating before resaving',async({page,server})=>{
  await open(page);await assess(page)
  server.add(tiqPlayer,{serve:3,return:3,rally:3,movement:3,net:3,points:3},new Date().toISOString().slice(0,10))
  await card(page).getByRole('button',{name:'Save to my account',exact:true}).click()
  await expect(card(page)).toContainText('An account save needs confirmation.')
  const dialog=await history(page);await dialog.getByRole('button',{name:'Check saved assessment',exact:true}).click()
  await expect(dialog.getByRole('button',{name:'Save kept assessment after review'})).toBeDisabled()
  expect(server.ordered(tiqPlayer)).toHaveLength(1)
  await dialog.getByRole('button',{name:'Refresh history'}).click()
  await expect(dialog.getByRole('button',{name:'Save kept assessment after review'})).toBeEnabled()
  await dialog.getByRole('button',{name:'Save kept assessment after review'}).click()
  await expect(dialog.getByRole('status')).toContainText('Assessment saved');expect(server.ordered(tiqPlayer)).toHaveLength(2)
})
test('shares only a chosen assessment, revokes it and confirms deletion separately',async({page,server},info)=>{
  server.add();server.add(tiqPlayer,{...tiqAnswers,serve:3})
  await open(page);const dialog=await history(page),entry=dialog.locator('.tiq-account-entry').first()
  expect(server.shares).toHaveLength(0)
  await entry.getByLabel('Share with a coach').selectOption('coach-one')
  await entry.getByRole('button',{name:'Share assessment',exact:true}).click()
  await expect(dialog.getByRole('status')).toContainText('shared with the selected coach')
  expect(server.shares.filter(s=>s.shared)).toHaveLength(1)
  await expect(entry.locator('h3')).toBeFocused()
  await expect(dialog.locator('[data-tiq-status]')).toHaveCSS('background-color','rgba(0, 0, 0, 0)')
  await expect(dialog.locator('[data-tiq-status]')).toHaveCSS('border-left-width','0px')
  await dialog.screenshot({path:info.outputPath('tiq-coach-sharing.png')})
  await entry.getByRole('button',{name:'Stop sharing',exact:true}).click()
  await expect(dialog.getByRole('status')).toHaveText('Sharing stopped.');expect(server.shares.filter(s=>s.shared)).toHaveLength(0)
  await entry.getByRole('button',{name:'Delete assessment',exact:true}).click();expect(server.ordered(tiqPlayer)).toHaveLength(2)
  await entry.getByRole('button',{name:'Keep assessment',exact:true}).click();expect(server.ordered(tiqPlayer)).toHaveLength(2)
  await expect(entry.getByRole('button',{name:'Delete assessment',exact:true})).toBeFocused()
  await entry.getByRole('button',{name:'Delete assessment',exact:true}).click()
  await entry.getByRole('button',{name:'Delete from account',exact:true}).click()
  await expect(dialog.getByRole('status')).toContainText('deleted from your account');expect(server.ordered(tiqPlayer)).toHaveLength(1)
})
test('shows coaches only shared player self-assessments and removes answers after access is revoked',async({page,server})=>{
  const selected=server.add(tiqStudent);server.add(tiqStudent,{...tiqAnswers,serve:3})
  server.shares.push({assessment:selected.id,student:'student-one',name:'Coach Alex',operation:crypto.randomUUID(),shared:true,active:true})
  await open(page);await page.getByRole('button',{name:'More',exact:true}).click();await page.locator('[data-app-destination="coach"]').click()
  await page.getByRole('button',{name:'For coaches',exact:true}).click();await page.locator('[data-app-destination="coach-workspace"]').click()
  const workspace=page.getByRole('dialog',{name:'Coach workspace',exact:true});await workspace.getByRole('button',{name:/Alex Rivera/}).click()
  await workspace.getByRole('button',{name:'Coach assessments',exact:true}).click()
  await page.getByRole('dialog',{name:'Coach assessments',exact:true}).getByRole('button',{name:'Player self-assessments'}).click()
  const shared=page.getByRole('dialog',{name:'Shared player TiQ',exact:true})
  await expect(shared.locator('.tiq-account-entry')).toHaveCount(1);await expect(shared).toContainText('player’s own ratings')
  await expect(shared.getByRole('button',{name:'Delete assessment',exact:true})).toHaveCount(0)
  server.connected=false;await shared.getByRole('button',{name:'Refresh history'}).click()
  await expect(shared.getByRole('status')).toContainText('connection is no longer available');await expect(shared.locator('.tiq-account-entry')).toHaveCount(0)
})
test('ignores a late account history response after changing accounts',async({page,server})=>{
  server.add(tiqPlayer,{serve:3,return:3,rally:3,movement:3,net:3,points:3});server.holdRead=true
  await page.goto(origin+'/?unlinked=1&tiq-account=1')
  await expect.poll(()=>server.reads).toBe(1)
  await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-preview-owner]')!.click())
  await expect(card(page)).toHaveAttribute('data-tiq-account','ready');server.releaseRead()
  await expect(card(page).getByRole('button',{name:'Find my level',exact:true})).toBeVisible()
  await expect(card(page).locator('.starter-tiq-level')).toHaveCount(0)
})
