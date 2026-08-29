import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

describe('team contact route', () => {
  it('uses the dedicated captain messaging route for roster contact actions', () => {
    expect(source).toContain("const teamContactsBaseHref = buildCaptainScopedHref('/captain/messaging', {")
    expect(source).toContain('const teamContactsHref = `${teamContactsBaseHref}')
    expect(source).toContain("contactView=all#captain-contact-manager")
  })
})
