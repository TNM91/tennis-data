import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const errorSource = readFileSync(join(process.cwd(), 'app/error.tsx'), 'utf8')
const notFoundSource = readFileSync(join(process.cwd(), 'app/not-found.tsx'), 'utf8')

describe('fallback pages mobile layout guards', () => {
  it('keeps fallback page actions from forcing horizontal overflow', () => {
    for (const source of [errorSource, notFoundSource]) {
      expect(source).toContain('minWidth: 0')
      expect(source).toContain("maxWidth: '100%'")
      expect(source).toContain("whiteSpace: 'normal'")
      expect(source).toContain("overflowWrap: 'anywhere'")
    }

    expect(errorSource).toContain("minWidth: 'min(100%, 130px)'")
    expect(notFoundSource).toContain("minWidth: 'min(100%, 140px)'")
    expect(errorSource).not.toContain('minWidth: 130')
    expect(notFoundSource).not.toContain('minWidth: 140')
  })
})
