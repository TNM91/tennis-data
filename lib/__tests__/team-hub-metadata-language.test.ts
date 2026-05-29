import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routeMetadataSource = readFileSync(join(process.cwd(), 'lib/route-metadata.ts'), 'utf8')
const adSlotSource = readFileSync(join(process.cwd(), 'app/components/adsense-slot.tsx'), 'utf8')
const scenarioBuilderSource = readFileSync(join(process.cwd(), 'app/captain/scenario-builder/page.tsx'), 'utf8')

describe('Team Hub metadata language', () => {
  it('uses Team Hub language in team route metadata and ad support copy', () => {
    expect(routeMetadataSource).toContain('Team Hub context')
    expect(routeMetadataSource).not.toContain('Captain workflow')
    expect(routeMetadataSource).not.toContain('Captain context')

    expect(adSlotSource).toContain('player tools and Team Hub')
    expect(adSlotSource).not.toContain('Captain workspaces')

    expect(scenarioBuilderSource).toContain('Team Hub workflow')
    expect(scenarioBuilderSource).not.toContain('Captain workflow')
  })
})
