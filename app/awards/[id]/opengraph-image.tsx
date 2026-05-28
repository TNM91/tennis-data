import { ImageResponse } from 'next/og'
import { getAwardSharePreview } from '@/lib/route-metadata'

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
  const preview = await getAwardSharePreview(String(id))

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px',
          background: 'linear-gradient(135deg, #071a35 0%, #0b2346 52%, #0f4b52 100%)',
          color: '#f8fbff',
          fontFamily: 'sans-serif',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '-80px',
            bottom: '-110px',
            fontSize: 270,
            lineHeight: 1,
            fontWeight: 900,
            color: 'rgba(155,225,29,0.08)',
          }}
        >
          TIQ
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              borderRadius: 999,
              padding: '10px 18px',
              background: 'rgba(74,163,255,0.16)',
              border: '1px solid rgba(116,190,255,0.24)',
              fontSize: 22,
              fontWeight: 900,
              textTransform: 'uppercase',
            }}
          >
            TenAceIQ Award
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 112,
              height: 112,
              borderRadius: 999,
              border: '1px solid rgba(155,225,29,0.44)',
              background: 'rgba(155,225,29,0.14)',
              color: '#d9f84a',
              fontSize: 30,
              fontWeight: 950,
            }}
          >
            {preview.badgeCode}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 880 }}>
          <div style={{ display: 'flex', color: '#d9f84a', fontSize: 30, fontWeight: 900 }}>
            {preview.badgeLabel}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 82,
              fontWeight: 950,
              lineHeight: 0.95,
            }}
          >
            {preview.recipientName || 'Award Certificate'}
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: 'rgba(224,236,249,0.84)', fontWeight: 800 }}>
            {preview.title} · {preview.sourceName}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', fontSize: 26, color: 'rgba(224,236,249,0.76)' }}>
            {preview.subtitle}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: '#d9f84a', fontWeight: 900 }}>
            More Tennis. Less Chaos.
          </div>
        </div>
      </div>
    ),
    size,
  )
}
