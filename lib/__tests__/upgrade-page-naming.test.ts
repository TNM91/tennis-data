import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/upgrade/page.tsx'), 'utf8')

describe('upgrade page naming', () => {
  it('uses public/workspace naming in unlock and success copy', () => {
    for (const phrase of [
      'Continue with Team Hub',
      'Preview Team Hub',
      'Continue with League Office',
      'Preview League Office',
      'Coach Hub is active',
      'Team Hub is active',
      'League Office is active',
      'Tournament Desk operations',
    ]) {
      expect(source).toContain(phrase)
    }

    for (const oldPhrase of [
      "primaryAction: 'Open Coach'",
      "primaryAction: 'Open Team'",
      "primaryAction: 'Open League'",
      "title: 'League is active.",
      "title: 'Team is active.",
      "secondaryAction: 'View leagues'",
      "secondaryHref: '/compete'",
      'Player, Coach, Captain, League, and unlimited tournaments',
    ]) {
      expect(source).not.toContain(oldPhrase)
    }
  })
})
