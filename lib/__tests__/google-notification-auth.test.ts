import {expect,it,vi} from 'vitest'
import {generateKeyPairSync} from 'node:crypto'
import {SignJWT,createLocalJWKSet,exportJWK,type JWTPayload} from 'jose'
vi.mock('server-only',()=>({}))
import {authenticateGoogleNotification,googleNotificationConfiguration} from '../google-notification-auth'

const config={audience:'https://www.tenaceiq.com/api/google/notifications',email:'pubsub-push@tenaceiq-test.iam.gserviceaccount.com',subscription:'projects/tenaceiq-test/subscriptions/google-pro'}
const pair=generateKeyPairSync('rsa',{modulusLength:2048}),foreign=generateKeyPairSync('rsa',{modulusLength:2048})
const seconds=Math.floor(Date.now()/1000),claims={iss:'https://accounts.google.com',aud:config.audience,sub:'123456789012345678901',email:config.email,email_verified:true,iat:seconds,exp:seconds+3600}
async function token(patch:JWTPayload={},key=pair.privateKey,algorithm='RS256'){
 return 'Bearer '+await new SignJWT({...claims,...patch}).setProtectedHeader({alg:algorithm,kid:'fixture'}).sign(key)
}
const keys=async()=>createLocalJWKSet({keys:[{...await exportJWK(pair.publicKey),kid:'fixture',alg:'RS256'}]})

it('accepts only a signed, fresh Google identity for the exact push service account and audience',async()=>{
 const resolve=await keys()
 await expect(authenticateGoogleNotification(await token(),config,resolve)).resolves.toBeUndefined()
 await expect(authenticateGoogleNotification(await token({iss:'accounts.google.com'}),config,resolve)).resolves.toBeUndefined()
})
it.each([
 ['wrong issuer',{iss:'https://evil.example'}],['wrong audience',{aud:'https://evil.example'}],['audience array',{aud:[config.audience,'other']}],
 ['different service account',{email:'other@tenaceiq-test.iam.gserviceaccount.com'}],['unverified email',{email_verified:false}],['string verification',{email_verified:'true'}],
 ['missing verified email',{email_verified:undefined}],['missing expiry',{exp:undefined}],['expired token',{iat:seconds-7200,exp:seconds-3600}],
 ['future token',{iat:seconds+120,exp:seconds+3720}],['excess lifetime',{exp:seconds+7200}],['non-service subject',{sub:'user@example.com'}],
])('rejects %s',async(_label,patch)=>{
 await expect(authenticateGoogleNotification(await token(patch),config,await keys())).rejects.toThrow('google_notification_unauthorized')
})
it('rejects foreign signatures, algorithm substitution and missing/oversized bearer tokens',async()=>{
 const resolve=await keys()
 for(const value of [await token({},foreign.privateKey),await token({},pair.privateKey,'PS256'),null,'Bearer '+ 'a'.repeat(18000),await token()+'.extra'])await expect(authenticateGoogleNotification(value,config,resolve)).rejects.toThrow('google_notification_unauthorized')
})
it('retries key-service outages without accepting the request',async()=>{
 await expect(authenticateGoogleNotification(await token(),config,async()=>{throw Error('synthetic JWKS outage')})).rejects.toThrow('google_notification_auth_unavailable')
})
it('requires explicit test-only activation, canonical HTTPS audience and an exact subscription',()=>{
 const env={GOOGLE_PLAY_RTDN_ENABLED:'true',GOOGLE_PLAY_ENABLED:'true',GOOGLE_PLAY_ENTITLEMENTS_ENABLED:'true',GOOGLE_PLAY_PURCHASE_MODE:'test',GOOGLE_PLAY_RTDN_AUDIENCE:config.audience,GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL:config.email,GOOGLE_PLAY_RTDN_SUBSCRIPTION:config.subscription}
 expect(googleNotificationConfiguration(env)).toEqual(config)
 // Pausing new checkout must not stop lifecycle processing for existing access.
 expect(googleNotificationConfiguration({...env,GOOGLE_PLAY_FULFILLMENT_ENABLED:'false'})).toEqual(config)
 for(const patch of [{GOOGLE_PLAY_RTDN_ENABLED:'false'},{GOOGLE_PLAY_ENTITLEMENTS_ENABLED:'false'},{GOOGLE_PLAY_PURCHASE_MODE:'production'},{GOOGLE_PLAY_RTDN_AUDIENCE:'http://www.tenaceiq.com/api/google/notifications'},{GOOGLE_PLAY_RTDN_AUDIENCE:config.audience+'?secret=oops'},{GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL:'nobody@gmail.com'},{GOOGLE_PLAY_RTDN_SUBSCRIPTION:'projects/foreign/subscriptions/../other'}])expect(googleNotificationConfiguration({...env,...patch})).toBeNull()
})
