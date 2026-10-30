export type ApplePurchasePhase='history'|'prepare'|'confirm'|'sync'|'finish'
export const applePurchasePhaseText:Record<ApplePurchasePhase,string>={history:'Checking earlier Apple purchases…',prepare:'Preparing your membership…',confirm:'Opening Apple. Sign in if asked…',sync:'Verifying your Apple membership…',finish:'Finishing your Apple purchase…'}
const stages=new Set(['app_receipt','app_authentication','storefront','products','entitlements','confirmation','restore'])
const domains=new Set(['NSURLErrorDomain','SKErrorDomain','ASDErrorDomain','AMSErrorDomain','SKServerErrorDomain','StoreKit.StoreKitError','StoreKit.Product.PurchaseError','StoreKit'])
export class ApplePurchaseError extends Error{
 readonly supportCode:string
 readonly build:string
 constructor(code:string,readonly beforeConfirmation=false,supportCode:unknown='',build:unknown=''){
  super(code)
  const parts=typeof supportCode==='string'&&supportCode.length<=200?supportCode.split('/'):[]
  this.supportCode=parts.length>=2&&parts.length<=4&&stages.has(parts[0])&&parts.slice(1).every(part=>{const bits=part.split(':');return bits.length===2&&domains.has(bits[0])&&/^-?\d{1,10}$/.test(bits[1])})?supportCode as string:''
  this.build=typeof build==='string'&&/^\d{1,6}$/.test(build)?build:''
 }
}
const nativeCodes=['purchase_preparation_failed','purchase_request_invalid','purchase_product_unavailable','purchase_not_allowed','purchase_sync_pending','purchase_history_timeout','purchase_preparation_timeout','purchase_presenter_unavailable','environment_mismatch','unsupported_storefront','store_busy','store_unavailable','existing_purchase','account_mismatch','unverified_transaction']
export function appleNativePurchaseError(error:unknown){
 const code=error&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&nativeCodes.includes(error.code)?error.code:'store_unavailable'
 const data=error&&typeof error==='object'&&'data'in error&&error.data&&typeof error.data==='object'?error.data as {supportCode?:unknown;build?:unknown}:{}
 return new ApplePurchaseError(code,['purchase_preparation_failed','purchase_request_invalid','purchase_history_timeout','purchase_preparation_timeout','purchase_presenter_unavailable','environment_mismatch','unsupported_storefront'].includes(code),data.supportCode,data.build)
}
export const applePurchaseFailureText:Record<string,string>={purchase_preparation_failed:'Apple could not prepare your purchase. No new purchase was started. Try again shortly.',purchase_request_invalid:'Your purchase request could not start. Close account settings and reopen them.',purchase_product_unavailable:'Apple says this membership plan is unavailable. Try loading the plans again shortly.',purchase_not_allowed:'Apple is not allowing purchases on this device or Apple Account. Check your purchase settings.',purchase_history_timeout:'Apple’s earlier purchases could not be checked. No new purchase was started. Try again shortly.',purchase_preparation_timeout:'Apple’s purchase screen did not get ready in time. No new purchase was started. Try again shortly.',purchase_presenter_unavailable:'Close account settings, reopen them, then try your membership again.',purchase_prepare_failed:'Your membership could not be prepared. No new purchase was started. Check your connection, then try again.',purchase_in_progress:'An Apple purchase is still open or being checked. Finish or cancel it with Apple before starting another.',environment_mismatch:'Open the current TenAceIQ TestFlight build and try again.',unsupported_storefront:'TenAceIQ memberships are currently available in the U.S. App Store.',store_busy:'Apple is already open. Finish or cancel that screen first.',store_unavailable:'Apple did not confirm the purchase result. Use Sync purchase before trying another subscription.',unverified_transaction:'Your Apple result could not be verified. Use Sync purchase or Restore purchases.'}
