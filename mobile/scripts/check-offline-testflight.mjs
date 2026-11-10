import {createPrivateKey,sign} from 'node:crypto'
import {setTimeout as sleep} from 'node:timers/promises'

const bundleId = 'com.tenaceiq.app'
const buildNumber = '255'
const origin = 'https://api.appstoreconnect.apple.com'
const shouldAssign = process.env.TIQ_ASSIGN_T1 === 'true'
const {API_KEY,API_KEY_ID,API_ISSUER} = process.env
if(!API_KEY || !API_KEY_ID || !API_ISSUER)throw new Error('App Store Connect credentials are unavailable.')
const key = createPrivateKey(Buffer.from(API_KEY,'base64'))
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')

function token(scope){
 const now = Math.floor(Date.now()/1000)
 const header = encode({alg:'ES256',kid:API_KEY_ID,typ:'JWT'})
 const claims = encode({iss:API_ISSUER,iat:now,exp:now+120,aud:'appstoreconnect-v1',
  ...(scope?{scope:[scope]}:{})})
 const signature = sign('sha256',Buffer.from(`${header}.${claims}`),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')
 return `${header}.${claims}.${signature}`
}

async function read(path,query){
 const url = new URL(path,origin)
 url.search = new URLSearchParams(query).toString()
 const scope = `GET ${url.pathname}${decodeURIComponent(url.search)}`
 const response = await fetch(url,{
  headers:{Authorization:`Bearer ${token(scope)}`},redirect:'error',signal:AbortSignal.timeout(10000),
 })
 if(!response.ok)throw new Error(`App Store Connect returned HTTP ${response.status} for ${path}.`)
 return response.json()
}

async function addBuildToGroup(buildId,groupId){
 const url = new URL(`/v1/builds/${encodeURIComponent(buildId)}/relationships/betaGroups`,origin)
 const response = await fetch(url,{
  method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},
  body:JSON.stringify({data:[{type:'betaGroups',id:groupId}]}),redirect:'error',signal:AbortSignal.timeout(10000),
 })
 // Another reviewer may have added the build between the read and the update.
 // A conflict still requires the same relationship check as a success.
 if(response.status!==204 && response.status!==409)throw new Error(`Apple returned HTTP ${response.status} while assigning build 255 to T1.`)
}

const isT1 = item => item.type==='betaGroups' && item.attributes.isInternalGroup===true
 && item.attributes.name.trim().toUpperCase()==='T1'

const apps = await read('/v1/apps',{'filter[bundleId]':bundleId,'fields[apps]':'bundleId',limit:'2'})
const [app] = apps.data
if(apps.data.length!==1 || app.attributes.bundleId!==bundleId)throw new Error('Could not resolve the exact TenAceIQ app.')

let result
let assignmentAttempted = false
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
  t1Assigned:included.some(item=>isT1(item) && groupIds.has(item.id)),
 }
 if(result.processing==='FAILED' || result.processing==='INVALID')break
 if(result.processing==='VALID' && result.t1Assigned && (!shouldAssign || result.internalState==='IN_BETA_TESTING'))break
 if(shouldAssign && !assignmentAttempted && attempt<5 && result.processing==='VALID' && !result.t1Assigned){
  if(result.audience!=='INTERNAL_ONLY' || !['READY_FOR_BETA_TESTING','IN_BETA_TESTING'].includes(result.internalState)){
   throw new Error('Build 255 is outside the approved internal testing scope.')
  }
  const groups = await read(`/v1/apps/${encodeURIComponent(app.id)}/betaGroups`,{'fields[betaGroups]':'name,isInternalGroup',limit:'200'})
  const matches = groups.data.filter(isT1)
  if(groups.links?.next || matches.length!==1)throw new Error('Expected exactly one existing internal T1 group for TenAceIQ.')
  await addBuildToGroup(build.id,matches[0].id)
  assignmentAttempted = true
  continue
 }
 if(attempt<5)await sleep(20000)
}
console.log(JSON.stringify(result))
if(shouldAssign && !result.t1Assigned)throw new Error('Apple did not confirm the build 255 assignment to T1.')
