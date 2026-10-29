import {APPLE_MEMBERSHIP_PRODUCTS,appleMembershipProduct} from '../../lib/apple-membership-products'

const codes=['products_unavailable','products_not_found','products_invalid','products_request_failed','storefront_unavailable','unsupported_storefront','environment_mismatch','app_identity_mismatch'] as const
type ProductErrorCode=typeof codes[number]
export class AppleProductError extends Error {
 readonly supportCode:string
 constructor(readonly code:ProductErrorCode,supportCode:unknown=''){
  super(code);this.name='AppleProductError'
  this.supportCode=typeof supportCode==='string'&&/^[A-Za-z][A-Za-z0-9._-]{0,63}:-?\d{1,10}$/.test(supportCode)?supportCode:''
 }
}
export function appleProductError(error:unknown){
 if(error instanceof AppleProductError)return error
 const value=error&&typeof error==='object'?error as {code?:unknown;data?:{supportCode?:unknown}}:{}
 return new AppleProductError(codes.includes(value.code as ProductErrorCode)?value.code as ProductErrorCode:'products_request_failed',value.data?.supportCode)
}
export function appleProductNotice(error:unknown){
 const failure=appleProductError(error)
 const messages:Record<ProductErrorCode,string>={
  products_unavailable:'Apple has not returned membership prices yet. Retry loading plans.',
  products_not_found:'Apple is not returning the membership plans for this app yet. Try again shortly.',
  products_invalid:'Apple’s plan information could not be verified. Retry loading plans.',
  products_request_failed:'Apple could not load membership prices. Check your connection, then try again.',
  storefront_unavailable:'Apple could not identify your App Store region. Check Media & Purchases in Settings, then try again.',
  unsupported_storefront:'TenAceIQ memberships are currently available in the U.S. App Store.',
  environment_mismatch:'Open TenAceIQ from TestFlight and try again.',
  app_identity_mismatch:'Update TenAceIQ in TestFlight, then reopen the app.'
 }
 return {message:messages[failure.code],supportCode:failure.supportCode||failure.code}
}
export function parseAppleProducts(value:unknown){
 const result=value&&typeof value==='object'?value as {available?:unknown;products?:unknown}:{}
 if(result.available!==true)throw new AppleProductError('products_unavailable')
 if(!Array.isArray(result.products)||!result.products.length)throw new AppleProductError('products_not_found')
 const rows=result.products as {id?:unknown;price?:unknown}[]
 if(rows.length>APPLE_MEMBERSHIP_PRODUCTS.length||new Set(rows.map(p=>p?.id)).size!==rows.length||rows.some(p=>!p||!appleMembershipProduct(p.id)||typeof p.price!=='string'||!p.price.trim()||p.price.length>64))throw new AppleProductError('products_invalid')
 return APPLE_MEMBERSHIP_PRODUCTS.flatMap(product=>{const row=rows.find(p=>p.id===product.productId);return row?[{...product,price:row.price as string}]:[]})
}
