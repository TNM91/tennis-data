import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/my-lab-command-center.tsx'), 'utf8')

describe('My Lab player language', () => {
  it('uses direct player language in the premium command header', () => {
    expect(source).toContain('<small>Player tools</small>')
    expect(source).not.toContain('Player workspace')
  })
})
