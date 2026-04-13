import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px',
          background:
            'linear-gradient(135deg, #081927 0%, #0b2646 48%, #124c3b 100%)',
          color: '#f8fbff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '940px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: 'auto',
              borderRadius: '999px',
              padding: '10px 18px',
              background: 'rgba(155,225,29,0.14)',
              border: '1px solid rgba(155,225,29,0.24)',
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Rankings
          </div>
          <div style={{ display: 'flex', fontSize: '76px', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em' }}>
            Track the board
          </div>
          <div style={{ display: 'flex', fontSize: '30px', color: 'rgba(224,236,249,0.82)' }}>
            Leaderboard movement, player tiers, and dynamic rating strength
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '26px', color: '#d9f84a', fontWeight: 800 }}>
              Singles, doubles, and overall context
            </div>
            <div style={{ fontSize: '24px', color: 'rgba(224,236,249,0.72)' }}>TenAceIQ</div>
          </div>
          <div
            style={{
              display: 'flex',
              width: '250px',
              height: '180px',
              borderRadius: '28px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
              border: '1px solid rgba(255,255,255,0.10)',
              padding: '20px',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ width: '34px', height: '52px', borderRadius: '12px', background: '#4ade80' }} />
            <div style={{ width: '34px', height: '86px', borderRadius: '12px', background: '#9be11d' }} />
            <div style={{ width: '34px', height: '118px', borderRadius: '12px', background: '#60a5fa' }} />
            <div style={{ width: '34px', height: '146px', borderRadius: '12px', background: '#3fa7ff' }} />
          </div>
        </div>
      </div>
    ),
    size,
  )
}
