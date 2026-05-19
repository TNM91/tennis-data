import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'lib/design-system.ts'), 'utf8')

function styleBlock(name: string) {
  const pattern = new RegExp(`export const ${name}: CSSProperties = \\{([\\s\\S]*?)\\n\\}`)
  return source.match(pattern)?.[1] ?? ''
}

describe('shared design system mobile layout guards', () => {
  it('keeps shared shells and background effects from forcing horizontal overflow', () => {
    expect(styleBlock('pageBackground')).toContain('minWidth: 0')
    expect(styleBlock('pageShell')).toContain('minWidth: 0')
    expect(styleBlock('pageShellTight')).toContain('minWidth: 0')
    expect(styleBlock('sectionStack')).toContain('minWidth: 0')
    expect(styleBlock('pageShell')).toContain("width: 'min(1280px, calc(100% - clamp(24px, 5vw, 32px)))'")
    expect(styleBlock('pageShellTight')).toContain("width: 'min(1120px, calc(100% - clamp(24px, 5vw, 32px)))'")

    expect(styleBlock('orbOne')).toContain("width: 'min(100%, 360px)'")
    expect(styleBlock('orbOne')).toContain("height: 'min(100%, 360px)'")
    expect(styleBlock('orbOne')).toContain("maxWidth: '100%'")
    expect(styleBlock('orbTwo')).toContain("width: 'min(100%, 320px)'")
    expect(styleBlock('orbTwo')).toContain("height: 'min(100%, 320px)'")
    expect(styleBlock('orbTwo')).toContain("maxWidth: '100%'")

    expect(source).not.toContain("width: '420px'")
    expect(source).not.toContain("height: '420px'")
    expect(source).not.toContain("calc(100% - 32px)")
  })
})
