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
            'linear-gradient(135deg, #081b38 0%, #0d2b54 48%, #113a74 100%)',
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
              background: 'rgba(74,163,255,0.16)',
              border: '1px solid rgba(116,190,255,0.22)',
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Matchup Analysis
          </div>
          <div style={{ display: 'flex', fontSize: '74px', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em' }}>
            Compare the edge
          </div>
          <div style={{ display: 'flex', fontSize: '30px', color: 'rgba(224,236,249,0.82)' }}>
            Public projections, head-to-head context, and rating-based prep
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '26px', color: '#9bd2ff', fontWeight: 800 }}>
              Singles or doubles, side by side
            </div>
            <div style={{ fontSize: '24px', color: 'rgba(224,236,249,0.72)' }}>TenAceIQ</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={compareCardStyle}>Player A</div>
            <div style={vsStyle}>VS</div>
            <div style={compareCardStyle}>Player B</div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}

const compareCardStyle = {
  display: 'flex',
  width: '170px',
  height: '170px',
  borderRadius: '28px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.10)',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#f8fbff',
  fontSize: '30px',
  fontWeight: 800,
}

const vsStyle = {
  display: 'flex',
  width: '96px',
  height: '96px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #2f6ff5 0%, #61a6ff 100%)',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#ffffff',
  fontSize: '30px',
  fontWeight: 900,
}
