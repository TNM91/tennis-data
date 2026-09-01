import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/api/captain/team-contacts/route.ts'), 'utf8')

describe('captain team contacts route', () => {
  it('requires authenticated Captain access and a valid mobile number', () => {
    expect(source).toContain('getCaptainApiAuth(request)')
    expect(source).toContain('digits.length < 10')
    expect(source).toContain('Captain access is required for this team.')
  })

  it('saves a phone-only contact in the roster-contact record used by imports and the Builder', () => {
    const payload = source.slice(source.indexOf('const contactPayload ='), source.indexOf('const select ='))
    expect(payload).toContain('phone,')
    expect(payload).toContain("email: existingContact?.email || ''")
    expect(source).toContain(".from(CAPTAIN_ROSTER_CONTACTS_TABLE).upsert")
    expect(source).toContain(".from(CAPTAIN_ROSTER_CONTACTS_TABLE).update")
    expect(source).toContain("onConflict: 'captain_user_id,normalized_team_name,normalized_name,league_name,flight'")
  })

  it('only updates a contact already scoped to the selected team', () => {
    expect(source).toContain(".select('id,team_name,captain_user_id,email,source,source_batch_id')")
    expect(source).toContain(".eq('id', contactId)")
    expect(source).toContain('normalizeTeamRoomKey(data.team_name) !== normalizeTeamRoomKey(teamName)')
  })

  it('records a structured production error if a save fails', () => {
    expect(source).toContain("console.error('[api/captain/team-contacts] contact save failed'")
    expect(source).toContain('saveResult.error?.message')
  })
})
