import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/upgrade-prompt.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Upgrade prompt mobile layout guards', () => {
  it('keeps unlock step rows shrink-safe beside long tier copy', () => {
    expect(styleBlock('unlockStepGridStyle')).toContain('minWidth: 0')
    expect(styleBlock('unlockStepStyle')).toContain("'minmax(0, auto) minmax(0, 1fr)'")
    expect(styleBlock('unlockStepStyle')).toContain('minWidth: 0')
    expect(styleBlock('unlockStepStyle')).toContain("overflowWrap: 'anywhere'")
    expect(source).not.toContain("'auto minmax(0, 1fr)'")
  })
})
