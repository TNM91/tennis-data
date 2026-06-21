import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('Tournament Desk naming', () => {
  it('uses Tournament Desk on tournament tools and unavailable-event CTAs', () => {
    const workspace = source('app/components/tournament-builder-workspace.tsx')
    const publicEvent = source('app/tournaments/[id]/page.tsx')

    expect(workspace).toContain('Tournament Desk')
    expect(workspace).toContain('Issue certificates, badges, and recap alerts from Tournament Desk.')
    expect(workspace).toContain('Unlock League or Full-Court before saving tournament rooms.')
    expect(workspace).toContain('League includes one tournament room. Full-Court unlocks unlimited tournaments.')
    expect(workspace).not.toContain('Tournament Builder')
    expect(workspace).not.toContain('same workspace')
    expect(workspace).not.toContain('tournament workspace')
    expect(workspace).not.toContain('tournament workspaces')
    expect(publicEvent).toContain('Open Tournament Desk')
    expect(publicEvent).not.toContain('Open tournament workspace')
    expect(publicEvent).not.toContain('Open Tournament Builder')
  })
})
