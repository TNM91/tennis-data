import {createPrivateKey,sign} from 'node:crypto'
import {setTimeout as sleep} from 'node:timers/promises'

const bundleId = 'com.tenaceiq.app'
const buildNumber = process.env.TIQ_CHECK_BUILD_NUMBER || '255'
if(!/^[1-9][0-9]{2,8}$/.test(buildNumber)||Number(buildNumber)<255)throw Error('Choose a first-party build number of at least 255.')
const previousBuildNumber = '254'
const origin = 'https://api.appstoreconnect.apple.com'
const shouldAssign = process.env.TIQ_ASSIGN_PREVIOUS_GROUP === 'true'
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
 if(!response.ok)throw Object.assign(new Error(`App Store Connect returned HTTP ${response.status} for ${path}.`),{status:response.status})
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
 if(response.status!==204 && response.status!==409)throw new Error(`Apple returned HTTP ${response.status} while assigning build ${buildNumber} to the previous group.`)
}

const apps = await read('/v1/apps',{'filter[bundleId]':bundleId,'fields[apps]':'bundleId',limit:'2'})
const [app] = apps.data
if(apps.data.length!==1 || app.attributes.bundleId!==bundleId)throw new Error('Could not resolve the exact TenAceIQ app.')

async function readBuild(number){
 const reply = await read('/v1/builds',{'filter[app]':app.id,'filter[version]':number,
  include:'preReleaseVersion,buildBetaDetail,betaGroups',limit:'5'})
 const included = reply.included ?? []
 const builds = reply.data.filter(build=>{
  const version = included.find(item=>item.type==='preReleaseVersions' && item.id===build.relationships.preReleaseVersion?.data?.id)
  return build.attributes.version===number && version?.attributes.platform==='IOS' && version.attributes.version==='1.0'
 })
 if(reply.links?.next || builds.length>1)throw new Error(`Build ${number} is ambiguous in App Store Connect.`)
 const [build] = builds
 const detail = included.find(item=>item.type==='buildBetaDetails' && item.id===build?.relationships.buildBetaDetail?.data?.id)
 return {
  id:build?.id,
  processing:build?.attributes.processingState ?? 'AWAITING_PROCESSING',
  audience:build?.attributes.buildAudienceType ?? null,
  internalState:detail?.attributes.internalBuildState ?? null,
  groupIds:new Set((build?.relationships.betaGroups?.data ?? []).map(group=>group.id)),
 }
}

async function groupContainsBuild(groupId,buildId){
 const links = await read(`/v1/betaGroups/${encodeURIComponent(groupId)}/relationships/builds`,{limit:'200'})
 return links.data.some(link=>link.type==='builds' && link.id===buildId)
}

async function readUploadStatus(){
 const uploads=await read(`/v1/apps/${encodeURIComponent(app.id)}/buildUploads`,{
  'filter[cfBundleVersion]':buildNumber,
  'fields[buildUploads]':'cfBundleShortVersionString,cfBundleVersion,platform,state,uploadedDate',
  limit:'10',
 })
 const matching=uploads.data.map(row=>row.attributes).filter(row=>
  row?.cfBundleVersion===buildNumber&&row.cfBundleShortVersionString==='1.0'&&row.platform==='IOS')
 const latest=matching.sort((a,b)=>String(b.uploadedDate||'').localeCompare(String(a.uploadedDate||'')))[0]
 const status=latest?.state
 const state=typeof status==='string'?status:status?.state
 const errorCodes=Array.isArray(status?.errors)?status.errors.map(error=>error?.code)
  .filter(code=>typeof code==='string'&&/^[A-Z0-9_.-]{1,48}$/.test(code)).slice(0,10):[]
 return {uploadRecords:matching.length,uploadState:typeof state==='string'&&/^[A-Z_]{1,40}$/.test(state)?state:null,errorCodes}
}

const previous = await readBuild(previousBuildNumber)
if(!previous.id || previous.processing!=='VALID')throw new Error('Could not verify the prior iOS build 254.')
const groups = await read(`/v1/apps/${encodeURIComponent(app.id)}/betaGroups`,{'fields[betaGroups]':'isInternalGroup',limit:'200'})
if(groups.links?.next)throw new Error('The list of TenAceIQ groups is incomplete.')
const internalGroups = groups.data.filter(group=>group.type==='betaGroups' && group.attributes.isInternalGroup===true)
let previousGroups = internalGroups.filter(group=>previous.groupIds.has(group.id))
// Confirm from the group side when Apple omits the build-side relationship.
if(previousGroups.length===0 && internalGroups.length<=4){
 const memberships = await Promise.all(internalGroups.map(group=>groupContainsBuild(group.id,previous.id)))
 previousGroups = internalGroups.filter((_group,index)=>memberships[index])
}
if(previousGroups.length!==1){
 console.log(JSON.stringify({priorBuild:previousBuildNumber,priorState:previous.internalState,
  internalGroups:internalGroups.length,verifiedPriorGroups:previousGroups.length}))
 throw new Error('Could not verify exactly one existing internal group with access to build 254.')
}
const [previousGroup] = previousGroups

let result
let assignmentAttempted = false
for(let attempt=0;attempt<6;attempt++){
 const current = await readBuild(buildNumber)
 const assigned = current.groupIds.has(previousGroup.id) || Boolean(current.id && current.processing==='VALID'
  && await groupContainsBuild(previousGroup.id,current.id))
 result = {
  build:buildNumber,
  processing:current.processing,
  audience:current.audience,
  internalState:current.internalState,
  sameGroupAs254:assigned,
 }
 if(result.processing==='FAILED' || result.processing==='INVALID')break
 if(result.processing==='VALID' && assigned && (!shouldAssign || result.internalState==='IN_BETA_TESTING'))break
 if(shouldAssign && !assignmentAttempted && attempt<5 && result.processing==='VALID' && !assigned){
  if(result.audience!=='INTERNAL_ONLY' || !['READY_FOR_BETA_TESTING','IN_BETA_TESTING'].includes(result.internalState)){
   throw new Error(`Build ${buildNumber} is outside the approved internal testing scope.`)
  }
  await addBuildToGroup(current.id,previousGroup.id)
  assignmentAttempted = true
  continue
 }
 if(attempt<5)await sleep(20000)
}
if(result.processing==='AWAITING_PROCESSING'){
 const upload=await readUploadStatus().catch(error=>({
  uploadStatusAvailable:false,
  uploadStatusHttp:Number.isInteger(error?.status)?error.status:null,
 }))
 result={...result,...upload}
}
console.log(JSON.stringify(result))
if(shouldAssign && !result.sameGroupAs254)throw new Error(`Apple did not confirm build ${buildNumber} in the same group as build 254.`)
