import {test,expect,type Page} from '@playwright/test'
import {build} from 'esbuild'
const origin='http://127.0.0.1:4286',first='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',second='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
type Fixture={owner:string;revision:number;blocked:boolean;autoOpen:boolean;holdGuard:boolean;holdResolve:boolean;fail:boolean;offset:number;reads:string[];opens:string[];confirm:()=>void;release:()=>void;receive:(id:string)=>void;resume:()=>void;switchOwner:()=>void;capture:()=>void;clickOldOpen:()=>void;clickOldDismiss:()=>void;dispose:()=>void}
declare global {interface Window {coachingHandoffFixture:Fixture}}
let javascript=''
test.beforeAll(async()=>{const bundle=await build({entryPoints:['tests/fixtures/mobile-coach-handoffs.ts'],bundle:true,platform:'browser',format:'esm',write:false});javascript=bundle.outputFiles[0].text})
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(url.origin!==origin)return route.abort()
  return route.fulfill(url.pathname==='/app.js'?{contentType:'text/javascript',body:javascript}:{contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script type="module" src="/app.js"></script></body></html>'})
 })
})
async function state(page:Page,changes:Partial<Pick<Fixture,'revision'|'blocked'|'autoOpen'|'holdGuard'|'holdResolve'|'fail'|'offset'>>={}){
 return page.evaluate(changes=>{const f=window.coachingHandoffFixture;Object.assign(f,changes);return {reads:f.reads,opens:f.opens}},changes)
}
async function settle(page:Page){await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))}
for(const kind of ['message','activity'])test.describe(kind+' alert handoff',()=>{
 test.beforeEach(async({page})=>{await page.goto(origin+'/?kind='+kind);await page.waitForFunction(()=>Boolean(window.coachingHandoffFixture))})
 test('keeps the newer alert when an older navigation confirmation finishes',async({page})=>{
  await state(page,{holdGuard:true});await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await page.getByRole('button',{name:/^Open /}).click()
  await page.evaluate(id=>{window.coachingHandoffFixture.receive(id);window.coachingHandoffFixture.confirm()},second)
  await settle(page);expect(await state(page)).toEqual({reads:[],opens:[]});await expect(page.getByRole('complementary')).toBeVisible()
  await state(page,{holdGuard:false});await page.getByRole('button',{name:/^Open /}).click()
  await expect.poll(async()=>(await state(page)).opens).toEqual([second])
 })
 test('ignores a confirmed navigation after the user changes page',async({page})=>{
  await state(page,{holdGuard:true});await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await page.getByRole('button',{name:/^Open /}).click();await state(page,{revision:1})
  await page.evaluate(()=>window.coachingHandoffFixture.confirm());await settle(page)
  expect(await state(page)).toEqual({reads:[],opens:[]})
  await state(page,{holdGuard:false});await page.getByRole('button',{name:/^Open /}).click()
  await expect.poll(async()=>(await state(page)).opens).toEqual([first])
 })
 test('ignores old controls after a newer alert replaces them',async({page})=>{
  await page.evaluate(({first,second})=>{const f=window.coachingHandoffFixture;f.receive(first);f.capture();f.receive(second);f.clickOldOpen();f.clickOldDismiss()},{first,second})
  await settle(page);expect(await state(page)).toEqual({reads:[],opens:[]});await expect(page.getByRole('complementary')).toBeVisible()
  await page.getByRole('button',{name:/^Open /}).click();await expect.poll(async()=>(await state(page)).opens).toEqual([second])
 })
 test('expires an idle alert at ten minutes without polling',async({page})=>{
  await page.clock.install();await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await page.clock.runFor(600000);await expect(page.getByRole('complementary')).toBeHidden()
  expect(await state(page)).toEqual({reads:[],opens:[]})
  await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await page.getByRole('button',{name:/^Open /}).click();await expect.poll(async()=>(await state(page)).opens).toEqual([first])
 })
 test('rejects a late response at the expiry boundary even if the timer was suspended',async({page})=>{
  await state(page,{holdResolve:true});await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await page.getByRole('button',{name:/^Open /}).click();await expect.poll(async()=>(await state(page)).reads).toEqual([first])
  await state(page,{offset:600000});await page.evaluate(()=>window.coachingHandoffFixture.release());await settle(page)
  expect((await state(page)).opens).toEqual([]);await expect(page.getByRole('complementary')).toBeHidden()
 })
 test('requires an explicit retry after a failed conversation or activity',async({page})=>{
  await state(page,{autoOpen:true,fail:true});await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await expect(page.getByRole('complementary')).toContainText(/couldn’t open|Couldn’t load/)
  await state(page,{fail:false});await page.evaluate(()=>{const f=window.coachingHandoffFixture;f.resume();f.resume()});await settle(page)
  expect(await state(page)).toEqual({reads:[first],opens:[]})
  await page.getByRole('button',{name:/^Retry /}).click();await expect.poll(async()=>(await state(page)).opens).toEqual([first])
 })
 test('keeps a replacement alert past the old expiry and cancels it on account switch',async({page})=>{
  await page.clock.install();await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await page.clock.runFor(590000);await page.evaluate(id=>window.coachingHandoffFixture.receive(id),second)
  await page.clock.runFor(10000);await expect(page.getByRole('complementary')).toBeVisible()
  await page.evaluate(()=>window.coachingHandoffFixture.switchOwner());await expect(page.getByRole('complementary')).toBeHidden()
  await page.clock.runFor(600000);expect(await state(page)).toEqual({reads:[],opens:[]})
 })
 test('preserves the current page after a delayed response until explicitly opened again',async({page})=>{
  await state(page,{autoOpen:true,holdResolve:true});await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await expect.poll(async()=>(await state(page)).reads).toEqual([first]);await state(page,{revision:1})
  await page.evaluate(()=>window.coachingHandoffFixture.release());await expect(page.getByRole('complementary')).toContainText('Ready to open')
  await page.evaluate(()=>window.coachingHandoffFixture.resume());await settle(page);expect(await state(page)).toEqual({reads:[first],opens:[]})
  await page.getByRole('button',{name:/^Open /}).click();await expect.poll(async()=>(await state(page)).opens).toEqual([first])
 })
 test('dismisses a waiting confirmation and allows a fresh tap of the same alert',async({page})=>{
  await state(page,{holdGuard:true});await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await page.getByRole('button',{name:/^Open /}).click();await page.getByRole('button',{name:/^Dismiss /}).click()
  await page.evaluate(()=>window.coachingHandoffFixture.confirm());await settle(page)
  expect(await state(page)).toEqual({reads:[],opens:[]});await expect(page.getByRole('complementary')).toBeHidden()
  await state(page,{holdGuard:false});await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await page.getByRole('button',{name:/^Open /}).click();await expect.poll(async()=>(await state(page)).opens).toEqual([first])
 })
 test('ignores an older response after a newer alert has opened',async({page})=>{
  await state(page,{holdResolve:true});await page.evaluate(id=>window.coachingHandoffFixture.receive(id),first)
  await page.getByRole('button',{name:/^Open /}).click();await expect.poll(async()=>(await state(page)).reads).toEqual([first])
  await page.evaluate(id=>window.coachingHandoffFixture.receive(id),second);await page.getByRole('button',{name:/^Open /}).click()
  await expect.poll(async()=>(await state(page)).opens).toEqual([second])
  await page.evaluate(()=>window.coachingHandoffFixture.release());await settle(page)
  expect(await state(page)).toEqual({reads:[first,second],opens:[second]});await expect(page.getByRole('complementary')).toBeHidden()
 })
})
