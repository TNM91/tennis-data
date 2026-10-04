export type TiqEvidenceShape = {
  tiq_rating_status?: 'current' | 'provisional' | 'review' | null
  tiq_rating_model?: string | null
  tiq_rating_season?: number | null
  tiq_singles_matches?: number | null
  tiq_doubles_matches?: number | null
}
export function getTiqEvidence(player: TiqEvidenceShape | null | undefined, format: 'overall' | 'singles' | 'doubles', season = new Date().getUTCFullYear()) {
  const singles = player?.tiq_singles_matches ?? 0, doubles = player?.tiq_doubles_matches ?? 0
  const matches = format === 'singles' ? singles : format === 'doubles' ? doubles : singles + doubles
  if (!player?.tiq_rating_model || player.tiq_rating_season !== season || !player.tiq_rating_status) return { status: 'unknown' as const, matches: 0, label: 'TIQ estimate awaiting refresh' }
  if (player.tiq_rating_status === 'review') return { status: 'review' as const, matches: 0, label: 'TIQ under review' }
  return matches > 0 ? { status: 'current' as const, matches, label: 'Current TIQ estimate' } : { status: 'provisional' as const, matches: 0, label: 'Provisional starting estimate' }
}
