import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/api/player/coach-assignments/route.ts'), 'utf8')

describe('player coach assignment ownership', () => {
  it('requires the assignment link to belong to the signed-in player before completion', () => {
    expect(source).toContain('getSignedInPlayerApiAuth')
    expect(source).toContain(".from('coach_player_links')")
    expect(source).toContain(".eq('id', existing.studentLinkId)")
    expect(source).toContain(".eq('player_user_id', auth.userId)")
    expect(source).toContain("if (!linkData)")
    expect(source).toContain("Assignment was not found for this player.")
    expect(source).toContain(".eq('student_link_id', existing.studentLinkId)")
  })
})
