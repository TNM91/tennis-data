import type { SupabaseClient } from '@supabase/supabase-js'

export type SourceEventCourt = { fingerprint: string; sourceUrl: string }
type Evidence = { id: string; fingerprint: string; source_url: string | null }

/** A URL spelling, participant fingerprint or score is not a source event ID. */
export function tennisRecordSourceEventId(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value.replace(/&amp;/gi, '&'))
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port
      || !['tennisrecord.com', 'www.tennisrecord.com'].includes(url.hostname.toLowerCase())
      || url.pathname.toLowerCase() !== '/adult/matchresults.aspx') return null
    const params = [...url.searchParams]
    const years = params.filter(([key]) => key.toLowerCase() === 'year').map(([, v]) => v)
    const mids = params.filter(([key]) => key.toLowerCase() === 'mid').map(([, v]) => v)
    if (years.length !== 1 || mids.length !== 1 || !/^\d{4}$/.test(years[0]) || !/^\d+$/.test(mids[0])) return null
    const mid = mids[0].replace(/^0+/, '')
    return mid ? `tennisrecord:${years[0]}:${mid}` : null
  } catch { return null }
}

const UNKNOWN = 'Source event could not be verified. Original scorecard retained; review before updating this match.'
const COLLISION = 'Different source events share this match record. Original scorecards retained; review before updating either result.'

/** Keep legacy fingerprints stable, but never treat one as proof of event identity.
 * Inspect ALL retained rows, including superseded/quarantined evidence; the latest
 * row alone can conceal the earlier half of a doubleheader. Errors fail closed.
 */
export async function tennisRecordEventReviews(
  service: SupabaseClient,
  courts: SourceEventCourt[],
  associatedFingerprints: string[] = [],
): Promise<Map<string, string>> {
  const reviews = new Map<string, string>()
  const expected = new Map<string, string>()
  for (const court of courts) {
    const event = tennisRecordSourceEventId(court.sourceUrl)
    if (!event) reviews.set(court.fingerprint, UNKNOWN)
    else if (expected.has(court.fingerprint) && expected.get(court.fingerprint) !== event) reviews.set(court.fingerprint, COLLISION)
    else expected.set(court.fingerprint, event)
  }
  const fingerprints = [...new Set([...courts.map(c => c.fingerprint), ...associatedFingerprints])]
  const evidence: Evidence[] = []
  // Match pages are small. Chunking also protects manual/bulk callers.
  for (let start = 0; start < fingerprints.length; start += 100) {
    for (const table of ['tennisrecord_staged_matches', 'tennisrecord_match_observations']) {
      for (let offset = 0; ; offset += 200) {
        let query = service.from(table).select('id,fingerprint,source_url').in('fingerprint', fingerprints.slice(start, start + 100))
        if (table === 'tennisrecord_match_observations') query = query.eq('source', 'tennisrecord')
        const result = await query.order('id').range(offset, offset + 199)
        if (result.error || !Array.isArray(result.data)) throw new Error(`Could not verify source event identity: ${result.error?.message || 'missing evidence response'}`)
        evidence.push(...result.data as Evidence[])
        if (result.data.length < 200) break
      }
    }
  }
  for (const court of courts) {
    const event = expected.get(court.fingerprint)
    if (!event) continue
    for (const row of evidence.filter(r => r.fingerprint === court.fingerprint || associatedFingerprints.includes(r.fingerprint))) {
      const prior = tennisRecordSourceEventId(row.source_url)
      if (!prior) reviews.set(court.fingerprint, UNKNOWN)
      else if (prior !== event) reviews.set(court.fingerprint, COLLISION)
    }
    if (associatedFingerprints.some(fingerprint => !evidence.some(row => row.fingerprint === fingerprint))) reviews.set(court.fingerprint, UNKNOWN)
  }
  return reviews
}
