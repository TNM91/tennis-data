import {describe,expect,it} from 'vitest'
import {ApplePurchaseError,appleNativePurchaseError,appleNativeRestoreError,applePurchaseFailureText} from '../../mobile/src/apple-purchase-progress'
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
  expect(appleNativePurchaseError({code:'purchase_preparation_failed',data:{supportCode:'app_authentication/StoreKit.StoreKitError:2'}})).toMatchObject({beforeConfirmation:true,supportCode:'app_authentication/StoreKit.StoreKitError:2'})
  for(const code of ['store_unavailable','purchase_product_unavailable','purchase_not_allowed','private_code'])expect(appleNativePurchaseError({code}).beforeConfirmation).toBe(false)
  expect(appleNativePurchaseError({code:'private_code',data:{supportCode:'user-email/private'}})).toMatchObject({message:'store_unavailable',supportCode:''})
 })
})

it('uses restore-specific copy and sanitized diagnostics even for legacy or unknown native errors',()=>{
 for(const code of ['store_unavailable','private_code','restore_unavailable','restore_cancelled','restore_history_timeout','environment_mismatch','store_busy']){
  const error=appleNativeRestoreError({code,message:'private account',data:{supportCode:'restore/StoreKit.StoreKitError:2',build:'171',receipt:'private'}})
  expect(error.message).toBe(['store_unavailable','private_code'].includes(code)?'restore_unavailable':code);expect(error.supportCode).toBe('restore/StoreKit.StoreKitError:2');expect(error.beforeConfirmation).toBe(false);expect(JSON.stringify(error)).not.toContain('private')
 }
 expect(applePurchaseFailureText.restore_unavailable).not.toContain('confirm the purchase');expect(appleNativeRestoreError({data:{supportCode:'restore/email:1',build:'secret'}})).toMatchObject({message:'restore_unavailable',supportCode:'',build:''})
})
