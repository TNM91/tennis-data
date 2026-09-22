import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const captainSource = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
const launchSource = readFileSync(join(process.cwd(), 'app/components/captain-launch-path.tsx'), 'utf8')
const messagingSource = readFileSync(join(process.cwd(), 'app/captain/messaging/page.tsx'), 'utf8')

describe('Captain launch surface', () => {
  it('keeps onboarding connected to Captain rather than adding a separate dashboard', () => {
    expect(captainSource).toContain('<CaptainLaunchPath')
    expect(captainSource).toContain('captainContactsImportHref')
    expect(captainSource).toContain('captainLaunchInviteHref')
    expect(launchSource).toContain('Open setup guide')
    expect(launchSource).toContain('#captain-setup')
    expect(launchSource).not.toContain('Team launch complete')
    expect(launchSource).toContain("['team', 'league', 'flight']")
  })

  it('prepares a privacy-respecting player ID text from the final launch step', () => {
    expect(messagingSource).toContain("searchParams.get('setup') === 'team-link'")
    expect(messagingSource).toContain('Connect your TenAceIQ Player ID')
    expect(messagingSource).toContain('You stay in control of the connection.')
    expect(messagingSource).toContain('markCaptainLaunchOutreachStarted')
  })
})
