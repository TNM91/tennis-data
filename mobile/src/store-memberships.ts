// The default and iOS build keeps the existing Apple purchase implementation.
// Android resolves this boundary to store-memberships-android.ts at build time.
export {applePurchases as storePurchases} from './apple-purchases'
export {mountAppleMemberships as mountStoreMemberships} from './apple-memberships'
export const storeMembershipLabel='Apple membership'
export const storeCancellationNotice='Any Apple subscription must be canceled in your Apple subscription settings.'
