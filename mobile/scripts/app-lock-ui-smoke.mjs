import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {chromium,webkit} from '@playwright/test'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve,sep,extname} from 'node:path'
const repo=fileURLToPath(new URL('../../',import.meta.url)),base=resolve(repo,'mobile/bundled'),output=resolve(repo,'tmp/biometric-sign-in-ui-proof');await mkdir(output,{recursive:true})
const result=await build({stdin:{contents:"import {mountBiometricSettings,mountBiometricSignIn} from './mobile/src/biometric-sign-in';window.mountSettings=()=>{window.current=true;return mountBiometricSettings(document.querySelector('#host'),window.primary,window.owner,()=>window.current)};window.mountLogin=()=>{window.current=true;return mountBiometricSignIn(document.querySelector('#host'),window.primary,()=>window.current)}",resolveDir:repo,loader:'ts'},bundle:true,write:false,platform:'browser',format:'iife',plugins:[{name:'synthetic-auth',setup(b){b.onResolve({filter:/^@capacitor\/core$/},()=>({path:'bridge',namespace:'test'}));b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'auth',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='auth'?'export const createClient=()=>window.verification':"export const Capacitor={getPlatform:()=>window.platform||'ios'};export const registerPlugin=()=>({status:(o)=>window.bio.status(o),remember:(o)=>window.bio.remember(o),signIn:(o)=>window.bio.signIn(o),forget:(o)=>window.bio.forget(o),cancel:(o)=>window.bio.cancel(o)})"}))}}]})
const script=result.outputFiles[0].text,checks=[]
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true})
 try{for(const width of [320,390]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:4261')return route.abort()
   if(url.pathname==='/test.js')return route.fulfill({contentType:'text/javascript',body:script})
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/website-parity.css"><link rel="stylesheet" href="/app-atmosphere.css"><style>:root{font-size:22px!important}</style><main><dialog open class="account-settings-dialog"><section id="host" class="account-access-panel"></section></dialog></main><script src="/test.js"></script>'})
   const file=resolve(base,'.'+url.pathname);if(!file.startsWith(base+sep))return route.abort()
   try{await route.fulfill({contentType:extname(file)==='.css'?'text/css':'image/png',body:await readFile(file)})}catch{await route.fulfill({status:404,body:''})}
  })
  await page.goto('http://127.0.0.1:4261/')
  await page.evaluate(()=>{
   window.owner='00000000-0000-4000-8000-000000000001';window.saved=false;window.adoptions=0;window.prompts=0;window.remembers=0;window.revocations=0
   window.primary={auth:{getUser:async()=>({data:{user:{id:window.owner,email:'synthetic@example.test'}},error:null}),getSession:async()=>({data:{session:null},error:null}),setSession:async()=>{window.adoptions++;return {error:null}}}}
   window.verify=async({password})=>password==='synthetic-only'?{data:{user:{id:window.owner},session:{access_token:'synthetic',refresh_token:'synthetic'}},error:null}:{data:{user:null,session:null},error:{code:'invalid_credentials'}}
   window.verification={auth:{signInWithPassword:o=>window.verify(o),signOut:async()=>{window.revocations++;return {error:null}}}}
   window.bio={status:async()=>({saved:window.saved,forCurrentOwner:window.saved,available:true,biometry:'faceID'}),remember:async()=>{window.remembers++;window.saved=true},signIn:async()=>{window.prompts++;return {owner:window.owner,email:'synthetic@example.test',password:'synthetic-only'}},forget:async()=>{window.saved=false},cancel:async()=>{}}
   window.panel=window.mountSettings()
  })
  const enable=()=>page.getByRole('button',{name:'Turn on Face ID sign-in',exact:true}),password=()=>page.getByLabel('Your current TenAceIQ password')
  await password().fill('wrong');await enable().click();await page.getByText('Check your current password and try again.').waitFor();assert.equal(await page.evaluate(()=>window.remembers),0)
  await password().fill('synthetic-only');await enable().click();await page.getByText('Face ID sign-in is ready for your account.').waitFor();assert.equal(await page.evaluate(()=>window.remembers),1)
  await page.getByRole('button',{name:'Remove saved sign-in'}).click();await enable().waitFor()
  await page.evaluate(()=>{window.bio.remember=async()=>{throw {code:'authentication_cancelled'}}})
  await password().fill('synthetic-only');await enable().click();await page.getByText('Sign-in was not saved. You can try again.').waitFor()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.screenshot({path:resolve(output,`${engine}-${width}-setup.png`),fullPage:true})
  await page.evaluate(()=>{window.verify=()=>new Promise(resolve=>{window.finishVerification=resolve})})
  await password().fill('synthetic-only');await enable().click();await page.waitForFunction(()=>Boolean(window.finishVerification))
  await page.evaluate(()=>{window.current=false;window.panel.dispose();document.querySelector('#host').textContent='Another account';window.finishVerification({data:{user:{id:window.owner},session:{}},error:null})})
  await page.waitForTimeout(30);assert.equal(await page.locator('#host').textContent(),'Another account');assert.equal(await page.evaluate(()=>window.remembers),1)
  await page.evaluate(()=>{window.saved=true;window.verify=async()=>({data:{user:{id:window.owner},session:{access_token:'synthetic',refresh_token:'synthetic'}},error:null});window.panel=window.mountLogin()})
  const signIn=()=>page.getByRole('button',{name:'Sign in with Face ID',exact:true});await signIn().waitFor();assert.equal(await page.evaluate(()=>window.prompts),0)
  await signIn().click();await page.waitForFunction(()=>window.adoptions===1);assert.equal(await page.evaluate(()=>window.prompts),1)
  await page.evaluate(()=>{window.bio.signIn=async()=>{throw {code:'authentication_cancelled'}}})
  await signIn().click();await page.getByText('Sign-in canceled. Use Face ID, your password or an email code when you’re ready.').waitFor()
  await page.evaluate(()=>{window.bio.signIn=async()=>({owner:window.owner,email:'synthetic@example.test',password:'synthetic-only'});window.verify=async()=>({data:{user:{id:'other-owner'},session:{}},error:null})})
  await signIn().click();await page.getByText(/Couldn’t sign in with the saved account/).waitFor();assert.equal(await page.evaluate(()=>window.adoptions),1);assert.equal(await page.evaluate(()=>window.saved),false)
  await page.evaluate(()=>{window.verify=async()=>({data:{user:{id:window.owner},session:{access_token:'synthetic',refresh_token:'synthetic'}},error:null});window.primary.auth.getSession=async()=>({data:{session:{user:{id:'already-signed-in'}}},error:null})})
  await signIn().click();await page.waitForFunction(()=>!document.querySelector('[data-biometric-signin]').disabled);assert.equal(await page.evaluate(()=>window.adoptions),1)
  await page.evaluate(()=>{window.primary.auth.getSession=async()=>({data:{session:null},error:null})})
  await page.evaluate(()=>{window.verify=()=>new Promise(resolve=>{window.finishVerification=resolve});window.finishVerification=null})
  await signIn().click();await page.waitForFunction(()=>Boolean(window.finishVerification));await page.evaluate(()=>{window.current=false;window.panel.dispose();document.querySelector('#host').textContent='Manual sign-in';window.finishVerification({data:{user:{id:window.owner},session:{access_token:'synthetic',refresh_token:'synthetic'}},error:null})})
  await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>window.adoptions),1);assert.equal(await page.locator('#host').textContent(),'Manual sign-in')
  await page.evaluate(()=>{window.bio.status=async()=>({saved:false,forCurrentOwner:false,available:false,biometry:'faceID'});window.panel=window.mountSettings()});await enable().waitFor();assert.equal(await enable().isDisabled(),true)
  await page.evaluate(()=>{window.platform='web';window.panel.dispose();window.mountLogin()});assert.equal(await page.locator('#host').count(),0);assert.deepEqual(errors,[])
  checks.push({engine,width,enlargedText:true,explicitOnly:true,verifiedSetup:true,remove:true,cancel:true,staleSetupIgnored:true,wrongOwnerRejected:true,staleLoginIgnored:true,horizontalOverflow:false,runtimeErrors:0});await page.close()
 }}finally{await browser.close()}
}
await writeFile(resolve(output,'proof.json'),JSON.stringify({actualModules:true,syntheticAuthentication:true,checks},null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,engines:['Chromium','WebKit'],widths:[320,390]}))
