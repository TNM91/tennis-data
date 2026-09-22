export type ClubMemberRole = 'owner' | 'admin' | 'director' | 'coach' | 'captain' | 'coordinator' | 'player' | 'guardian'
export type ClubMembershipStatus = 'active' | 'inactive' | 'removed'

export type ClubAffiliation = {
  clubId: string
  clubName: string
  clubSlug: string
  role: ClubMemberRole
  status: ClubMembershipStatus
  locationId: string
  locationName: string
  linkedPlayerId: string
}

export function clubMembershipUsesExistingAccount() {
  return true
}

export function describeClubAccountConnection(hasTenAceIqAccount: boolean) {
  return hasTenAceIqAccount
    ? 'Accept the club invitation with the same TenAceIQ account. Your Player ID, match history, rating, follows, My Lab, and coach connections stay with you.'
    : 'Create one TenAceIQ account from the club invitation, then claim or create a Player ID. The new club affiliation and future tennis history use that same identity.'
}
