import {accountResponse,readAccountJson} from '@/lib/mobile-account-auth'
import {applePurchaseContext,applePurchasePublicContext,appleUnavailable,prepareApplePurchase,reconcileApplePurchase} from '@/lib/apple-purchase-api'
export const runtime='nodejs'
export const maxDuration=60
export async function GET(request:Request){try{const loaded=await applePurchaseContext(request);return 'response'in loaded?loaded.response:accountResponse(applePurchasePublicContext(loaded.context))}catch{return appleUnavailable()}}
export async function POST(request:Request){
 try{
  const loaded=await applePurchaseContext(request);if('response'in loaded)return loaded.response
  const ctx=loaded.context;if(!ctx)return accountResponse({ok:false,code:'apple_unavailable'},503)
  const body=await readAccountJson(request,28000);if(!body)return accountResponse({ok:false,code:'invalid_request'},400)
  if(body.action==='prepare')return prepareApplePurchase(ctx,body.productId)
  if(body.action==='reconcile')return reconcileApplePurchase(ctx,body.operationId,body.signedTransaction)
  return accountResponse({ok:false,code:'invalid_request'},400)
 }catch{return appleUnavailable()}
}
