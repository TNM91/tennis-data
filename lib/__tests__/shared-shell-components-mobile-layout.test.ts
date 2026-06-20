import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const adminGateSource = readFileSync(join(process.cwd(), 'app/components/admin-gate.tsx'), 'utf8')
const adsenseSlotSource = readFileSync(join(process.cwd(), 'app/components/adsense-slot.tsx'), 'utf8')
const globalErrorSource = readFileSync(join(process.cwd(), 'app/global-error.tsx'), 'utf8')

function styleBlock(source: string, name: string) {
  const pattern = new RegExp(`const ${name}: CSSProperties = \\{([\\s\\S]*?)\\n\\}`)
  return source.match(pattern)?.[1] ?? ''
}

describe('shared shell component mobile layout guards', () => {
  it('keeps AdminGate loading and redirect states mobile-safe', () => {
    expect(adminGateSource).toContain('const gateShellStyle: CSSProperties')
    expect(adminGateSource).toContain('const gateCardBaseStyle: CSSProperties')
    expect(adminGateSource).toContain('style={gateShellStyle}')
    expect(adminGateSource).toContain('style={gateLoadingCardStyle}')
    expect(adminGateSource).toContain('style={gateDeniedCardStyle}')
    expect(styleBlock(adminGateSource, 'gateShellStyle')).toContain('minWidth: 0')
    expect(styleBlock(adminGateSource, 'gateCardBaseStyle')).toContain('minWidth: 0')
    expect(styleBlock(adminGateSource, 'gateCardBaseStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps AdsenseSlot labels, cards, and safe-area shell mobile-safe', () => {
    expect(adsenseSlotSource).toContain('const adShellStyle: CSSProperties')
    expect(adsenseSlotSource).toContain('const adCardStyle: CSSProperties')
    expect(adsenseSlotSource).toContain('style={adShellStyle}')
    expect(adsenseSlotSource).toContain('style={adCardStyle}')
    expect(styleBlock(adsenseSlotSource, 'adShellStyle')).toContain('minWidth: 0')
    expect(styleBlock(adsenseSlotSource, 'adCardStyle')).toContain('minWidth: 0')
    expect(styleBlock(adsenseSlotSource, 'adCardStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(adsenseSlotSource, 'adHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock(adsenseSlotSource, 'adHeaderStyle')).toContain('minWidth: 0')
    expect(styleBlock(adsenseSlotSource, 'adLabelStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(adsenseSlotSource, 'adPlacementStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(adsenseSlotSource, 'adCopyStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps the global error fallback shell mobile-safe', () => {
    expect(globalErrorSource).toContain("width: 'calc(100% - clamp(24px, 6vw, 48px))'")
    expect(globalErrorSource).toContain('Try again to reopen TenAceIQ.')
    expect(globalErrorSource).toContain('minWidth: 0')
    expect(globalErrorSource).toContain("overflowWrap: 'anywhere'")
    expect(globalErrorSource).not.toContain('Try again to reopen the platform.')
    expect(globalErrorSource).not.toContain("calc(100% - 48px)")
  })
})
