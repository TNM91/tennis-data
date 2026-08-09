import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const iconSource = read('components/brand/TiqFeatureIcon.tsx')
const portalSource = read('app/components/portal-tool-bar.tsx')
const packageSource = read('package.json')

describe('TenAceIQ feature icon system', () => {
  it('uses one tree-shakeable icon family instead of bespoke SVG drawings', () => {
    expect(packageSource).toContain('"@phosphor-icons/react"')
    expect(iconSource).toContain("from '@phosphor-icons/react/dist/csr/")
    expect(iconSource).not.toContain('<svg')
    expect(iconSource).not.toContain('<path')
    expect(iconSource).not.toContain('<circle')
  })

  it('gives every feature a clear semantic icon plus a tennis accent', () => {
    for (const icon of [
      'GaugeIcon',
      'TennisBallIcon',
      'UsersThreeIcon',
      'ChalkboardTeacherIcon',
      'ChatCircleDotsIcon',
      'ChartLineUpIcon',
      'BinocularsIcon',
      'ClipboardTextIcon',
      'ShieldCheckIcon',
      'RankingIcon',
      'CalendarBlankIcon',
      'PresentationChartIcon',
      'BellRingingIcon',
      'FlaskIcon',
      'LockKeyIcon',
      'BuildingsIcon',
    ]) {
      expect(iconSource).toContain(icon)
    }

    expect(iconSource).toContain('showTennisBadge')
    expect(iconSource).toContain('prefers-reduced-motion: reduce')
  })

  it('keeps League and Club visually distinct in the mobile lane menu', () => {
    expect(portalSource).toContain("id: 'league'")
    expect(portalSource).toContain("icon: 'teamRankings'")
    expect(portalSource).toContain("id: 'club'")
    expect(portalSource).toContain("icon: 'clubOperations'")
  })
})
