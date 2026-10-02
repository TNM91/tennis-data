/** Research context only: league division is not an official individual rating. */
export function individualAdultDivisionLevel(leagueName: string, season: number): number | null {
  if (!Number.isInteger(season) || season < 1900 || season > 9999 || !new RegExp('^' + season + '\\b').test(leagueName) || !/\badult\b/i.test(leagueName) || /mixed|combo|tournament|tri[-\s]?level/i.test(leagueName)) return null
  const values = [...new Set([...leagueName.matchAll(/\b(\d{1,2}\.[05])\b/g)].map(match => Number(match[1])))]
  return values.length === 1 && values[0] >= 1.5 && values[0] < 6 ? values[0] : null
}
