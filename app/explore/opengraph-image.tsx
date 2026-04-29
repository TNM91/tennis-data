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
            'linear-gradient(135deg, #071a35 0%, #0b2346 52%, #113a74 100%)',
          color: '#f8fbff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '920px' }}>
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
            Explore
          </div>
          <div style={{ display: 'flex', fontSize: '76px', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em' }}>
            Public tennis discovery
          </div>
          <div style={{ display: 'flex', fontSize: '30px', color: 'rgba(224,236,249,0.82)' }}>
            Players, rankings, leagues, teams, and matchup prep in one place
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '26px', color: '#9bd2ff', fontWeight: 800 }}>
              Search less. Find context faster.
            </div>
            <div style={{ fontSize: '24px', color: 'rgba(224,236,249,0.72)' }}>TenAceIQ</div>
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <div style={pillStyle}>Players</div>
            <div style={pillStyle}>Rankings</div>
            <div style={pillStyle}>Leagues</div>
            <div style={pillStyle}>My Lab</div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}

const pillStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '52px',
  padding: '0 20px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#f8fbff',
  fontSize: '22px',
  fontWeight: 700,
}
