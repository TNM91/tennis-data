import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('award certificate page', () => {
  it('loads a public award certificate and links back into trophy cases', () => {
    const source = readFileSync(join(process.cwd(), 'app/awards/[id]/page.tsx'), 'utf8')

    expect(source).toContain('loadTiqAwardById')
    expect(source).toContain('buildTiqAwardCertificateText')
    expect(source).toContain('TenAceIQ Award Studio')
    expect(source).toContain('#profile-trophy-case')
    expect(source).toContain('window.print()')
    expect(source).toContain('buildAwardEmailHref')
    expect(source).toContain('navigator.share')
    expect(source).toContain('navigator.clipboard.writeText')
    expect(source).toContain('Certificate link copied.')
    expect(source).toContain('@page')
    expect(source).toContain('size: letter landscape')
    expect(source).toContain('tiq-award-certificate')
    expect(source).toContain('print-color-adjust: exact')
    expect(source).toContain('More Tennis. Less Chaos.')
  })

  it('has award-specific metadata and share art', () => {
    const layout = readFileSync(join(process.cwd(), 'app/awards/[id]/layout.tsx'), 'utf8')
    const ogImage = readFileSync(join(process.cwd(), 'app/awards/[id]/opengraph-image.tsx'), 'utf8')
    const routeMetadata = readFileSync(join(process.cwd(), 'lib/route-metadata.ts'), 'utf8')

    expect(layout).toContain('generateMetadata')
    expect(layout).toContain('getAwardMetadataById')
    expect(routeMetadata).toContain('getAwardSharePreview')
    expect(routeMetadata).toContain('const path = `/awards/${encodeURIComponent(id)}`')
    expect(routeMetadata).toContain('`${path}/opengraph-image`')
    expect(ogImage).toContain('TenAceIQ Award')
    expect(ogImage).toContain('preview.badgeCode')
    expect(ogImage).toContain('More Tennis. Less Chaos.')
  })
})
