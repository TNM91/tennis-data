import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const faqSource = readFileSync(join(process.cwd(), 'app/faq/page.tsx'), 'utf8')
const globalsSource = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
const actionGridSource = readFileSync(join(process.cwd(), 'app/components/info-action-grid.tsx'), 'utf8')

function styleBlock(source: string, styleName: string) {
  const pattern = new RegExp(`const ${styleName}(?:: CSSProperties)? = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
  const match = source.match(pattern)
  if (!match) throw new Error(`Missing style block: ${styleName}`)
  return match[0]
}

describe('FAQ tool-first layout', () => {
  it('keeps FAQ entry points short and user-directed', () => {
    expect(faqSource).toContain('Common questions about TenAceIQ.')
    expect(faqSource).toContain('Start with the tool you need. Open the details only when you want the longer answer.')
    expect(faqSource).toContain('Pick a plan')
    expect(faqSource).toContain('Compare Free, My Lab, Team Hub, League Office, and Full-Court.')
    expect(faqSource).toContain('Fix data')
    expect(faqSource).toContain('Ask support')
    expect(faqSource).toContain('Start with the tennis need, account, and data context together.')
    expect(faqSource).not.toContain('These answers explain what TenAceIQ is built to do')
    expect(faqSource).not.toContain('Need data fixed?')
    expect(faqSource).not.toContain('Need help?')
  })

  it('keeps FAQ details and info action cards compact on phones', () => {
    expect(styleBlock(faqSource, 'faqDetailsSectionStyle')).toContain("display: 'block'")
    expect(styleBlock(faqSource, 'faqDetailsSectionStyle')).not.toContain("display: 'grid'")
    expect(faqSource).toContain('className="publicInfoDetailsSection"')
    expect(globalsSource).toContain('.publicInfoDetailsSection:not([open]) > :not(summary)')
    expect(styleBlock(faqSource, 'faqDetailsSummaryStyle')).toContain('borderRadius: 8')
    expect(styleBlock(faqSource, 'faqDetailsSummaryStyle')).toContain("padding: '9px 11px'")
    expect(styleBlock(faqSource, 'faqDetailsCueStyle')).toContain('minHeight: 28')
    expect(styleBlock(faqSource, 'faqDetailsCueStyle')).toContain('fontSize: 11')
    expect(styleBlock(faqSource, 'faqDetailsContentStyle')).toContain('fontSize: 13')
    expect(styleBlock(faqSource, 'faqDetailsContentStyle')).toContain('lineHeight: 1.5')

    expect(styleBlock(actionGridSource, 'gridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))'")
    expect(styleBlock(actionGridSource, 'gridStyle')).toContain('gap: 10')
    expect(actionGridSource).toContain('size="sm"')
    expect(styleBlock(actionGridSource, 'cardStyle')).toContain("gridTemplateColumns: '34px minmax(0, 1fr)'")
    expect(styleBlock(actionGridSource, 'cardStyle')).toContain('minHeight: 78')
    expect(styleBlock(actionGridSource, 'cardStyle')).toContain('borderRadius: 8')
    expect(styleBlock(actionGridSource, 'cardStyle')).toContain('padding: 10')
  })
})
