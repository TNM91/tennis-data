import {getPricingPlan} from './pricing-plans'
import {MAX_TIQ_LEAGUE_WEEKS} from './tiq-league-limits'
import {formatTournamentEventFee} from './tournament-event-presentation'

export const FIRST_PARTY_COMPETITION_FEES = {
  tournament: {productId: 'com.tenaceiq.app.tournament.publish', amountCents: 500, currency: 'usd', per: 'event'},
  league: {
    productId: 'com.tenaceiq.app.league.publish',
    amountCents: getPricingPlan('league').billing.amountCents,
    currency: 'usd',
    per: 'season',
    maxWeeks: MAX_TIQ_LEAGUE_WEEKS,
  },
} as const

export function competitionFeeLabel(kind: keyof typeof FIRST_PARTY_COMPETITION_FEES) {
  const fee = FIRST_PARTY_COMPETITION_FEES[kind]
  return formatTournamentEventFee(fee.amountCents / 100, fee.currency)
}
