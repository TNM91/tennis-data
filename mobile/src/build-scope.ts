declare global {
 const TIQ_FIRST_PARTY_BUILD: boolean
 const TIQ_TOURNAMENT_PRACTICE: boolean
}

export const firstPartyBuild = typeof TIQ_FIRST_PARTY_BUILD !== 'undefined' && TIQ_FIRST_PARTY_BUILD
