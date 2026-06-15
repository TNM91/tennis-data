import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/manage/page.tsx'), 'utf8')

describe('Manage hub organizer path', () => {
  it('keeps the Manage hub connected to the combined leagues and tournaments path', () => {
    expect(source).toContain("secondary={{ href: '/leagues-and-tournaments', label: 'Run a League or Tournament' }}")
    expect(source).toContain("eyebrow: 'Organizer hub'")
    expect(source).toContain('Choose the right league or tournament path')
    expect(source).toContain('Use the combined organizer hub')
    expect(source).toContain("href: '/leagues-and-tournaments'")
    expect(source).toContain("cta: 'Open Organizer Hub'")
    expect(source).toContain("job: 'organize_competition'")
    expect(source).toContain('Open League Office')
    expect(source).toContain('Open Tournament Desk')
  })
})
