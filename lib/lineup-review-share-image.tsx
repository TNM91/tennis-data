import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = 'Proposed Lineup — Co-captain Review'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const logo = await readFile(join(process.cwd(), 'public/brand/web/header-logo-transparent.png'))
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', padding: 56, gap: 36, background: 'linear-gradient(135deg,#06172f,#0b2346)', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ width: 710, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Preserve the supplied brand artwork at its original aspect ratio. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${logo.toString('base64')}`} width={320} height={90} alt="TenAceIQ" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', color: '#9be11d', fontSize: 28, fontWeight: 700 }}>CO-CAPTAIN REVIEW</div>
          <div style={{ display: 'flex', fontSize: 76, lineHeight: 1.05, fontWeight: 700 }}>Proposed Lineup</div>
          <div style={{ display: 'flex', color: '#d9e6f2', fontSize: 30 }}>Review courts. Suggest changes.</div>
        </div>
        <div style={{ display: 'flex', fontSize: 25, color: '#b9cadb' }}>Send your proposal back to the captain.</div>
      </div>
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
        <div style={{ display: 'flex', color: '#9be11d', fontSize: 24, fontWeight: 700 }}>LINEUP REVIEW</div>
        {[1, 2, 3, 4].map((court) => (
          <div key={court} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: 20, height: 86, borderRadius: 16, border: '1px solid rgba(155,225,29,.35)', background: '#102d50' }}>
            <div style={{ display: 'flex', color: '#9be11d', fontSize: 32, fontWeight: 700 }}>{court}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', width: 164, height: 9, borderRadius: 6, background: '#d9e6f2' }} />
              <div style={{ display: 'flex', width: 120, height: 9, borderRadius: 6, background: '#74beff' }} />
            </div>
          </div>
        ))}
      </div>
    </div>,
    size,
  )
}
