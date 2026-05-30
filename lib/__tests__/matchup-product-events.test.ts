import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const matchupSource = readFileSync(join(process.cwd(), 'app/matchup/page.tsx'), 'utf8')
const eventsSource = readFileSync(join(process.cwd(), 'lib/product-usage-events.ts'), 'utf8')

describe('Matchup product events', () => {
  it('allows the public Matchup hook events from the product brief', () => {
    for (const eventName of [
      'matchup_started',
      'player_a_selected',
      'player_b_selected',
      'matchup_preview_viewed',
      'matchup_unlock_clicked',
    ]) {
      expect(eventsSource).toContain(`'${eventName}'`)
      expect(matchupSource).toContain(`eventName: '${eventName}'`)
    }
  })

  it('tracks preview views, player selections, and unlock intent with matchup metadata', () => {
    expect(matchupSource).toContain('previewTrackedRef')
    expect(matchupSource).toContain("surface: 'matchup'")
    expect(matchupSource).toContain("matchType: 'singles'")
    expect(matchupSource).toContain("matchType: 'doubles'")
    expect(matchupSource).toContain("location: 'matchup_upgrade_prompt'")
    expect(matchupSource).toContain('confidence: projection.confidenceLabel')
  })

  it('makes the public demo explain free preview and Player unlock value', () => {
    expect(matchupSource).toContain('const matchupPreviewTiers')
    expect(matchupSource).toContain('Matchup preview access')
    expect(matchupSource).toContain('Free preview')
    expect(matchupSource).toContain('Rating gap, recent form signal, and one watch item')
    expect(matchupSource).toContain('Player unlock')
    expect(matchupSource).toContain('My Lab adds full notes, split detail, confidence, upset risk, history, and saved takeaways.')
  })
})
