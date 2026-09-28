import { ImageResponse } from 'next/og'
import { getCaptainShareLabel } from '@/lib/captain-share-links'
import type { CaptainShareKind } from '@/lib/captain-share-links'
import { getCaptainShareLink } from '@/lib/captain-share-links-server'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const share = await getCaptainShareLink(token)
  const label = share ? getCaptainShareLabel(share) : 'Captain update'
  const detail = share?.detail.replace(/^(projected|confirmed) lineup\s*[·•:-]?\s*/i, '') || ''

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', padding: 56, background: 'linear-gradient(135deg,#06172f 0%,#0b2346 58%,#0d4852 100%)', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ width: '65%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', color: '#9be11d', fontSize: 25, fontWeight: 900, letterSpacing: 3 }}>TENACEIQ · CAPTAIN</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', marginBottom: 16, color: '#9be11d', fontSize: 34, fontWeight: 900 }}>{label}</div>
          <div style={{ display: 'flex', fontSize: 68, lineHeight: .98, fontWeight: 950 }}>{share?.teamName || 'Team update'}</div>
          {share?.opponent ? <div style={{ display: 'flex', marginTop: 14, color: '#d9e6f2', fontSize: 38, fontWeight: 800 }}>vs {share.opponent}</div> : null}
        </div>
        <div style={{ display: 'flex', color: '#b9cadb', fontSize: 25, fontWeight: 700 }}>{[share?.matchDate, detail].filter(Boolean).join(' · ') || 'Open the match-week update'}</div>
      </div>
      <div style={{ width: '35%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ShareIllustration kind={share?.kind || 'lineup'} />
      </div>
    </div>,
    size,
  )
}

function ShareIllustration({ kind }: { kind: CaptainShareKind }) {
  if (kind === 'lineup') {
    return <div style={{ width: 330, height: 450, display: 'flex', flexDirection: 'column', gap: 18, padding: 26, borderRadius: 28, background: 'rgba(4,20,40,.72)', border: '2px solid rgba(155,225,29,.45)' }}>{[1, 2, 3, 4].map((court) => <div key={court} style={{ height: 78, display: 'flex', alignItems: 'center', gap: 16, padding: 14, borderRadius: 16, background: 'rgba(255,255,255,.08)' }}><div style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: '#9be11d', color: '#06172f', fontSize: 24, fontWeight: 950 }}>{court}</div><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ width: 170, height: 9, borderRadius: 9, background: '#fff' }} /><div style={{ width: 130, height: 8, borderRadius: 8, background: '#74beff' }} /></div></div>)}</div>
  }
  if (kind === 'final-result') {
    return <div style={{ width: 340, height: 270, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 30, background: '#081d38', border: '2px solid rgba(155,225,29,.45)' }}><div style={{ display: 'flex', color: '#9be11d', fontSize: 26, fontWeight: 900 }}>FINAL</div><div style={{ display: 'flex', marginTop: 18, fontSize: 92, fontWeight: 950 }}>3–2</div></div>
  }
  if (kind === 'availability') {
    return <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 20 }}>{['IN', 'MAYBE', 'OUT'].map((answer, index) => <div key={answer} style={{ height: 96, display: 'flex', alignItems: 'center', gap: 20, padding: 20, borderRadius: 20, background: 'rgba(255,255,255,.08)' }}><div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: index === 0 ? '#9be11d' : '#173b61', color: index === 0 ? '#06172f' : '#fff', fontSize: 28, fontWeight: 950 }}>{index === 0 ? '✓' : '·'}</div><div style={{ display: 'flex', fontSize: 27, fontWeight: 900 }}>{answer}</div></div>)}</div>
  }
  if (kind === 'practice') {
    return <div style={{ width: 340, height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: '#9be11d', color: '#06172f', fontSize: 150, fontWeight: 950 }}>↗</div>
  }
  if (kind === 'team-room' || kind === 'team-invite') {
    return <div style={{ width: 350, display: 'flex', flexDirection: 'column', gap: 20 }}>{['CAPTAIN', 'PLAYER', 'TEAM'].map((label, index) => <div key={label} style={{ height: 100, display: 'flex', alignItems: 'center', gap: 20, padding: 20, borderRadius: 20, background: 'rgba(255,255,255,.08)' }}><div style={{ width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: index === 0 ? '#9be11d' : '#173b61', color: index === 0 ? '#06172f' : '#fff', fontSize: 25, fontWeight: 950 }}>{index + 1}</div><div style={{ display: 'flex', fontSize: 24, fontWeight: 900 }}>{label}</div></div>)}</div>
  }
  return <div style={{ width: 340, height: 420, display: 'flex', flexDirection: 'column', gap: 20, padding: 28, borderRadius: 28, background: '#081d38', border: '2px solid rgba(116,190,255,.4)' }}><div style={{ display: 'flex', color: '#9be11d', fontSize: 24, fontWeight: 900 }}>LIVE</div>{[1, 2, 3].map((row) => <div key={row} style={{ height: 88, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 16, background: 'rgba(255,255,255,.08)' }}><div style={{ display: 'flex', fontSize: 25, fontWeight: 900 }}>Court {row}</div><div style={{ display: 'flex', color: '#9be11d', fontSize: 34, fontWeight: 950 }}>6–4</div></div>)}</div>
}
