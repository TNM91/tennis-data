declare global {
 const TIQ_FIRST_PARTY_BUILD: boolean
}

export const firstPartyBuild = typeof TIQ_FIRST_PARTY_BUILD !== 'undefined' && TIQ_FIRST_PARTY_BUILD
