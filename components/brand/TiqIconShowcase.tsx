'use client'

import type { CSSProperties } from 'react'
import BrandWordmark from '@/app/components/brand-wordmark'
import TiqFeatureIcon, { tiqFeatureIconLabels, tiqFeatureIconNames, type TiqFeatureIconName } from './TiqFeatureIcon'

type TiqIconShowcaseProps = {
  compact?: boolean
  names?: TiqFeatureIconName[]
}

export default function TiqIconShowcase({ compact = false, names = tiqFeatureIconNames }: TiqIconShowcaseProps) {
  return (
    <div style={showcaseShellStyle}>
      <div style={showcaseHeaderStyle}>
        <BrandWordmark compact={compact} top={!compact} />
        <div style={taglineStyle}>Tennis intelligence. Elevated.</div>
      </div>

      <div style={showcaseGridStyle}>
        {names.map((name) => (
          <div key={name} className="tiq-icon-cell" style={iconCellStyle}>
            <div style={iconStageStyle}>
              <TiqFeatureIcon name={name} size={compact ? 'lg' : 'xl'} variant="ghost" />
            </div>
            <div style={iconLabelStyle}>{tiqFeatureIconLabels[name]}</div>
          </div>
        ))}
      </div>

      <div style={systemStripStyle}>
        <div>
          <div style={stripKickerStyle}>Icon system</div>
          <div style={stripTextStyle}>Tennis intelligence symbols built from the TenAceIQ ball, monoline strokes, and IQ green accents.</div>
        </div>
        <div style={stripItemStyle}>
          <TiqFeatureIcon name="myLab" size="sm" variant="ghost" />
          <span>Ball head identity</span>
        </div>
        <div style={stripItemStyle}>
          <span style={sampleLineStyle} />
          <span>Consistent monoline</span>
        </div>
        <div style={stripItemStyle}>
          <span style={sampleDotStyle} />
          <span>Navy, white, green</span>
        </div>
      </div>

      <style jsx>{`
        .tiq-icon-cell:hover {
          background: color-mix(in srgb, var(--brand-green, #9be11d) 6%, transparent);
        }

        .tiq-icon-cell:hover :global(.tiq-feature-icon) {
          --tiq-icon-shadow: rgba(155, 225, 29, 0.14);
        }
      `}</style>
    </div>
  )
}

const showcaseShellStyle: CSSProperties = {
  display: 'grid',
  gap: 20,
  padding: '22px clamp(14px, 2vw, 24px) 20px',
  borderRadius: 20,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2, #74beff) 18%, transparent)',
  background:
    'radial-gradient(circle at 50% 0%, rgba(74,163,255,0.14), transparent 38%), radial-gradient(circle at 78% 100%, rgba(155,225,29,0.07), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--surface-strong, #071326) 94%, #000 6%) 0%, var(--surface-strong, #071326) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 44px rgba(2,8,20,0.18)',
}

const showcaseHeaderStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  gap: 4,
  paddingTop: 4,
  textAlign: 'center',
}

const taglineStyle: CSSProperties = {
  color: 'var(--muted-strong, rgba(229,238,251,0.74))',
  fontSize: 'clamp(11px, 1.5vw, 14px)',
  fontWeight: 700,
  letterSpacing: '0.28em',
  lineHeight: 1.35,
  textTransform: 'uppercase',
}

const showcaseGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))',
  borderTop: '1px solid color-mix(in srgb, var(--brand-blue-2, #74beff) 16%, transparent)',
  borderLeft: '1px solid color-mix(in srgb, var(--brand-blue-2, #74beff) 16%, transparent)',
}

const iconCellStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  alignContent: 'center',
  gap: 12,
  minHeight: 190,
  padding: '22px 14px 18px',
  borderRight: '1px solid color-mix(in srgb, var(--brand-blue-2, #74beff) 16%, transparent)',
  borderBottom: '1px solid color-mix(in srgb, var(--brand-blue-2, #74beff) 16%, transparent)',
  transition: 'background 160ms ease',
}

const iconStageStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 112,
  height: 104,
}

const iconLabelStyle: CSSProperties = {
  color: 'var(--foreground-strong, #f8fbff)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.14em',
  lineHeight: 1.45,
  textAlign: 'center',
  textTransform: 'uppercase',
}

const systemStripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 14,
  alignItems: 'center',
  padding: '16px 18px',
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2, #74beff) 14%, transparent)',
  background: 'color-mix(in srgb, var(--surface-soft, #10213b) 52%, transparent)',
}

const stripKickerStyle: CSSProperties = {
  color: 'var(--brand-green, #9be11d)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
}

const stripTextStyle: CSSProperties = {
  marginTop: 6,
  color: 'var(--muted-strong, rgba(229,238,251,0.74))',
  fontSize: 13,
  lineHeight: 1.45,
}

const stripItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: 'var(--muted-strong, rgba(229,238,251,0.74))',
  fontSize: 12,
  lineHeight: 1.35,
}

const sampleLineStyle: CSSProperties = {
  width: 44,
  height: 3,
  borderRadius: 999,
  background: 'var(--foreground-strong, #f8fbff)',
}

const sampleDotStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--foreground-strong, #f8fbff) 0 45%, var(--brand-green, #9be11d) 45% 100%)',
}
