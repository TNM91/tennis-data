import { ImageResponse } from 'next/og'
import { getTiqShareCardLabel, type TiqShareCardKind } from './share-card'

export const TIQ_SHARE_CARD_SIZE = { width: 1200, height: 630 }

export function renderTiqShareCard(input: {
  kind: TiqShareCardKind
  title: string
  subtitle: string
  detail: string
}) {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', padding: 56, background: 'linear-gradient(135deg,#06172f 0%,#0b2346 58%,#0d4852 100%)', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ width: '66%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', color: '#9be11d', fontSize: 25, fontWeight: 900, letterSpacing: 3 }}>TENACEIQ</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', marginBottom: 16, color: '#9be11d', fontSize: 31, fontWeight: 900 }}>{getTiqShareCardLabel(input.kind)}</div>
          <div style={{ display: 'flex', fontSize: input.title.length > 34 ? 58 : 72, lineHeight: .98, fontWeight: 950 }}>{input.title}</div>
          {input.subtitle ? <div style={{ display: 'flex', marginTop: 16, color: '#d9e6f2', fontSize: 34, fontWeight: 800 }}>{input.subtitle}</div> : null}
        </div>
        <div style={{ display: 'flex', color: '#b9cadb', fontSize: 25, fontWeight: 700 }}>{input.detail || 'More Tennis. Less Chaos.'}</div>
      </div>
      <div style={{ width: '34%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EntityIllustration kind={input.kind} />
      </div>
    </div>,
    TIQ_SHARE_CARD_SIZE,
  )
}

function EntityIllustration({ kind }: { kind: TiqShareCardKind }) {
  if (kind === 'player') {
    return <div style={{ width: 330, height: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, borderRadius: 34, background: 'rgba(4,20,40,.72)', border: '2px solid rgba(155,225,29,.42)' }}><div style={{ width: 126, height: 126, display: 'flex', borderRadius: 999, background: '#9be11d' }} /><div style={{ width: 220, height: 132, display: 'flex', borderRadius: '110px 110px 30px 30px', background: '#74beff' }} /></div>
  }
  if (kind === 'team') {
    return <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 18 }}>{[1, 2, 3, 4].map((court) => <div key={court} style={{ height: 82, display: 'flex', alignItems: 'center', gap: 17, padding: 15, borderRadius: 17, background: 'rgba(255,255,255,.08)' }}><div style={{ width: 45, height: 45, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 13, background: '#9be11d', color: '#06172f', fontSize: 24, fontWeight: 950 }}>{court}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}><div style={{ width: 185, height: 10, borderRadius: 10, background: '#fff' }} /><div style={{ width: 135, height: 9, borderRadius: 9, background: '#74beff' }} /></div></div>)}</div>
  }
  if (kind === 'league') {
    return <div style={{ width: 350, height: 390, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 24, padding: 30, borderRadius: 30, background: 'rgba(4,20,40,.72)', border: '2px solid rgba(116,190,255,.28)' }}>{[190, 270, 325].map((height, index) => <div key={height} style={{ width: 72, height, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 18, borderRadius: '18px 18px 8px 8px', background: index === 2 ? '#9be11d' : '#173b61', color: index === 2 ? '#06172f' : '#fff', fontSize: 28, fontWeight: 950 }}>{index + 1}</div>)}</div>
  }
  if (kind === 'tournament') {
    return <div style={{ width: 350, height: 390, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>{[0, 1, 2].map((column) => <div key={column} style={{ position: 'absolute', left: column * 112, top: 35 + column * 54, display: 'flex', flexDirection: 'column', gap: 70 }}>{[0, 1].map((row) => <div key={row} style={{ width: 100, height: 54, display: 'flex', borderRadius: 14, background: column === 2 ? '#9be11d' : '#173b61', border: '2px solid rgba(255,255,255,.18)' }} />)}</div>)}</div>
  }
  if (kind === 'club') {
    return <div style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 20 }}>{['PROGRAMS', 'TEAMS', 'EVENTS'].map((label, index) => <div key={label} style={{ height: 102, display: 'flex', alignItems: 'center', gap: 20, padding: 22, borderRadius: 22, background: 'rgba(255,255,255,.08)' }}><div style={{ width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: index === 0 ? '#9be11d' : '#173b61', color: index === 0 ? '#06172f' : '#fff', fontSize: 27, fontWeight: 950 }}>{index + 1}</div><div style={{ display: 'flex', fontSize: 24, fontWeight: 900 }}>{label}</div></div>)}</div>
  }
  return <div style={{ width: 340, height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: '34px solid #173b61', background: '#06172f' }}><div style={{ width: 188, height: 188, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: '30px solid #74beff', background: '#9be11d', color: '#06172f', fontSize: 74, fontWeight: 950 }}>✓</div></div>
}
