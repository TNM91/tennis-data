import { ImageResponse } from 'next/og'
import { getCaptainFinalScore } from '@/lib/captain-share-preview'

const BrandImage = 'img'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const score = getCaptainFinalScore(query.get('score') || '')
  const team = (query.get('team') || 'Your team').slice(0, 90)
  const opponent = (query.get('opponent') || '').slice(0, 90)

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 58, background: 'linear-gradient(135deg, rgb(6, 23, 47) 0%, #09284b 58%, #0c3d4e 100%)', color: '#fff', fontFamily: 'sans-serif' }}>
      <BrandImage src="https://www.tenaceiq.com/brand/web/header-logo-transparent.png" alt="TenAceIQ" width="300" height="78" style={{ width: 300, height: 78, objectFit: 'contain' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 690 }}>
          <div style={{ display: 'flex', color: '#60A5FA', fontSize: 28, fontWeight: 900 }}>FINAL SCORECARD</div>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 900 }}>{team}</div>
          {opponent ? <div style={{ display: 'flex', color: '#cbd9ea', fontSize: 32 }}>vs {opponent}</div> : null}
        </div>
        <div style={{ display: 'flex', padding: 28, borderRadius: 28, border: '2px solid #60A5FA', fontSize: score ? 90 : 44, fontWeight: 900 }}>{score || 'FINAL'}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a9bdd3', fontSize: 23, fontWeight: 800 }}><span>Tap to open the final scorecard</span><span style={{ color: '#C8F56B' }}>More Tennis. Less Chaos.</span></div>
    </div>,
    { width: 1200, height: 630 },
  )
}
