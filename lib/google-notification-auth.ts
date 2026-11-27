import 'server-only'
import {createRemoteJWKSet,jwtVerify,errors,type JWTVerifyGetKey} from 'jose'

export type GoogleNotificationConfiguration={audience:string;email:string;subscription:string}
export function googleNotificationConfiguration(env:Readonly<Record<string,string|undefined>>=process.env):GoogleNotificationConfiguration|null {
 if(env.GOOGLE_PLAY_RTDN_ENABLED!=='true'||env.GOOGLE_PLAY_ENABLED!=='true'||env.GOOGLE_PLAY_ENTITLEMENTS_ENABLED!=='true'||env.GOOGLE_PLAY_PURCHASE_MODE!=='test')return null
 const audience=env.GOOGLE_PLAY_RTDN_AUDIENCE,email=env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL,subscription=env.GOOGLE_PLAY_RTDN_SUBSCRIPTION
 if(!audience||!/^https:\/\/(?:www\.)?tenaceiq\.com\/api\/google\/notifications$/.test(audience)||!email||!/^[a-z0-9][a-z0-9-]*@[a-z0-9][a-z0-9-]*\.iam\.gserviceaccount\.com$/.test(email)||!subscription||!/^projects\/[a-z][a-z0-9-]{4,61}[a-z0-9]\/subscriptions\/[A-Za-z][A-Za-z0-9._~+%-]{2,254}$/.test(subscription))return null
 return {audience,email,subscription}
}
export class GoogleNotificationAuthError extends Error {}
// Never resolve keys from the incoming JWT's URL headers. Cache Google's fixed JWKS
// and throttle unknown-key refreshes so unauthenticated requests cannot amplify traffic.
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:600000})
export async function authenticateGoogleNotification(authorization:string|null,config:GoogleNotificationConfiguration,keys:JWTVerifyGetKey=googleKeys,now=Date.now()){
 const token=authorization?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1]
 if(!token||token.length>16384)throw new GoogleNotificationAuthError('google_notification_unauthorized')
 try{
  const {payload}=await jwtVerify(token,keys,{algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:config.audience,requiredClaims:['iat','exp','sub','email','email_verified'],maxTokenAge:'1h',clockTolerance:30,currentDate:new Date(now)})
  if(payload.aud!==config.audience||payload.email!==config.email||payload.email_verified!==true||!/^\d{10,32}$/.test(payload.sub??'')||typeof payload.iat!=='number'||typeof payload.exp!=='number'||payload.exp<=payload.iat||payload.exp-payload.iat>3900)throw new GoogleNotificationAuthError('google_notification_unauthorized')
 }catch(error){
  if(error instanceof GoogleNotificationAuthError||error instanceof errors.JOSEError&&!(error instanceof errors.JWKSTimeout)&&!(error instanceof errors.JWKSInvalid))throw new GoogleNotificationAuthError('google_notification_unauthorized')
  throw Error('google_notification_auth_unavailable')
 }
}
