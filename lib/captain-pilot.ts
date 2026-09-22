import { getPricingPlan } from './pricing-plans'

export const CAPTAIN_PILOT_CAMPAIGN_KEY = 'fall-2026-captain-pilot'
export const CAPTAIN_PILOT_TRIAL_MONTHS = 3
export const CAPTAIN_PILOT_PRICE_LABEL = getPricingPlan('captain').priceLabel
export const CAPTAIN_PILOT_END_AT = '2027-01-01T00:00:00-06:00'

export type CaptainPilotAvailability = 'active' | 'expired'

export function getCaptainPilotAvailability(now = new Date()): CaptainPilotAvailability {
  const timestamp = now.getTime()
  if (timestamp >= Date.parse(CAPTAIN_PILOT_END_AT)) return 'expired'
  return 'active'
}

export function buildCaptainPilotTrialEnd(now = new Date()) {
  const end = new Date(now)
  const originalDay = end.getUTCDate()
  end.setUTCDate(1)
  end.setUTCMonth(end.getUTCMonth() + CAPTAIN_PILOT_TRIAL_MONTHS)
  const lastDayOfTargetMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth))
  return Math.floor(end.getTime() / 1000)
}

export function normalizeCaptainPilotTeamKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}
