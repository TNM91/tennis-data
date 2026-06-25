import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/level-up/level-up-page-content.tsx'), 'utf8')
const styles = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development.module.css'), 'utf8')

function cssBlock(selector: string) {
  const start = styles.indexOf(selector)
  expect(start, `Missing ${selector}`).toBeGreaterThanOrEqual(0)
  const next = styles.indexOf('\n.', start + 1)
  return styles.slice(start, next === -1 ? undefined : next)
}

describe('Level Up Player ID proof trail', () => {
  it('connects Level Up identity, drill proof, and saved return path', () => {
    expect(source).toContain('playerIdProofTrail')
    expect(source).toContain('Level Up Player ID proof trail')
    expect(source).toContain('Profile signal')
    expect(source).toContain('Drill proof')
    expect(source).toContain('Coach read')
    expect(source).toContain('Match test')
    expect(source).toContain('Train first')
    expect(source).toContain('Proof target')
    expect(source).toContain('actionRead.levelUpNudge')
    expect(source).toContain('Run the rep, rate the proof, and keep the next tennis cue visible.')
    expect(source).toContain('Save the session so the Player ID can carry proof into My Lab, coach assignments, and the next matchup.')
    expect(source).toContain('The identity is not complete until it shows up in the score moment where the player usually leaks.')
  })

  it('keeps the proof trail compact and mobile-safe', () => {
    expect(styles).toContain('.playerIdProofTrail')
    expect(cssBlock('.playerIdProofTrail')).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr))')
    expect(cssBlock('.playerIdProofTrail')).toContain('min-width: 0')
    expect(cssBlock('.playerIdProofTrail article')).toContain('min-width: 0')
    expect(cssBlock('.playerIdProofTrail article')).toContain('overflow-wrap: anywhere')
    expect(cssBlock('.playerIdProofTrail p')).toContain('line-height: 1.42')
  })
})
