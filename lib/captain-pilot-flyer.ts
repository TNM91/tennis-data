import { CAPTAIN_PILOT_PRICE_LABEL, CAPTAIN_PILOT_TRIAL_MONTHS } from './captain-pilot'

export const CAPTAIN_PILOT_FLYER = {
  title: 'Local Tennis Captains',
  offer: `${CAPTAIN_PILOT_TRIAL_MONTHS} months of Captain free`,
  duration: `${CAPTAIN_PILOT_TRIAL_MONTHS} consecutive months of Captain access from activation.`,
  renewal: `Then ${CAPTAIN_PILOT_PRICE_LABEL} until canceled. Cancel before renewal to avoid a charge.`,
  applyUrl: 'https://www.tenaceiq.com/captain-pilot',
  pdfPath: '/media/captain-pilot/fall-2026-flyer.pdf',
  benefits: [
    'Everything in Player, plus Team Hub and Captain tools.',
    'Know who can play before building your lineup.',
    'Build and compare your team courts.',
    'Scout opponents when you want a deeper match read.',
    'Share the lineup and print a match-day scorecard.',
  ],
  terms: `Offer available through December 31, 2026, for eligible local tennis captains. Captain tier only. One claim per captain or team. New Captain pilot participants only; not transferable, resalable, or combinable with other offers. Trial begins when checkout is completed. Captain access renews at ${CAPTAIN_PILOT_PRICE_LABEL} until canceled. TenAceIQ may revoke access for misuse or modify the offer where permitted.`,
} as const
