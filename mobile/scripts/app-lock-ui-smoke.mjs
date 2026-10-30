import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {chromium,webkit} from '@playwright/test'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve,sep,extname} from 'node:path'

const repo=fileURLToPath(new URL('../../',import.meta.url)),base=resolve(repo,'mobile/bundled')
const output=resolve(repo,'tmp/app-lock-ui-proof');await mkdir(output,{recursive:true})
const result=await build({stdin:{contents:"import {mountAppLock} from './mobile/src/app-lock';window.mountLock=()=>{window.current=true;return mountAppLock(document.querySelector('#lock'),()=>window.current)}",resolveDir:repo,loader:'ts'},bundle:true,write:false,platform:'browser',format:'iife',plugins:[{name:'test-native-bridge',setup(builder){builder.onResolve({filter:/^@capacitor\/core$/},()=>({path:'bridge',namespace:'test'}));builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:"export const Capacitor={getPlatform:()=>window.platform||'ios'};export const registerPlugin=()=>({status:()=>window.lockStatus(),setEnabled:(options)=>window.setLock(options)})"}))}}]})
const script=result.outputFiles[0].text,checks=[]
for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await browserType.launch({headless:true})
 try{for(const width of [320,390]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:4261')return route.abort()
   if(url.pathname==='/test.js')return route.fulfill({contentType:'text/javascript',body:script})
   if(url.pathname==='/qa.css')return route.fulfill({contentType:'text/css',body:':root{font-size:22px!important}'})
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/website-parity.css"><link rel="stylesheet" href="/app-atmosphere.css"><link rel="stylesheet" href="/qa.css"><main><dialog open class="account-settings-dialog"><section id="lock" class="account-access-panel"></section></dialog></main><script src="/test.js"></script>'})
   const path=resolve(base,'.'+url.pathname);if(!path.startsWith(base+sep))return route.abort()
   try{await route.fulfill({contentType:extname(path)==='.css'?'text/css':'image/png',body:await readFile(path)})}catch{await route.fulfill({status:404,body:''})}
  })
  await page.goto('http://127.0.0.1:4261/')
  await page.evaluate(()=>{window.lockStatus=async()=>({enabled:false,available:true,biometry:'faceID'});window.calls=0;window.setLock=async({enabled})=>{window.calls++;return {enabled,available:true,biometry:'faceID'}};window.panel=window.mountLock()})
  const on=page.getByRole('button',{name:'Turn on Face ID',exact:true});await on.click()
  await page.getByText('App lock is on for this iPhone.',{exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>window.calls),1)
  await page.getByRole('button',{name:'Turn off app lock',exact:true}).click()
  await page.getByText('App lock is off.',{exact:true}).waitFor()
  await page.evaluate(()=>{window.setLock=async()=>{throw {code:'authentication_cancelled'}}})
  await on.click();await page.getByRole('alert').getByText('No change made. Unlock was canceled.').waitFor()
  assert.equal(await on.isEnabled(),true)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.screenshot({path:resolve(output,`${engine}-${width}.png`),fullPage:true})
  await page.evaluate(()=>{window.setLock=()=>new Promise(resolve=>{window.resolveLock=resolve})})
  await on.click();assert.equal(await on.isDisabled(),true)
  await page.evaluate(()=>{window.current=false;window.panel.dispose();document.querySelector('#lock').textContent='Another account';window.resolveLock({enabled:true,available:true,biometry:'faceID'})})
  await page.waitForTimeout(50);assert.equal(await page.locator('#lock').textContent(),'Another account')
  await page.evaluate(()=>{window.current=true;window.lockStatus=async()=>({enabled:false,available:false,biometry:'passcode'});window.panel=window.mountLock()})
  await page.getByText('Set up a device passcode in iPhone Settings to use app lock.').waitFor();assert.equal(await page.getByRole('button',{name:'Turn on device unlock'}).isDisabled(),true)
  await page.evaluate(()=>{window.platform='web';window.panel.dispose();window.mountLock()});assert.equal(await page.locator('#lock').count(),0)
  assert.deepEqual(errors,[])
  checks.push({engine,width,enlargedText:true,enableDisable:true,cancelKeepsSetting:true,staleAccountIgnored:true,passcodeRequired:true,webHidden:true,horizontalOverflow:false,runtimeErrors:0})
  await page.close()
 }}finally{await browser.close()}
}
await writeFile(resolve(output,'proof.json'),JSON.stringify({actualAccountModule:true,mockedNativeAuthentication:true,checks},null,2)+'\n')
console.log(JSON.stringify({passed:true,checks:checks.length,engines:['Chromium','WebKit'],widths:[320,390]}))
