import { ImageResponse } from 'next/og'
import { getLeagueSharePreview } from '@/lib/route-metadata'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ league: string }>
}) {
  const { league } = await params
  const preview = await getLeagueSharePreview(decodeURIComponent(String(league)))

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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            maxWidth: '940px',
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
            League Season
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: '70px',
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
            <div style={{ fontSize: '26px', color: '#9bd2ff', fontWeight: 800 }}>
              Team summaries, standings context, and match history
            </div>
            <div style={{ fontSize: '24px', color: 'rgba(224,236,249,0.72)' }}>
              TenAceIQ
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              width: '190px',
              height: '190px',
              borderRadius: '36px',
              background: 'linear-gradient(135deg, rgba(74,163,255,0.22), rgba(155,225,29,0.16))',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          />
        </div>
      </div>
    ),
    size,
  )
}
