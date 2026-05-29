import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('Tournament Desk naming', () => {
  it('uses Tournament Desk on tournament workspace and unavailable-event CTAs', () => {
    const workspace = source('app/components/tournament-builder-workspace.tsx')
    const publicEvent = source('app/tournaments/[id]/page.tsx')

    expect(workspace).toContain('Tournament Desk')
    expect(workspace).not.toContain('Tournament Builder')
    expect(publicEvent).toContain('Open Tournament Desk')
    expect(publicEvent).not.toContain('Open Tournament Builder')
  })
})
