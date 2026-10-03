export type TiqBandStatus = 'Next band' | 'Upper band' | 'Within band' | 'Below band' | 'Lower band'

/** TIQ display-band position relative to the published level; not a USTA forecast. */
export function getTiqBandStatus(base: number, strength: number): TiqBandStatus {
  if (strength >= base + 0.5) return 'Next band'
  if (strength >= base + 0.35) return 'Upper band'
  if (strength >= base) return 'Within band'
  if (strength >= base - 0.15) return 'Below band'
  return 'Lower band'
}
