import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('saved tournament room next move', () => {
  it('keeps saved event cards focused on one state-aware action', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('recordNextMove')
    expect(source).toContain('recordProfileReadyCount')
    expect(source).toContain('recordScheduledMatchCount')
    expect(source).toContain('recordNextMoveStyle')
    expect(source).toContain("loadRecordSection(record, recordNextMove.href.replace('#', ''))")
    expect(source).toContain('Create the first tournament room.')
    expect(source).toContain('emptySavedRoomStyle')
    expect(source).toContain('Calendar fills from match slots.')
    expect(source).toContain('calendarEmptyStateStyle')
    expect(source).toContain('Entry queue is clear.')
    expect(source).toContain('Private draw.')
    expect(source).toContain('Awards unlock from completed results.')
    expect(source).toContain('tournamentActionEmptyStyle')
    expect(source).toContain("selectedRecord ? '#tournament-scorebook' : '#tournament-setup'")
    expect(source).toContain('href="#tournament-setup"')
    expect(source).toContain('Open room')
    expect(source).toContain('Public view')
    expect(source).not.toContain('No tournaments saved yet. Build the first draw above.')
    expect(source).not.toContain('No pending entries. Share the public bracket link when registration opens.')
    expect(source).not.toContain('Turn on public registration in tournament setup to collect player entry requests.')
    expect(source).not.toContain('Complete the final, then create awards for 1st, 2nd, and 3rd place.')
    expect(source).not.toContain(">Awards</button>")
    expect(source).not.toContain(">Alerts</button>")
  })
})
