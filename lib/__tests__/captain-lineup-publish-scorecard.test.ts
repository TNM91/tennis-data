import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const builder = readFileSync(join(process.cwd(), 'app', 'captain', 'lineup-builder', 'page.tsx'), 'utf8')
const sheet = readFileSync(join(process.cwd(), 'app', 'captain', 'matchup-sheet', 'page.tsx'), 'utf8')
const room = readFileSync(join(process.cwd(), 'app', 'team-room', 'page.tsx'), 'utf8')

describe('Captain lineup publishing and scorecard handoff', () => {
  it('restores an assigned saved lineup instead of leaving the captain in an empty builder', () => {
    expect(builder).toContain('const savedLineupRestoreAppliedRef = useRef(false)')
    expect(builder).toContain('const scenarioToRestore = currentScenario ?? scopedScenario ?? fallbackScenario')
    expect(builder).toContain("setMessage('Saved lineup restored. Your draft will keep saving on this phone.')")
    expect(builder).toContain('Save lineup version')
    expect(builder).toContain('Your draft saves automatically on this phone.')
  })

  it('gives captains a native-share lineup image and a printable, scannable scorecard', () => {
    expect(sheet).toContain('async function createLineupImage')
    expect(sheet).toContain('Share final lineup + chat')
    expect(sheet).toContain('navigator.canShare?.({ files: [file] })')
    expect(sheet).toContain('Team Chat: ${teamChatUrl}')
    expect(sheet).toContain('Print one-page scorecard')
    expect(sheet).toContain('Capture completed scorecard')
    expect(sheet).toContain('This scorecard stays connected to the confirmed lineup and match.')
  })

  it('opens the share and print card from the confirmed Team Room lineup', () => {
    expect(room).toContain('Share / print confirmed lineup')
    expect(room).toContain('confirmed=1')
  })
})
