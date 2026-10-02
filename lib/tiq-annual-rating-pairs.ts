export type AnnualRatingLabel = { playerId: string; level: number; designation: string; effectiveDate: string; sourceUrl: string }
/** Preserve identity parameters: `s` distinguishes same-name TennisRecord profiles. */
export function tennisRecordAnnualIdentity(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl)
    if (!['https:', 'http:'].includes(url.protocol) || !['www.tennisrecord.com', 'tennisrecord.com'].includes(url.hostname.toLowerCase()) || url.pathname.toLowerCase() !== '/adult/profile.aspx') return null
    const name = url.searchParams.get('playername')?.trim().toLowerCase()
    if (!name) return null
    url.searchParams.set('playername', name)
    url.searchParams.sort()
    return `tennisrecord.com/adult/profile.aspx?${url.searchParams.toString()}`
  } catch { return null }
}
export function validateTennisRecordAnnualPair(start: AnnualRatingLabel, end: AnnualRatingLabel) {
  const reasons: string[] = []
  if (!start.playerId || start.playerId !== end.playerId) reasons.push('canonical_identity_mismatch')
  if ([start, end].some(label => label.designation !== 'computer' || !Number.isFinite(label.level) || label.level < 1.5 || label.level > 7 || !Number.isInteger(label.level * 2))) reasons.push('invalid_computer_rating')
  const validAnnualDate = (date: string) => /^\d{4}-12-31$/.test(date) && Number.isFinite(Date.parse(date))
  if (!validAnnualDate(start.effectiveDate) || !validAnnualDate(end.effectiveDate) || Number(end.effectiveDate.slice(0, 4)) !== Number(start.effectiveDate.slice(0, 4)) + 1) reasons.push('invalid_annual_window')
  const startIdentity = tennisRecordAnnualIdentity(start.sourceUrl), endIdentity = tennisRecordAnnualIdentity(end.sourceUrl)
  if (!startIdentity || !endIdentity) reasons.push('missing_source_identity')
  else if (startIdentity !== endIdentity) reasons.push('different_source_profiles_require_identity_review')
  return { admitted: reasons.length === 0, reasons, startIdentity, endIdentity, independentlyVerified: false as const }
}
