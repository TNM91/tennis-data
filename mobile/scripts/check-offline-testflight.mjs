import {createPrivateKey,sign} from 'node:crypto'
import {setTimeout as sleep} from 'node:timers/promises'

const bundleId = 'com.tenaceiq.app'
const buildNumber = '255'
const {API_KEY,API_KEY_ID,API_ISSUER} = process.env
if(!API_KEY || !API_KEY_ID || !API_ISSUER)throw new Error('App Store Connect credentials are unavailable.')
const key = createPrivateKey(Buffer.from(API_KEY,'base64'))
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')

async function read(path,query){
 const url = new URL(path,'https://api.appstoreconnect.apple.com')
 url.search = new URLSearchParams(query).toString()
 const now = Math.floor(Date.now()/1000)
 const header = encode({alg:'ES256',kid:API_KEY_ID,typ:'JWT'})
 const claims = encode({iss:API_ISSUER,iat:now,exp:now+120,aud:'appstoreconnect-v1',
  scope:[`GET ${url.pathname}${decodeURIComponent(url.search)}`]})
 const signature = sign('sha256',Buffer.from(`${header}.${claims}`),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')
 const response = await fetch(url,{
  headers:{Authorization:`Bearer ${header}.${claims}.${signature}`},redirect:'error',signal:AbortSignal.timeout(10000),
 })
 if(!response.ok)throw new Error(`App Store Connect returned HTTP ${response.status} for ${path}.`)
 return response.json()
}

const apps = await read('/v1/apps',{'filter[bundleId]':bundleId,'fields[apps]':'bundleId',limit:'2'})
const [app] = apps.data
if(apps.data.length!==1 || app.attributes.bundleId!==bundleId)throw new Error('Could not resolve the exact TenAceIQ app.')

let result
for(let attempt=0;attempt<6;attempt++){
 const reply = await read('/v1/builds',{'filter[app]':app.id,'filter[version]':buildNumber,
  include:'preReleaseVersion,buildBetaDetail,betaGroups',limit:'5'})
 const included = reply.included ?? []
 const builds = reply.data.filter(build=>{
  const version = included.find(item=>item.type==='preReleaseVersions' && item.id===build.relationships.preReleaseVersion?.data?.id)
  return build.attributes.version===buildNumber && version?.attributes.platform==='IOS' && version.attributes.version==='1.0'
 })
 if(builds.length>1)throw new Error('Build 255 is ambiguous in App Store Connect.')
 const [build] = builds
 const detail = included.find(item=>item.type==='buildBetaDetails' && item.id===build?.relationships.buildBetaDetail?.data?.id)
 const groupIds = new Set((build?.relationships.betaGroups?.data ?? []).map(group=>group.id))
 result = {
  build:buildNumber,
  processing:build?.attributes.processingState ?? 'AWAITING_PROCESSING',
  audience:build?.attributes.buildAudienceType ?? null,
  internalState:detail?.attributes.internalBuildState ?? null,
  t1Assigned:included.some(item=>item.type==='betaGroups' && groupIds.has(item.id) && item.attributes.isInternalGroup===true && item.attributes.name.trim().toUpperCase()==='T1'),
 }
 if(result.processing==='FAILED' || result.processing==='INVALID' || (result.processing==='VALID' && result.t1Assigned))break
 if(attempt<5)await sleep(20000)
}
console.log(JSON.stringify(result))
