'use client'
import {Capacitor,CapacitorHttp} from '@capacitor/core'
import {supabase} from './supabase'
import {parseAccountAccess} from './account-access-contract'
import type {ProductEntitlementSnapshot} from './access-model-core'
export * from './access-model-core'
export async function getClientEntitlementSnapshot(userId:string|null|undefined):Promise<ProductEntitlementSnapshot|null>{
 if(!userId)return null
 try{
  const before=await supabase.auth.getSession()
  if(before.error||before.data.session?.user.id!==userId)return null
  const headers={Authorization:'Bearer '+before.data.session.access_token}
  const response=Capacitor.isNativePlatform()
   ?await CapacitorHttp.get({url:'https://www.tenaceiq.com/api/auth/access',headers,responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
   :await fetch('/api/auth/access',{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)}).then(async r=>({status:r.status,data:await r.json()}))
  const after=await supabase.auth.getSession()
  if(after.error||after.data.session?.user.id!==userId||response.status!==200)return null
  return parseAccountAccess(response.data)?.entitlements||null
 }catch{return null}
}
