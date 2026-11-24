import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {GOOGLE_PLAY_PRODUCTS,googleTransaction} from '../../lib/google-play-products'
import {GooglePlayPurchaseError,type GooglePlayFulfillment} from './google-play-purchases'

const endpoint='https://www.tenaceiq.com/api/mobile/google-purchases'
type Transport={get:(options:HttpOptions)=>Promise<HttpResponse>;post:(options:HttpOptions)=>Promise<HttpResponse>}
export function googlePlayFulfillment(client:SupabaseClient,http:Transport=CapacitorHttp):GooglePlayFulfillment {
 async function session(owner:string){const result=await client.auth.getSession();if(result.error||result.data.session?.user.id!==owner)throw new GooglePlayPurchaseError('owner_changed');return result.data.session}
 async function request(owner:string,body?:Record<string,unknown>){
  const account=await session(owner),options={url:endpoint,headers:{Authorization:'Bearer '+account.access_token,...(body?{'Content-Type':'application/json'}:{})},responseType:'json' as const,disableRedirects:true,connectTimeout:12000,readTimeout:body?55000:12000}
  let response:HttpResponse
  try{response=body?await http.post({...options,data:body}):await http.get(options)}catch{await session(owner);throw new GooglePlayPurchaseError('google_unavailable')}
  await session(owner)
  const data=response.data
  if(response.status!==200||data?.ok!==true)throw new GooglePlayPurchaseError(typeof data?.code==='string'?data.code:'google_unavailable')
  if(data.googlePurchases!==1||data.ownerId!==owner)throw new GooglePlayPurchaseError('google_unavailable')
  return data
 }
 return {
  async context(owner){return request(owner)},
  async prepare(owner,intent){
   if(intent.productId!==GOOGLE_PLAY_PRODUCTS[0].id||intent.targetId!==null)throw new GooglePlayPurchaseError('google_products_unavailable')
   return request(owner,{action:'prepare',...intent})
  },
  async reconcile(owner,transaction,operationId){
   if(!googleTransaction(transaction)||transaction.productId!==GOOGLE_PLAY_PRODUCTS[0].id||transaction.state!=='purchased')throw new GooglePlayPurchaseError('google_unavailable')
   const result=await request(owner,{action:'reconcile',operationId,productId:transaction.productId,purchaseToken:transaction.purchaseToken})
   return result.receipt
  },
 }
}
