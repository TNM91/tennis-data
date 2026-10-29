import {describe,expect,it} from 'vitest'
import {ApplePurchaseError,appleNativePurchaseError} from '../../mobile/src/apple-purchase-progress'
describe('private Apple purchase diagnostics',()=>{
 it('keeps only known stages, numeric error codes and public build numbers',()=>{
  const failure=appleNativePurchaseError({code:'store_unavailable',message:'private receipt',data:{supportCode:'confirmation/StoreKit.StoreKitError:0/ASDErrorDomain:500',build:'168',receipt:'private'}})
  expect(failure).toMatchObject({message:'store_unavailable',beforeConfirmation:false,supportCode:'confirmation/StoreKit.StoreKitError:0/ASDErrorDomain:500',build:'168'})
  expect(JSON.stringify(failure)).not.toContain('private')
 })
 it('rejects arbitrary domains, stages, text and overlong error chains',()=>{
  for(const detail of ['confirmation/private-user:1','private/StoreKit:0','confirmation/StoreKit:receipt','confirmation/StoreKit:1<script>','confirmation/StoreKit:1/StoreKit:2/StoreKit:3/StoreKit:4','confirmation/SKErrorDomain:12345678901','confirmation/StoreKit:1/'])expect(new ApplePurchaseError('store_unavailable',false,detail,'private').supportCode).toBe('')
  expect(new ApplePurchaseError('store_unavailable',false,{},'168x').build).toBe('')
 })
 it('treats only explicit preparation failures as safe before-confirmation failures',()=>{
  expect(appleNativePurchaseError({code:'purchase_preparation_failed',data:{supportCode:'app_receipt/NSURLErrorDomain:-1009'}})).toMatchObject({message:'purchase_preparation_failed',beforeConfirmation:true,supportCode:'app_receipt/NSURLErrorDomain:-1009'})
  for(const code of ['store_unavailable','purchase_product_unavailable','purchase_not_allowed','private_code'])expect(appleNativePurchaseError({code}).beforeConfirmation).toBe(false)
  expect(appleNativePurchaseError({code:'private_code',data:{supportCode:'user-email/private'}})).toMatchObject({message:'store_unavailable',supportCode:''})
 })
})
