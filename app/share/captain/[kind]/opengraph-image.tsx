/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og'
import { getCaptainShareConfig, isCaptainShareKind, type CaptainShareKind } from '@/lib/captain-share-preview'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function PreviewGraphic({ kind, accent }: { kind: CaptainShareKind; accent: string }) {
  if (kind === 'final-result') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', width: 120, height: 120, alignItems: 'center', justifyContent: 'center', borderRadius: 28, background: accent, color: 'rgb(6, 23, 47)', fontSize: 54, fontWeight: 950 }}>3</div>
        <div style={{ display: 'flex', color: '#fff', fontSize: 54, fontWeight: 900 }}>—</div>
        <div style={{ display: 'flex', width: 120, height: 120, alignItems: 'center', justifyContent: 'center', borderRadius: 28, border: `2px solid ${accent}`, color: '#fff', fontSize: 54, fontWeight: 950 }}>2</div>
      </div>
    )
  }
  if (kind === 'availability') {
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        {['IN', 'MAYBE', 'OUT'].map((label, index) => (
          <div key={label} style={{ display: 'flex', padding: '18px 22px', borderRadius: 999, background: index === 0 ? accent : 'rgba(255,255,255,0.08)', border: `2px solid ${accent}`, color: index === 0 ? 'rgb(6, 23, 47)' : '#fff', fontSize: 24, fontWeight: 950 }}>{label}</div>
        ))}
      </div>
    )
  }
  if (kind === 'practice') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ display: 'flex', width: 120, height: 120, alignItems: 'center', justifyContent: 'center', borderRadius: 30, background: accent, color: 'rgb(6, 23, 47)', fontSize: 56, fontWeight: 950 }}>IN</div>
        <div style={{ display: 'flex', flexDirection: 'column', color: '#fff', fontSize: 25, fontWeight: 850 }}>
          <span>COURTS RESERVED</span>
          <span style={{ color: '#a9bdd3', marginTop: 8 }}>Add your name</span>
        </div>
      </div>
    )
  }
  if (kind === 'live-scorecard') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '22px 28px', borderRadius: 24, border: `2px solid ${accent}`, background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 30, fontWeight: 950 }}>
        <span style={{ display: 'flex', width: 18, height: 18, borderRadius: 99, background: accent }} />COURT 1 · LIVE
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[1, 2, 3].map((court) => (
        <div key={court} style={{ display: 'flex', alignItems: 'center', width: 390, padding: '15px 20px', borderRadius: 18, border: `2px solid ${accent}`, background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 24, fontWeight: 900 }}>
          <span style={{ display: 'flex', width: 42, color: accent }}>{court}</span><span>COURT ASSIGNMENT</span>
        </div>
      ))}
    </div>
  )
}

export default async function Image({ params }: { params: Promise<{ kind: string }> }) {
  const { kind: value } = await params
  const kind: CaptainShareKind = isCaptainShareKind(value) ? value : 'lineup'
  const config = getCaptainShareConfig(kind)

  return new ImageResponse(
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 58, overflow: 'hidden', background: 'linear-gradient(135deg, rgb(6, 23, 47) 0%, #09284b 58%, #0c3d4e 100%)', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ position: 'absolute', right: -100, bottom: -130, display: 'flex', width: 610, height: 610, borderRadius: 999, border: `2px solid ${config.accent}`, opacity: 0.17 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img
          src="https://www.tenaceiq.com/brand/web/header-logo-transparent.png"
          alt="TenAceIQ"
          width="300"
          height="78"
          style={{ width: 300, height: 78, objectFit: 'contain' }}
        />
        <div style={{ display: 'flex', padding: '10px 18px', borderRadius: 999, background: `${config.accent}22`, border: `1px solid ${config.accent}66`, color: config.secondaryAccent, fontSize: 21, fontWeight: 950, letterSpacing: '0.11em', textTransform: 'uppercase' }}>{config.eyebrow}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 44 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 650 }}>
          <div style={{ display: 'flex', color: config.accent, fontSize: 27, fontWeight: 900, textTransform: 'uppercase' }}>Tap to open</div>
          <div style={{ display: 'flex', fontSize: 72, lineHeight: 0.98, fontWeight: 950, letterSpacing: '-0.04em' }}>{config.title}</div>
          <div style={{ display: 'flex', color: '#cbd9ea', fontSize: 27, lineHeight: 1.25 }}>{config.description}</div>
        </div>
        <PreviewGraphic kind={kind} accent={config.accent} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a9bdd3', fontSize: 23, fontWeight: 800 }}>
        <span>CAPTAIN · TEAM HUB</span><span style={{ color: '#C8F56B' }}>More Tennis. Less Chaos.</span>
      </div>
    </div>,
    size,
  )
}
