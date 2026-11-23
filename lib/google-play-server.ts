import 'server-only'
import {createPrivateKey,sign} from 'node:crypto'
import {GOOGLE_PLAY_PACKAGE,googlePlayProduct,googlePurchaseToken} from './google-play-products'
import {GooglePurchaseVerificationError,verifiedGooglePurchase,type GooglePurchaseExpectation} from './google-play-verification'

const tokenUrl='https://oauth2.googleapis.com/token',scope='https://www.googleapis.com/auth/androidpublisher'
export function googlePlayConfiguration(env:Readonly<Record<string,string|undefined>>=process.env){
 if(env.GOOGLE_PLAY_ENABLED!=='true'||!['test','production'].includes(env.GOOGLE_PLAY_PURCHASE_MODE??''))return null
 const email=env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?.trim(),key=env.GOOGLE_PLAY_PRIVATE_KEY?.replace(/\\n/g,'\n').trim()
 if(!email||!/^[a-z0-9][a-z0-9-]*@[a-z0-9][a-z0-9-]*\.iam\.gserviceaccount\.com$/.test(email)||!key)return null
 try{const parsed=createPrivateKey(key);if(parsed.asymmetricKeyType!=='rsa'||(parsed.asymmetricKeyDetails?.modulusLength??0)<2048)return null}catch{return null}
 return {email,key,mode:env.GOOGLE_PLAY_PURCHASE_MODE as 'test'|'production'}
}
export type GooglePlayConfiguration=NonNullable<ReturnType<typeof googlePlayConfiguration>>
async function boundedJson(response:Response,maximum=65536){
 if(response.status!==200||!response.body)throw Error('google_verification_unavailable')
 const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,text=''
 try{for(;;){const next=await reader.read();if(next.done)break;bytes+=next.value.length;if(bytes>maximum){await reader.cancel();throw Error('google_verification_unavailable')}text+=decoder.decode(next.value,{stream:true})}text+=decoder.decode();const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data as Record<string,unknown>}catch{throw Error('google_verification_unavailable')}finally{reader.releaseLock()}
}
// This reader cannot acknowledge, consume, refund, or grant access. Durable fulfillment must come first.
export function googlePurchaseReader(config:GooglePlayConfiguration,send:typeof fetch=fetch){
 return {async verify(expected:GooglePurchaseExpectation,now=Date.now()){
  try{
  const product=googlePlayProduct(expected.productId)
  if(!product||!googlePurchaseToken(expected.purchaseToken))throw Error('google_purchase_mismatch')
  const seconds=Math.floor(now/1000),encoded=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned=encoded({alg:'RS256',typ:'JWT'})+'.'+encoded({iss:config.email,scope,aud:tokenUrl,iat:seconds,exp:seconds+300})
  const assertion=unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),config.key).toString('base64url')
  const auth=await boundedJson(await send(tokenUrl,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})}),8192)
  if(auth.token_type!=='Bearer'||typeof auth.access_token!=='string'||!/^[-._~+\/=A-Za-z0-9]{16,4096}$/.test(auth.access_token)||typeof auth.expires_in!=='number'||auth.expires_in<=0||auth.expires_in>3600)throw Error('google_verification_unavailable')
  const resource=product.type==='subs'?'subscriptionsv2':'productsv2',url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PLAY_PACKAGE}/purchases/${resource}/tokens/${encodeURIComponent(expected.purchaseToken)}`
  const data=await boundedJson(await send(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+auth.access_token}}))
  const verified=verifiedGooglePurchase(data,{...expected,allowTest:config.mode==='test'&&expected.allowTest},now)
  if(config.mode==='test'&&verified.environment!=='Test')throw Error('google_purchase_mismatch')
  return verified
  }catch(error){
   if(error instanceof GooglePurchaseVerificationError||error instanceof Error&&error.message==='google_purchase_mismatch')throw error
   throw Error('google_verification_unavailable')
  }
 }}
}
