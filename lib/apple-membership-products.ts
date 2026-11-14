import {getPricingPlan} from './pricing-plans'
import {getMembershipTier} from './product-story'

// Proposed Apple products for the approved first-launch scope. Prices here are
// setup checks only: customer-facing prices must come from StoreKit products.
export const APPLE_MEMBERSHIP_GROUP = 'TenAceIQ Memberships'
export const APPLE_LAUNCH_TERRITORIES = ['USA'] as const
export const APPLE_PRO_PRODUCT = {
 planId:'pro',
 productId:'com.tenaceiq.app.pro.monthly',
 groupLevel:1,
 name:'TenAceIQ Pro',
 description:'Run your team with Captain tools and guide your players with Coach tools.',
 period:'ONE_MONTH',
 currency:'USD',
 expectedUSPriceCents:499,
 familySharable:false,
} as const
export const APPLE_MEMBERSHIP_SCOPE_HEADER = 'X-TenAceIQ-Membership-Scope'
export const APPLE_PRO_SCOPE = 'pro-v1'
const selections = [
 {planId:'player_plus',productId:'com.tenaceiq.app.player.monthly',groupLevel:2,description:'My Lab, follows and matchup insights.'},
 {planId:'captain',productId:'com.tenaceiq.app.captain.monthly',groupLevel:1,description:'Player tools, lineups and captain planning.'},
] as const

export const APPLE_MEMBERSHIP_PRODUCTS = selections.map(product=>{
 const plan=getPricingPlan(product.planId)
 return {...product,name:getMembershipTier(product.planId).name,period:'ONE_MONTH' as const,currency:'USD' as const,expectedUSPriceCents:plan.billing.amountCents,familySharable:false}
})

export function appleMembershipOffers(pro: boolean) {
 return pro ? [APPLE_PRO_PRODUCT] : APPLE_MEMBERSHIP_PRODUCTS
}

export function appleMembershipProduct(productId:unknown) {
 if(productId===APPLE_PRO_PRODUCT.productId)return APPLE_PRO_PRODUCT
 return typeof productId==='string'?APPLE_MEMBERSHIP_PRODUCTS.find(product=>product.productId===productId)||null:null
}
