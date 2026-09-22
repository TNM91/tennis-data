import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/level-up/level-up-page-content.tsx'), 'utf8')
const styles = readFileSync(join(process.cwd(), 'app/player-development/_components/player-development.module.css'), 'utf8')
const normalizedStyles = styles.replace(/\r\n/g, '\n')

function cssBlock(selector: string) {
  const start = normalizedStyles.indexOf(selector)
  expect(start, `Missing ${selector}`).toBeGreaterThanOrEqual(0)
  const next = normalizedStyles.indexOf('\n.', start + 1)
  return normalizedStyles.slice(start, next === -1 ? undefined : next)
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

  it('adds an on-court brief that turns Player ID into next actions', () => {
    expect(source).toContain('playerIdOnCourtBrief')
    expect(source).toContain('Level Up Player ID on-court brief')
    expect(source).toContain('Before practice')
    expect(source).toContain('During the rep')
    expect(source).toContain('After the score')
    expect(source).toContain('Coach handoff')
    expect(source).toContain('Use ${primaryWeapon} as the intention')
    expect(source).toContain('Score the proof target in plain tennis language')
    expect(source).toContain('Carry the cue into My Lab, matchup prep, or the next practice note')
    expect(source).toContain('Give the coach one saved proof point instead of a generic lesson recap.')
  })

  it('keeps the proof trail compact and mobile-safe', () => {
    expect(normalizedStyles).toContain('.playerIdProofTrail')
    expect(normalizedStyles).toContain('.levelUpMorePanel:not([open]) > .levelUpMoreBody')
    expect(cssBlock('.playerIdProofTrail')).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr))')
    expect(cssBlock('.playerIdProofTrail')).toContain('min-width: 0')
    expect(cssBlock('.playerIdProofTrail article')).toContain('min-width: 0')
    expect(cssBlock('.playerIdProofTrail article')).toContain('overflow-wrap: anywhere')
    expect(cssBlock('.playerIdProofTrail p')).toContain('line-height: 1.42')
  })

  it('keeps the on-court brief compact and phone-safe', () => {
    expect(normalizedStyles).toContain('.playerIdOnCourtBrief')
    expect(cssBlock('.playerIdOnCourtBrief')).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))')
    expect(cssBlock('.playerIdOnCourtBrief')).toContain('min-width: 0')
    expect(cssBlock('.playerIdOnCourtBrief article')).toContain('overflow-wrap: anywhere')
    expect(normalizedStyles).toContain('.playerIdOnCourtBrief {\n    grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(normalizedStyles).toContain('.playerIdOnCourtBrief {\n    grid-template-columns: 1fr;')
  })

  it('keeps the coach assignment Player ID read compact and phone-safe', () => {
    expect(normalizedStyles).toContain('.liveAssignmentPlayerIdRead')
    expect(cssBlock('.liveAssignmentPlayerIdRead')).toContain('grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr)')
    expect(cssBlock('.liveAssignmentPlayerIdRead')).toContain('min-width: 0')
    expect(cssBlock('.liveAssignmentPlayerIdRead article')).toContain('overflow-wrap: anywhere')
    expect(normalizedStyles).toContain('.liveAssignmentPlayerIdRead,')
    expect(normalizedStyles).toContain('.liveAssignmentPlayerIdGrid,')
  })
})
