import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/upgrade-prompt.tsx'), 'utf8')

describe('upgrade prompt naming', () => {
  it('uses named workspaces in the generic upgrade guidance', () => {
    expect(source).toContain('Add My Lab, Team Hub, or League Office only when they help.')
    expect(source).not.toContain('personal, team, or league workspaces')
  })
})
