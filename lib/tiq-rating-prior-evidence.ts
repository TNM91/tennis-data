import { normalizedTennisRecordPlayerName, parseTennisRecordMatchPage, tennisRecordStatedNtrpBaseline } from './tennisrecord/parser'
import type { V2Prior } from './tiq-rating-v2'

export function recoverCapturedComputerPrior(input: { playerId: string; name: string; profileUrl: string; sourcePageId: string; capturedAt: string; html: string; season: number }) {
  const url = new URL(input.profileUrl)
  if (!['www.tennisrecord.com', 'tennisrecord.com'].includes(url.hostname) || !['https:', 'http:'].includes(url.protocol) || url.pathname !== '/adult/profile.aspx') return null
  const page = parseTennisRecordMatchPage(input.html, input.profileUrl)
  if (page.reviewReason) return null
  const owner = page.players.find(p => p.sourceUrl === input.profileUrl && normalizedTennisRecordPlayerName(p) === normalizedTennisRecordPlayerName({ name: input.name } as typeof p))
  if (!owner || owner.ntrpDesignation !== 'computer' || owner.ntrpEffectiveDate !== `${input.season}-12-31`) return null
  const level = tennisRecordStatedNtrpBaseline(owner.ntrpLabel)
  if (level === null) return null
  return { playerId: input.playerId, season: input.season, level, source: input.profileUrl, independentlyVerified: false, evidenceKind: 'captured-owner-profile-prior', sourcePageId: input.sourcePageId, capturedAt: input.capturedAt } satisfies V2Prior & { evidenceKind: string; sourcePageId: string; capturedAt: string }
}
