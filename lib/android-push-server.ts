import 'server-only'
import {createHash, createPrivateKey, createPublicKey, sign, type KeyObject} from 'node:crypto'
import {androidPushToken} from './native-activity-push-token'

type Configuration = {project: string; email: string; key: KeyObject; fingerprint: string}
export function androidPushConfiguration(env: Readonly<Record<string,string|undefined>> = process.env): Configuration|null {
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production' || env.ANDROID_PUSH_ENABLED !== 'true') return null
  const project = env.FIREBASE_PROJECT_ID?.trim() ?? '', email = env.FIREBASE_CLIENT_EMAIL?.trim() ?? ''
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) ||
    !/^[a-z0-9][a-z0-9-]*@[a-z0-9][a-z0-9-]*\.iam\.gserviceaccount\.com$/.test(email)) return null
  try {
    const key = createPrivateKey((env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g,'\n'))
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) return null
    const fingerprint = createHash('sha256').update(project+'\n'+email+'\n')
      .update(createPublicKey(key).export({type:'spki',format:'der'})).digest('hex')
    return {project,email,key,fingerprint}
  } catch { return null }
}

async function boundedJson(response: Response, limit = 16384): Promise<Record<string,unknown>> {
  if (!response.body) throw Error('android_push_unavailable')
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let bytes = 0, text = ''
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.length
      if (bytes > limit) { await reader.cancel(); throw Error('android_push_unavailable') }
      text += decoder.decode(next.value,{stream:true})
    }
    const value: unknown = JSON.parse(text+decoder.decode())
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('android_push_unavailable')
    return value as Record<string,unknown>
  } finally { reader.releaseLock() }
}

let authorization: {fingerprint: string; until: number; token: string}|null = null
let acquiring: {fingerprint: string; promise: Promise<string>}|null = null
async function accessToken(config: Configuration, send: typeof fetch, now: number): Promise<string> {
  if (authorization?.fingerprint === config.fingerprint && now < authorization.until && now >= authorization.until-3600000) return authorization.token
  if (acquiring?.fingerprint === config.fingerprint) return acquiring.promise
  const promise = (async () => {
    const seconds = Math.floor(now/1000), encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const unsigned = encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:config.email,
      scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:seconds,exp:seconds+300})
    const assertion = unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),config.key).toString('base64url')
    const response = await send('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})})
    if (response.status !== 200) throw Error('android_push_unavailable')
    const data = await boundedJson(response,8192)
    if (data.token_type !== 'Bearer' || typeof data.access_token !== 'string' || !/^[-._~+\/=A-Za-z0-9]{16,4096}$/.test(data.access_token) ||
      typeof data.expires_in !== 'number' || !Number.isInteger(data.expires_in) || data.expires_in <= 60 || data.expires_in > 3600) throw Error('android_push_unavailable')
    const token = 'Bearer '+data.access_token
    authorization = {fingerprint:config.fingerprint,until:now+(data.expires_in-60)*1000,token}
    return token
  })()
  const current = {fingerprint:config.fingerprint,promise}; acquiring = current
  try { return await promise } finally { if (acquiring === current) acquiring = null }
}

type Payload = {recipient: string; href: string; aps: {alert: {title: string; body: string}}}
/** Only generic notification text and an account-bound app destination leave the server. */
export async function deliverAndroidNotification(config: Configuration, input: {
  token: string; payload: Payload; collapseId: string; expiresAt: number
}, send: typeof fetch = fetch, now = Date.now()): Promise<{status: number; reason?: string}> {
  try {
    const {token,payload,collapseId,expiresAt} = input
    if (!androidPushToken(token) || !/^[a-f0-9-]{36}$/i.test(payload.recipient) ||
      !payload.href.startsWith('/') || payload.href.startsWith('//') || payload.href.length > 1200 ||
      !/^[a-f0-9-]{36}$/i.test(collapseId) || !Number.isSafeInteger(expiresAt) || expiresAt < 0) return {status:400}
    const remaining = expiresAt === 0 ? 0 : expiresAt-Math.floor(now/1000)
    if (remaining < 0) return {status:400}
    const bearer = await accessToken(config,send,now)
    const response = await send('https://fcm.googleapis.com/v1/projects/'+config.project+'/messages:send',{
      method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000),
      headers:{Authorization:bearer,'Content-Type':'application/json'},body:JSON.stringify({message:{token,
        notification:{title:payload.aps.alert.title,body:payload.aps.alert.body},
        data:{recipient:payload.recipient,href:payload.href},
        android:{priority:'HIGH',ttl:Math.min(remaining,3600)+'s',collapse_key:collapseId,
          notification:{channel_id:'tenaceiq_activity',visibility:'PRIVATE'}}}}),
    })
    const data = await boundedJson(response)
    if (response.status === 200) return typeof data.name === 'string' && data.name.startsWith('projects/'+config.project+'/messages/') ? {status:200} : {status:503}
    const error = data.error as {details?: unknown[]}|undefined
    const unregistered = response.status === 404 && Array.isArray(error?.details) && error.details.some(detail =>
      detail && typeof detail === 'object' && (detail as Record<string,unknown>)['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError' &&
      (detail as Record<string,unknown>).errorCode === 'UNREGISTERED')
    if (unregistered) return {status:410,reason:'Unregistered'}
    if (response.status === 401 && authorization?.fingerprint === config.fingerprint) authorization = null
    return {status:response.status === 401 || response.status === 403 ? 403 : response.status === 429 ? 429 : 503}
  } catch { return {status:503} }
}
