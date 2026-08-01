export const TEAM_INVITE_OFFER_WINDOW_DAYS = 14

export type TeamInviteOffer = {
  available: boolean
  label: string
}

export type TeamInviteOffers = {
  captain: TeamInviteOffer
  player: TeamInviteOffer
}

export function getTeamInviteOfferAcceptedSince(nowMs = Date.now()) {
  return new Date(nowMs - TEAM_INVITE_OFFER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export function resolveTeamInviteOffer(input: {
  couponId: string
  label: string
  hasActiveAccess: boolean
  hasRecentAcceptedLink: boolean
  hasPriorSubscription: boolean
}) {
  const available = Boolean(
    input.couponId &&
    !input.hasActiveAccess &&
    input.hasRecentAcceptedLink &&
    !input.hasPriorSubscription,
  )
  return {
    available,
    label: available ? input.label : '',
    couponId: available ? input.couponId : '',
  }
}
