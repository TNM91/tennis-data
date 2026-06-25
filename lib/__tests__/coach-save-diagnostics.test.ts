import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const studentsRoute = readFileSync(join(process.cwd(), 'app/api/coach/students/route.ts'), 'utf8')
const invitesRoute = readFileSync(join(process.cwd(), 'app/api/coach/invites/route.ts'), 'utf8')

describe('coach save diagnostics', () => {
  it('labels student save failures and phone pattern issues clearly', () => {
    expect(studentsRoute).toContain('buildCoachStudentSaveErrorMessage')
    expect(studentsRoute).toContain('Student record failed: the saved phone format was rejected.')
    expect(studentsRoute).toContain('6365778790')
    expect(studentsRoute).toContain('+16365778790')
    expect(studentsRoute).toContain('Student record failed: the saved identifier format was rejected.')
  })

  it('labels setup link save failures separately from student saves', () => {
    expect(invitesRoute).toContain('buildCoachInviteSaveErrorMessage')
    expect(invitesRoute).toContain('Setup link failed: the saved invite identifier was rejected.')
    expect(invitesRoute).toContain('Setup link failed:')
  })
})
