/** Run with npx tsx scripts/build-captain-pilot-share.tsx after changing pilot terms. */
import React from 'react'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import { CAPTAIN_PILOT_FLYER } from '../lib/captain-pilot-flyer'
import { CAPTAIN_PILOT_SHARE } from '../lib/captain-pilot-share'

async function main() {
  const logo = await readFile(path.join(process.cwd(), 'public/brand/web/header-logo-transparent.png'))
  const response = new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '48px 60px', background: '#06172F', color: '#FFFFFF', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* ImageResponse requires a native image element; the approved master is unchanged. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${logo.toString('base64')}`} width={310} height={82} alt="TenAceIQ" style={{ objectFit: 'contain' }} />
        <span style={{ color: '#9BE11D', fontSize: 22, letterSpacing: 3 }}>FALL CAPTAIN PILOT</span>
      </div>
      <div style={{ display: 'flex', marginTop: 34, fontSize: 33 }}>Calling all tennis captains.</div>
      <div style={{ display: 'flex', marginTop: 8, fontSize: 78, fontWeight: 700, letterSpacing: -3, color: '#9BE11D' }}>{CAPTAIN_PILOT_FLYER.offer}</div>
      <div style={{ display: 'flex', marginTop: 18, fontSize: 29, color: '#D8E7FB' }}>Know availability. Build lineups. Scout opponents.</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 40 }}>
        <div style={{ display: 'flex', padding: '17px 28px', background: '#9BE11D', color: '#06172F', fontSize: 28, fontWeight: 700, borderRadius: 40 }}>Start your free pilot →</div>
        <span style={{ fontSize: 25 }}>tenaceiq.com/captain-pilot</span>
      </div>
      <div style={{ display: 'flex', marginTop: 30, fontSize: 21, color: '#C8D8EB' }}>{CAPTAIN_PILOT_FLYER.renewal}</div>
      <div style={{ display: 'flex', marginTop: 8, fontSize: 19, color: '#C8D8EB' }}>Eligible local captains · Enroll by December 31, 2026 · No automatic charges</div>
    </div>,
    { width: 1200, height: 630 },
  )
  await writeFile(path.join(process.cwd(), 'public', CAPTAIN_PILOT_SHARE.image), Buffer.from(await response.arrayBuffer()))
  console.log(`Created ${CAPTAIN_PILOT_SHARE.image}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
