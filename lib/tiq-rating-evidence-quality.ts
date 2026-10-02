export type RatingEvidenceCourt = {
  id: string
  date: string
  format: 'singles' | 'doubles'
  partnerId?: string
  opponentIds: string[]
}

/** Evidence inventory only. Thresholds are descriptive, not calibrated confidence. */
export function summarizeRatingEvidence(input: {
  cutoff: string
  format: 'singles' | 'doubles'
  courts: RatingEvidenceCourt[]
  missingOfficialCourts: number
  priorVerified: boolean
  anchorDistance?: number
}) {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
  if (!validDate(input.cutoff) || !Number.isInteger(input.missingOfficialCourts) || input.missingOfficialCourts < 0) throw new Error('Invalid evidence input')
  const seen = new Set<string>()
  const courts = input.courts.filter(court => {
    if (!validDate(court.date)) throw new Error('Invalid court date')
    if (court.date > input.cutoff || court.format !== input.format || seen.has(court.id)) return false
    seen.add(court.id)
    return true
  })
  const days = new Set(courts.map(court => court.date)).size
  const partners = new Set(courts.flatMap(court => court.partnerId ? [court.partnerId] : []))
  const opponents = new Set(courts.flatMap(court => court.opponentIds))
  const reasons: string[] = []
  if (input.anchorDistance !== undefined && (!Number.isInteger(input.anchorDistance) || input.anchorDistance < 0)) throw new Error('Invalid anchor distance')
  if ((input.anchorDistance ?? 0) > 2) reasons.push('distant_rating_anchor')
  if (!input.priorVerified) reasons.push('unverified_prior')
  if (input.missingOfficialCourts) reasons.push('missing_official_results')
  if (courts.length < 3) reasons.push('few_courts')
  if (days < 3) reasons.push('few_playing_days')
  if (input.format === 'doubles' && partners.size < 2) reasons.push('limited_partner_variety')
  if (input.format === 'doubles' && courts.some(court => !court.partnerId)) reasons.push('missing_partner_identity')
  if (courts.some(court => court.opponentIds.length !== (input.format === 'singles' ? 1 : 2))) reasons.push('incomplete_opponent_identity')
  return {
    cutoff: input.cutoff, format: input.format, courts: courts.length, playingDays: days,
    distinctPartners: partners.size, distinctOpponents: opponents.size,
    latestCourt: courts.map(court => court.date).sort().at(-1) ?? null,
    missingOfficialCourts: input.missingOfficialCourts,
    provisional: reasons.length > 0, reasons,
    confidenceCalibrated: false as const,
    movementForecastAvailable: false as const,
  }
}
