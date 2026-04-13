import { ImageResponse } from 'next/og'
import { getTeamSharePreview } from '@/lib/route-metadata'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ team: string }>
}) {
  const { team } = await params
  const preview = await getTeamSharePreview(decodeURIComponent(String(team)))

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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            maxWidth: '920px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: 'fit-content',
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
            Team Intelligence
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: '72px',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.05em',
            }}
          >
            {preview.primary}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '28px',
              color: 'rgba(224,236,249,0.82)',
            }}
          >
            <div>{preview.secondary}</div>
            {preview.tertiary ? <div>{preview.tertiary}</div> : null}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '26px', color: '#d9f84a', fontWeight: 800 }}>
              Roster depth, form, and captain tools
            </div>
            <div style={{ fontSize: '24px', color: 'rgba(224,236,249,0.72)' }}>
              TenAceIQ
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              width: '240px',
              height: '18px',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, #4ade80 0%, #9be11d 100%)',
              boxShadow: '0 10px 30px rgba(155,225,29,0.24)',
            }}
          />
        </div>
      </div>
    ),
    size,
  )
}
