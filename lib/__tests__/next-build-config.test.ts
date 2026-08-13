import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Next.js production build configuration', () => {
  it('uses the Next.js 16 default Turbopack build on the pinned Node runtime', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      engines?: { node?: string }
      scripts?: { build?: string }
    }
    const nvmVersion = readFileSync(join(process.cwd(), '.nvmrc'), 'utf8').trim()

    expect(packageJson.scripts?.build).toBe('next build')
    expect(packageJson.engines?.node).toBe('22.x')
    expect(nvmVersion).toBe('22')
  })
})
