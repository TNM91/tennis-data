import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('Coach Hub naming', () => {
  it('uses Coach Hub on visible coach workspace entry points', () => {
    const coachPage = source('app/coach/page.tsx')
    const messagesPage = source('app/messages/page.tsx')
    const loginPage = source('app/login/page.tsx')
    const portal = source('app/components/portal-tool-bar.tsx')
    const coachInvite = source('app/coach/invite/[token]/page.tsx')

    expect(coachPage).toContain('Could not load Coach Hub.')
    expect(coachPage).toContain('Coach Hub brings lesson plans')
    expect(coachPage).toContain('<div style={eyebrowStyle}>Coach Hub</div>')
    expect(messagesPage).toContain('Open Coach Hub')
    expect(loginPage).toContain("destination: 'Coach Hub'")
    expect(portal).toContain("title: 'Coach Hub'")
    expect(coachInvite).toContain('message you from Coach Hub')

    for (const text of [coachPage, messagesPage, loginPage, portal, coachInvite]) {
      expect(text).not.toContain('Coach workspace')
    }
  })
})
