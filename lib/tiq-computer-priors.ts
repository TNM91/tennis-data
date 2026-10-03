export type ComputerPriorLabel = { playerId: string; level: number; designation: string; effectiveDate: string; currentLabel: string }

/** Two preceding annual ratings are age-independent; a third requires verified age. */
export function selectComputerPriors(labels: ComputerPriorLabel[], season: number) {
  const latest = new Map<string, ComputerPriorLabel[]>()
  for (const label of labels) {
    if (!label.playerId || ![`${season - 1}-12-31`, `${season - 2}-12-31`].includes(label.effectiveDate)) continue
    const rows = latest.get(label.playerId)
    if (!rows || rows[0].effectiveDate < label.effectiveDate) latest.set(label.playerId, [label])
    else if (rows[0].effectiveDate === label.effectiveDate) rows.push(label)
  }
  const priors = new Map<string, number>()
  for (const [id, rows] of latest) {
    if (rows.some(r => r.designation !== 'computer' || !Number.isFinite(r.level) || r.level < 1.5 || r.level > 7 || !Number.isInteger(r.level * 2)) || new Set(rows.map(r => r.level)).size !== 1) continue
    // Carry-forward requires the current owner profile to still state the same C label.
    if (rows[0].effectiveDate === `${season - 2}-12-31` && rows.some(r => !new RegExp(`^\\s*${r.level.toFixed(1).replace('.', '\\.')}\\s*C\\s*$`, 'i').test(r.currentLabel))) continue
    priors.set(id, rows[0].level)
  }
  return priors
}
