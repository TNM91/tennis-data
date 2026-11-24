import {test,expect} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {scopeNativeStyles} from '../../mobile/scripts/style-scope.mjs'
const origin='http://127.0.0.1:4259',prefix='/__google-membership-fixture/'
let javascript='',stylesheet=''
test.beforeAll(async()=>{
 const output=await build({entryPoints:['tests/fixtures/mobile-google-memberships.ts'],bundle:true,platform:'browser',format:'esm',outfile:'google-membership.js',write:false,jsx:'automatic',loader:{'.module.css':'local-css'},define:{TIQ_FIRST_PARTY_BUILD:'true'},alias:{'next/image':path.resolve('mobile/src/native-website-image.tsx'),'next/link':path.resolve('mobile/src/native-website-link.tsx')}})
 javascript=output.outputFiles.find(file=>file.path.endsWith('.js'))!.text
 stylesheet=scopeNativeStyles(await readFile('mobile/src/style.css','utf8'))+'\n'+(await Promise.all(['mobile/generated/website-ui.css','mobile/src/website-parity.css','mobile/src/app-atmosphere.css','mobile/src/premium-surfaces.css','mobile/src/google-memberships.css'].map(file=>readFile(file,'utf8')))).join('\n')
})
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(url.origin!==origin||!url.pathname.startsWith(prefix))return route.abort()
  if(url.pathname.endsWith('app.js'))return route.fulfill({contentType:'text/javascript',body:javascript})
  if(url.pathname.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:stylesheet})
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./style.css"></head><body data-screen="lab"><main id="app"><p>QA fixture · no account or live purchase</p></main><dialog class="account-settings-dialog" aria-label="Account settings"><div class="account-settings-toolbar"><button type="button" class="secondary" data-close>Done</button></div><div class="account-settings-body"><header class="account-overview"><h1>Your account</h1></header><section id="membership" class="apple-membership-panel"></section></div></dialog><script type="module" src="./app.js"></script></body></html>'})
 })
})
type Fixture={calls:{products:number;purchase:number;reconcile:number;manage:number;operations:string[]};approve:()=>void;finish:()=>void;close:()=>void;open:()=>void;switchOwner:()=>void}
const fixture=()=>((window as unknown as {googleMembershipFixture:Fixture}).googleMembershipFixture)

