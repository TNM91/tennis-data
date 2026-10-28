import {getPricingPlan} from './pricing-plans'
import {getMembershipTier} from './product-story'

// Proposed Apple products for the approved first-launch scope. Prices here are
// setup checks only: customer-facing prices must come from StoreKit products.
export const APPLE_MEMBERSHIP_GROUP = 'TenAceIQ Memberships'
export const APPLE_LAUNCH_TERRITORIES = ['USA'] as const
const selections = [
 {planId:'player_plus',productId:'com.tenaceiq.app.player.monthly',groupLevel:2,description:'My Lab, follows and matchup insights.'},
 {planId:'captain',productId:'com.tenaceiq.app.captain.monthly',groupLevel:1,description:'Player tools, lineups and captain planning.'},
] as const

export const APPLE_MEMBERSHIP_PRODUCTS = selections.map(product=>{
 const plan=getPricingPlan(product.planId)
 return {...product,name:getMembershipTier(product.planId).name,period:'ONE_MONTH' as const,currency:'USD' as const,expectedUSPriceCents:plan.billing.amountCents,familySharable:false}
})

export function appleMembershipProduct(productId:unknown) {
 return typeof productId==='string'?APPLE_MEMBERSHIP_PRODUCTS.find(product=>product.productId===productId)||null:null
}
