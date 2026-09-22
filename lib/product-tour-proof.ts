export type VerifiedProductTourProof = {
  id: string
  quote: string
  memberName: string
  memberRole: string
  organization?: string
  verifiedOn: string
}

// Publish only statements confirmed by the member and approved for public use.
// Keeping this empty prevents placeholder or invented testimonials from reaching production.
export const VERIFIED_PRODUCT_TOUR_PROOF: readonly VerifiedProductTourProof[] = []
