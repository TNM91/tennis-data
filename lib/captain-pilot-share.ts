import { CAPTAIN_PILOT_FLYER } from './captain-pilot-flyer'

export const CAPTAIN_PILOT_SHARE = {
  url: CAPTAIN_PILOT_FLYER.applyUrl.split('?')[0],
  title: `Tennis captains: ${CAPTAIN_PILOT_FLYER.offer}`,
  description: `Know who can play, build your lineup, and scout opponents. ${CAPTAIN_PILOT_FLYER.renewal}`,
  image: '/brand/social/captain-pilot-fall-2026-v1.png',
  imageAlt: `TenAceIQ Fall Captain Pilot: ${CAPTAIN_PILOT_FLYER.offer}. ${CAPTAIN_PILOT_FLYER.renewal}`,
  text: `Captain a tennis team? Try TenAceIQ with ${CAPTAIN_PILOT_FLYER.offer.toLowerCase()} for availability, lineups, and scouting. ${CAPTAIN_PILOT_FLYER.renewal}`,
} as const

export const CAPTAIN_PILOT_SHARE_MESSAGE = `${CAPTAIN_PILOT_SHARE.text}\n${CAPTAIN_PILOT_SHARE.url}`
