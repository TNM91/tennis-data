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

  it('saves phone-only contacts without including an email field', () => {
    const payload = source.slice(source.indexOf('const contactPayload ='), source.indexOf('const select ='))
    expect(payload).toContain('phone,')
    expect(payload).not.toContain('email')
    expect(source).toContain(".from('captain_message_contacts').insert")
    expect(source).toContain(".from('captain_message_contacts').update")
  })

  it('only updates a contact already scoped to the selected team', () => {
    expect(source).toContain(".select('id,team_name')")
    expect(source).toContain(".eq('id', contactId)")
    expect(source).toContain('normalizeTeamRoomKey(existingContact.team_name)')
  })

  it('records a structured production error if a save fails', () => {
    expect(source).toContain("console.error('[api/captain/team-contacts] contact save failed'")
    expect(source).toContain('saveResult.error?.message')
  })
})
