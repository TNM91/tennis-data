import { ImageResponse } from 'next/og'
import { getPlayerSharePreview } from '@/lib/route-metadata'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const preview = await getPlayerSharePreview(String(id))

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
            'linear-gradient(135deg, #071a35 0%, #0b2346 52%, #0f4b52 100%)',
          color: '#f8fbff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            maxWidth: '900px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: 'fit-content',
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
            Player Profile
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: '76px',
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
              fontSize: '30px',
              color: 'rgba(224,236,249,0.82)',
            }}
          >
            {preview.secondary}
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
              Ratings, form, and matchup context
            </div>
            <div style={{ fontSize: '24px', color: 'rgba(224,236,249,0.72)' }}>
              TenAceIQ
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              width: '160px',
              height: '160px',
              borderRadius: '999px',
              background: 'radial-gradient(circle, rgba(155,225,29,0.34), rgba(155,225,29,0))',
            }}
          />
        </div>
      </div>
    ),
    size,
  )
}
