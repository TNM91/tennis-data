import {describe,it,expect} from 'vitest'
import {AppleProductError,appleProductError,appleProductNotice,parseAppleProducts} from '../../mobile/src/apple-product-catalog'
const player={id:'com.tenaceiq.app.player.monthly',price:'$1.99'},captain={id:'com.tenaceiq.app.captain.monthly',price:'$4.99'}
describe('Apple price discovery',()=>{
 it('shows a valid returned plan even when Apple omits the other plan',()=>{
  expect(parseAppleProducts({available:true,products:[player]})).toMatchObject([{productId:player.id,name:'Player',price:'$1.99'}])
  expect(parseAppleProducts({available:true,products:[captain,player]}).map(p=>p.productId)).toEqual([player.id,captain.id])
 })
 it('never invents prices or accepts duplicate, unknown, empty or malformed products',()=>{
  for(const products of [[player,player],[{...player,id:'com.other.app'}],[{...player,price:''}],[{...player,price:'x'.repeat(65)}],[null],[],null])expect(()=>parseAppleProducts({available:true,products})).toThrow(AppleProductError)
  for(const input of [null,{},[],{available:false,products:[player]}])expect(()=>parseAppleProducts(input)).toThrow(AppleProductError)
 })
 it('distinguishes price lookup failures from restoring an existing purchase',()=>{
  const failure=appleProductError({code:'products_request_failed',data:{supportCode:'NSURLErrorDomain:-1009'},message:'sensitive raw error'})
  expect(appleProductNotice(failure)).toEqual({message:'Apple could not load membership prices. Check your connection, then try again.',supportCode:'NSURLErrorDomain:-1009'})
  expect(appleProductNotice({code:'unsupported_storefront'}).message).toContain('U.S. App Store')
  expect(appleProductNotice({code:'storefront_unavailable'}).message).toContain('App Store region')
  expect(appleProductNotice({code:'products_not_found'}).message).toContain('not returning')
  expect(appleProductNotice({code:'app_identity_mismatch'}).message).toContain('Update TenAceIQ')
 })
 it('exposes only a bounded support category and numeric code, never raw error or account data',()=>{
  for(const unsafe of ['owner@example.com','signed.receipt.sig','https://private.invalid/?token=secret','x'.repeat(90),'ASDErrorDomain:123456789012']){
   const result=appleProductNotice({code:'products_request_failed',data:{supportCode:unsafe},message:unsafe})
   expect(result.supportCode).toBe('products_request_failed');expect(JSON.stringify(result)).not.toContain(unsafe)
  }
  expect(appleProductNotice({code:'secret',message:'secret'}).supportCode).toBe('products_request_failed')
 })
})