for(const width of [320,390])test(`Pro offers one verified plan and stays aligned at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:844});await page.goto(origin+prefix)
 const buy=page.getByRole('button',{name:'Get Pro · $4.99/month',exact:true});await expect(buy).toBeVisible();await expect(buy).toBeEnabled()
 await expect(page.getByRole('heading',{name:'Pro membership',exact:true})).toBeVisible()
 await expect(page.getByText('Google Play test access · use a test payment method')).toBeVisible()
 await expect(page.getByRole('button',{name:/^Get Pro/})).toHaveCount(1)
 expect((await buy.boundingBox())!.height).toBeGreaterThanOrEqual(44)
 expect((await buy.boundingBox())!.y+(await buy.boundingBox())!.height).toBeLessThanOrEqual(844)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:info.outputPath('google-membership-ready.png'),fullPage:true})
 await buy.click();await expect(page.getByText('Pro is active',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^Get Pro/})).toHaveCount(0)
 expect(await page.evaluate(fixture).then(value=>value.calls.purchase)).toBe(1)
})
test('a missing price keeps checkout closed and offers a retry',async({page})=>{
 await page.goto(origin+prefix+'?mode=price-error');await expect(page.getByRole('button',{name:'Retry loading Pro',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:/^Get Pro/})).toHaveCount(0);await expect(page.getByRole('dialog')).not.toContainText('$4.99')
 await page.getByRole('button',{name:'Retry loading Pro'}).click();await expect(page.getByRole('button',{name:'Get Pro · $4.99/month'})).toBeEnabled()
})
test('canceling confirmation permits a retry without restoring or unlocking access',async({page})=>{
 await page.goto(origin+prefix+'?mode=cancel');const buy=page.getByRole('button',{name:'Get Pro · $4.99/month'});await buy.click()
 await expect(page.getByRole('status')).toContainText('Purchase canceled');await expect(buy).toBeEnabled()
 expect(await page.evaluate(fixture).then(value=>value.calls.reconcile)).toBe(0)
 await buy.click();await expect(buy).toBeEnabled();expect(await page.evaluate(fixture).then(value=>value.calls.purchase)).toBe(2)
})
test('enlarged text keeps checkout and recovery inside the narrow phone card',async({page},info)=>{
 await page.setViewportSize({width:320,height:844});await page.goto(origin+prefix);await expect(page.getByRole('button',{name:/^Get Pro/})).toBeVisible()
 await page.evaluate(()=>{document.documentElement.style.fontSize='24px'})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 const bounds=await page.locator('.google-membership-panel').boundingBox()
 for(const label of ['Get Pro · $4.99/month','Restore purchases','Manage Google Play subscriptions']){const button=page.getByRole('button',{name:label,exact:true});await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();expect(box!.width).toBeLessThanOrEqual(bounds!.width);expect(box!.height).toBeGreaterThanOrEqual(44)}
 await page.screenshot({path:info.outputPath('google-membership-enlarged.png'),fullPage:true})
})
test('pending approval never unlocks Pro, then a verified update refreshes access',async({page})=>{
 await page.goto(origin+prefix+'?mode=pending');await page.getByRole('button',{name:'Get Pro · $4.99/month'}).click()
 await expect(page.getByRole('status')).toContainText('awaiting Google Play approval');await expect(page.getByRole('button',{name:/^Get Pro/})).toHaveCount(0)
 expect(await page.evaluate(fixture).then(value=>value.calls.reconcile)).toBe(0)
 await page.evaluate(()=>((window as unknown as {googleMembershipFixture:Fixture}).googleMembershipFixture).approve())
 await expect(page.getByText('Pro is active',{exact:true})).toBeVisible()
})
test('restore recovers an interrupted sync using the original operation without another checkout',async({page},info)=>{
 await page.goto(origin+prefix+'?mode=sync-error');const buy=page.getByRole('button',{name:'Get Pro · $4.99/month'});await buy.click()
 await expect(page.locator('[data-google-error]')).not.toBeEmpty();await expect(buy).toBeDisabled()
 await page.getByRole('button',{name:'Restore purchases',exact:true}).click();await expect(page.getByText('Pro is active',{exact:true})).toBeVisible()
 const calls=await page.evaluate(fixture).then(value=>value.calls);expect(calls.purchase).toBe(1);expect(calls.reconcile).toBe(2);expect(calls.operations[0]).toBe(calls.operations[1])
 await page.screenshot({path:info.outputPath('google-membership-restored.png'),fullPage:true})
})
for(const mode of ['paused','web'])test(`${mode} access offers management without a second purchase`,async({page})=>{
 await page.goto(origin+prefix+'?mode='+mode);await expect(page.getByRole('button',{name:'Manage Google Play subscriptions'})).toBeVisible();await expect(page.getByRole('button',{name:/^Get Pro/})).toHaveCount(0)
 expect(await page.evaluate(fixture).then(value=>value.calls.products)).toBe(0)
 await page.getByRole('button',{name:'Manage Google Play subscriptions'}).click();await expect(page.getByRole('status')).toContainText('Manage your subscription')
 expect(await page.evaluate(fixture).then(value=>value.calls.manage)).toBe(1)
})
test('closing during checkout keeps delivery alive and reopening shows the verified result',async({page})=>{
 await page.goto(origin+prefix+'?mode=slow');const buy=page.getByRole('button',{name:'Get Pro · $4.99/month'});await buy.click();await expect(buy).toBeDisabled()
 await buy.dispatchEvent('click');expect(await page.evaluate(fixture).then(value=>value.calls.purchase)).toBe(1)
 await page.getByRole('button',{name:'Done',exact:true}).click();await page.evaluate(()=>((window as unknown as {googleMembershipFixture:Fixture}).googleMembershipFixture).finish())
 await expect.poll(()=>page.evaluate(fixture).then(value=>value.calls.reconcile)).toBe(1)
 await page.evaluate(()=>((window as unknown as {googleMembershipFixture:Fixture}).googleMembershipFixture).open());await expect(page.getByText('Pro is active',{exact:true})).toBeVisible()
})
for(const mode of ['inactive','unavailable'])test(`${mode} checkout makes no native price or purchase request`,async({page})=>{
 await page.goto(origin+prefix+'?mode='+mode);await expect(page.getByRole('heading',{name:'Pro membership',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^Get Pro/})).toHaveCount(0)
 expect(await page.evaluate(fixture).then(value=>value.calls.products)).toBe(0);expect(await page.evaluate(fixture).then(value=>value.calls.purchase)).toBe(0)
})
