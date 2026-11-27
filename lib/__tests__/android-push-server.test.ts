import {generateKeyPairSync,verify} from 'node:crypto'
import {expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
import {androidPushConfiguration,deliverAndroidNotification} from '../android-push-server'
import {androidPushToken,nativeActivityPushToken} from '../native-activity-push-token'
import {parsePushDevice} from '../mobile-push-device'

const recipient='11111111-1111-4111-8111-111111111111',notice='22222222-2222-4222-8222-222222222222'
const token='AbCdEf0123456789_Test:Token-WithCase',now=1800000000000
function configuration() {
  const pair=generateKeyPairSync('rsa',{modulusLength:2048})
  const env={ANDROID_PUSH_ENABLED:'true',FIREBASE_PROJECT_ID:'tenaceiq-test',FIREBASE_CLIENT_EMAIL:'push@tenaceiq-test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY:pair.privateKey.export({type:'pkcs8',format:'pem'}).toString()}
  return {env,key:pair.publicKey,config:androidPushConfiguration(env)!}
}
const input=()=>({token,collapseId:notice,expiresAt:0,payload:{recipient,href:'/coach?notice='+notice,
  aps:{alert:{title:'TenAceIQ',body:'You have a coaching update.'},sound:'default'}}})
it('requires explicit activation, production deployment scope and a valid RSA service identity',()=>{
  const {env}=configuration()
  expect(androidPushConfiguration(env)).not.toBeNull()
  for(const patch of [{ANDROID_PUSH_ENABLED:'false'},{VERCEL_ENV:'preview'},{FIREBASE_PROJECT_ID:'../other'},
    {FIREBASE_CLIENT_EMAIL:'person@example.test'},{FIREBASE_PRIVATE_KEY:'broken'}]) expect(androidPushConfiguration({...env,...patch})).toBeNull()
})
it('preserves case-sensitive FCM tokens and distinguishes them from the existing APNs contract',()=>{
  expect(androidPushToken(token)).toBe(true);expect(nativeActivityPushToken('fcm:'+token)).toBe(true)
  expect(nativeActivityPushToken('a'.repeat(64))).toBe(true);expect(nativeActivityPushToken(token)).toBe(false)
  for(const bad of ['',token+'\n',token+' ',token+'/', 'a'.repeat(2049)])expect(androidPushToken(bad)).toBe(false)
  const value={installationId:recipient,secret:'b'.repeat(64),enabled:true,token}
  expect(parsePushDevice(value)).toBeNull();expect(parsePushDevice(value,'fcm')?.token).toBe(token)
  expect(parsePushDevice({...value,enabled:false,token:undefined},'fcm')).toMatchObject({enabled:false,token:''})
})
it('signs a narrowly scoped assertion, coalesces authorization and sends private generic payloads only to fixed Google endpoints',async()=>{
  const {config,key}=configuration(),calls:{url:string;init:RequestInit}[]=[]
  const send=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
    calls.push({url:String(url),init:init!})
    if(String(url)==='https://oauth2.googleapis.com/token')return Response.json({token_type:'Bearer',access_token:'synthetic_access_token_123',expires_in:3600})
    return Response.json({name:'projects/tenaceiq-test/messages/synthetic'})
  })
  expect(await Promise.all([deliverAndroidNotification(config,input(),send,now),deliverAndroidNotification(config,input(),send,now)])).toEqual([{status:200},{status:200}])
  expect(calls.filter(c=>c.url.includes('oauth2'))).toHaveLength(1)
  const assertion=new URLSearchParams(calls[0].init.body as URLSearchParams).get('assertion')!,[header,body,signature]=assertion.split('.')
  expect(verify('RSA-SHA256',Buffer.from(header+'.'+body),key,Buffer.from(signature,'base64url'))).toBe(true)
  expect(JSON.parse(Buffer.from(body,'base64url').toString())).toEqual({iss:config.email,scope:'https://www.googleapis.com/auth/firebase.messaging',
    aud:'https://oauth2.googleapis.com/token',iat:now/1000,exp:now/1000+300})
  for(const c of calls.slice(1)){
    expect(c.url).toBe('https://fcm.googleapis.com/v1/projects/tenaceiq-test/messages:send')
    expect(c.init).toMatchObject({redirect:'error',cache:'no-store',headers:{Authorization:'Bearer synthetic_access_token_123'}})
    expect(JSON.parse(String(c.init.body))).toEqual({message:{token,notification:{title:'TenAceIQ',body:'You have a coaching update.'},
      data:{recipient,href:input().payload.href},android:{priority:'HIGH',ttl:'0s',collapse_key:notice,
        notification:{channel_id:'tenaceiq_activity',visibility:'PRIVATE'}}}})
  }
})
it('invalidates only confirmed unregistered tokens and treats authentication, rate limits and provider errors as retryable',async()=>{
  const {config}=configuration()
  for(const [status,error,expected] of [
    [404,{details:[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED'}]},410],
    [404,{},503],[400,{},503],[401,{},403],[403,{},403],[429,{},429],[500,{},503],
  ] as const){
    const send=vi.fn(async(url:RequestInfo|URL)=>String(url).includes('oauth2')?
      Response.json({token_type:'Bearer',access_token:'synthetic_access_token_123',expires_in:3600}):Response.json({error},{status}))
    expect((await deliverAndroidNotification(config,input(),send,now)).status).toBe(expected)
  }
})
it('does not transmit malformed or expired destinations, rejects oversized responses, and never follows redirects',async()=>{
  const {config}=configuration(),send=vi.fn()
  for(const patch of [{token:token+'\n'},{expiresAt:1},{collapseId:'invalid'},{payload:{...input().payload,href:'//outside.invalid'}}]){
    expect((await deliverAndroidNotification(config,{...input(),...patch},send,now)).status).toBe(400)
  }
  expect(send).not.toHaveBeenCalled()
  send.mockResolvedValueOnce(new Response('x'.repeat(9000)))
  expect((await deliverAndroidNotification(config,input(),send,now)).status).toBe(503)
})
