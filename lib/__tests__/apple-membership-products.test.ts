import {expect,it} from 'vitest'
import {APPLE_MEMBERSHIP_PRODUCTS,appleMembershipProduct} from '../apple-membership-products'
import {getPricingPlan} from '../pricing-plans'
it('maps only the two approved Apple products to the existing monthly account plans',()=>{
 for(const product of APPLE_MEMBERSHIP_PRODUCTS){const plan=getPricingPlan(product.planId as 'player_plus'|'captain');expect(plan.billing).toMatchObject({interval:'month',checkoutMode:'subscription',quantityMode:'account',currency:'usd',amountCents:product.expectedUSPriceCents});expect(appleMembershipProduct(product.productId)).toBe(product)}
 for(const value of [null,{},'player_plus','com.tenaceiq.app.coach.monthly','com.tenaceiq.app.player.monthly.extra',' com.tenaceiq.app.player.monthly','COM.TENACEIQ.APP.PLAYER.MONTHLY'])expect(appleMembershipProduct(value)).toBeNull()
 expect(new Set(APPLE_MEMBERSHIP_PRODUCTS.map(x=>x.productId)).size).toBe(APPLE_MEMBERSHIP_PRODUCTS.length)
 expect(appleMembershipProduct('com.tenaceiq.app.captain.monthly')!.groupLevel).toBeLessThan(appleMembershipProduct('com.tenaceiq.app.player.monthly')!.groupLevel)
})
