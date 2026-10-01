import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { formatLeagueWeeklyShareDate, getLeagueWeeklySharePreview } from '@/lib/league-weekly-share'

const ShareImage = 'img'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Weekly league RSVP from TenAceIQ'

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const preview = await getLeagueWeeklySharePreview(token)
  const leagueName = preview?.leagueName || 'TIQ League'
  const brand = `data:image/png;base64,${(await readFile(join(process.cwd(), 'public/brand/web/header-logo-transparent.png'))).toString('base64')}`
  let logoUrl = `data:image/png;base64,${(await readFile(join(process.cwd(), 'public/brand/web/header-iq-compact.png'))).toString('base64')}`
  try {
    const url = new URL(preview?.logoUrl || '')
    // League uploads live in the approved public storage bucket. Keep image
    // rendering isolated from arbitrary remote URLs and broken uploads.
    if (url.protocol === 'https:' && url.hostname === 'pwxppfazbyourjrsutgx.supabase.co' && url.pathname.startsWith('/storage/v1/object/public/')) {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' })
      const mime = response.headers.get('content-type')?.split(';')[0] || ''
      if (response.ok && ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)) {
        const bytes = Buffer.from(await response.arrayBuffer())
        if (bytes.length <= 5 * 1024 * 1024) {
          const png = await sharp(bytes, { limitInputPixels: 20_000_000 }).resize(256, 256, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()
          logoUrl = `data:image/png;base64,${png.toString('base64')}`
        }
      }
    }
  } catch { /* Keep the approved fallback when no uploaded logo is available. */ }

  return new ImageResponse(
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', padding: '50px 56px', background: 'linear-gradient(138deg, #041328 0%, #08284a 56%, #0b453f 100%)', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', opacity: 0.16, background: 'radial-gradient(circle at 78% 16%, #9BE11D 0%, transparent 29%)' }} />
      <div style={{ position: 'absolute', right: -120, bottom: -240, display: 'flex', width: 700, height: 700, border: '2px solid rgba(155,225,29,0.28)', borderRadius: 999 }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ display: 'flex', width: 112, height: 112, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.22)', borderRadius: 26, background: '#fff' }}>
            <ShareImage src={logoUrl} alt="" width="104" height="104" style={{ width: 104, height: 104, objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', color: '#9BE11D', fontSize: 21, fontWeight: 950, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Weekly league</div>
            <div style={{ display: 'flex', maxWidth: 650, fontSize: 38, fontWeight: 950, lineHeight: 1.05 }}>{leagueName}</div>
          </div>
        </div>
        <ShareImage src={brand} alt="TenAceIQ" width="260" height="68" style={{ width: 260, height: 68, objectFit: 'contain' }} />
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 50 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
          <div style={{ display: 'flex', color: '#C8F56B', fontSize: 26, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tap to reply</div>
          <div style={{ display: 'flex', fontSize: 86, lineHeight: 0.9, fontWeight: 950, letterSpacing: '-0.055em' }}>Are you in?</div>
          <div style={{ display: 'flex', color: '#d8e8f8', fontSize: 29, lineHeight: 1.25 }}>{formatLeagueWeeklyShareDate(preview?.playOn || '')}{preview?.facility ? ` · ${preview.facility}` : ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', width: 230, height: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 22, background: '#9BE11D', color: '#06172F', fontSize: 32, fontWeight: 950 }}>I&apos;M IN</div>
          <div style={{ display: 'flex', width: 230, height: 70, alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.5)', borderRadius: 22, color: '#fff', fontSize: 25, fontWeight: 900 }}>I&apos;M OUT</div>
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', color: '#a9c8e8', fontSize: 21, fontWeight: 800 }}><span>Reply once. Your court follows.</span><span style={{ color: '#C8F56B' }}>More Tennis. Less Chaos.</span></div>
    </div>,
    size,
  )
}
