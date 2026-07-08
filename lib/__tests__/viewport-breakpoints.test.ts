import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'lib/use-viewport-breakpoints.ts'), 'utf8')

describe('viewport breakpoint store', () => {
  it('reconciles the server fallback width after hydration', () => {
    expect(source).toContain('const DEFAULT_SCREEN_WIDTH = 390')
    expect(source).toContain('window.requestAnimationFrame(onStoreChange)')
    expect(source).toContain('window.cancelAnimationFrame(frame)')
    expect(source).toContain('window.addEventListener(\'resize\', onStoreChange)')
    expect(source).toContain('window.removeEventListener(\'resize\', onStoreChange)')
  })
})
