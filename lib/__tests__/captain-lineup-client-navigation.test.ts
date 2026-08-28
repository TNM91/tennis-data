import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

describe('Captain lineup client navigation', () => {
  it('remounts the Builder when an explicit team or match scope changes', () => {
    expect(page).toContain("import { useRouter, useSearchParams } from 'next/navigation'")
    expect(page).toContain('const routeSearch = searchParams.toString()')
    expect(page).toContain('const builderContextKey = hasExplicitCaptainRouteScope(new URLSearchParams(routeSearch))')
    expect(page).toContain('<LineupBuilderContent key={builderContextKey} routeSearch={routeSearch} />')
    expect(page).toContain('function LineupBuilderContent({ routeSearch }: { routeSearch: string })')
    expect(page).toContain('readInitialLineupBuilderContext(routeSearch, userId)')
  })
})
