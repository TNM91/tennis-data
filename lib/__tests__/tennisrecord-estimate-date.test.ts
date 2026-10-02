import { describe, expect, it } from 'vitest'
import { parseTennisRecordMatchPage } from '../tennisrecord/parser'

describe('TennisRecord estimate provenance', () => {
  it('keeps the estimate measurement date separate from the annual rating date', () => {
    const page = parseTennisRecordMatchPage('<h1>Player Profile</h1><h2>Nathan Meinert</h2><p>(Lake Saint Louis, MO) Male 4.5 C 12/31/2025</p><p>Estimated Dynamic Rating 4.3075 8/23/2026</p>', 'https://www.tennisrecord.com/adult/profile.aspx?playername=Nathan%20Meinert')
    const owner = page.players.find(player => player.name === 'Nathan Meinert')!
    expect(owner.ntrpEffectiveDate).toBe('2025-12-31')
    expect(owner.publishedRatingDate).toBe('2026-08-23')
    expect(owner.projectedYearEndLevel).toBeUndefined()
  })

  it('does not turn a blank projected level followed by a rating meter into a forecast', () => {
    const url = 'https://www.tennisrecord.com/adult/profile.aspx?playername=Nathan%20Meinert'
    const blank = parseTennisRecordMatchPage('<h2>Nathan Meinert</h2><p>4.5 C 12/31/2025</p><p>Projected Year End Rating ------ ---------- 4.5 Rating Meter</p>', url)
    expect(blank.players[0].projectedYearEndLevel).toBeUndefined()
    const stated = parseTennisRecordMatchPage('<h2>Nathan Meinert</h2><p>4.5 C 12/31/2025</p><p>Projected Year End Rating 4.0</p>', url)
    expect(stated.players[0].projectedYearEndLevel).toBe(4)
  })
})
