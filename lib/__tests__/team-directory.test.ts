import { describe, expect, it } from 'vitest'
import { isPublicTeamDirectoryName } from '../team-directory'

describe('public team directory trust filter', () => {
  it('keeps factual team names while rejecting page headings and league metadata', () => {
    expect(isPublicTeamDirectoryName('Masengill/Suddarth (S)', '2026 Adult 18+ Missouri Valley Missouri St. Louis M 4.0')).toBe(true)
    expect(isPublicTeamDirectoryName('Match Results', '2026 Adult 18+ Missouri Valley Missouri St. Louis M 4.0')).toBe(false)
    expect(isPublicTeamDirectoryName('2026 Adult 18+ Missouri Valley Missouri St. Louis M 4.0', '2026 Adult 18+ Missouri Valley Missouri St. Louis M 4.0')).toBe(false)
    expect(isPublicTeamDirectoryName('2025 Adult 18+ Missouri Valley Missouri St. Louis F 4.0')).toBe(false)
    expect(isPublicTeamDirectoryName('Home Team')).toBe(false)
  })
})
