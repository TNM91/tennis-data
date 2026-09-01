import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import QRCode from 'qrcode'

const campaignUrl = 'https://www.tenaceiq.com/captain-pilot?utm_source=club-flyer&utm_medium=print&utm_campaign=fall-2026-captain-pilot'
const outputDir = resolve(process.cwd(), 'public/brand/flyers')
const svgPath = resolve(outputDir, 'fall-2026-captain-pilot-qr.svg')
const pngPath = resolve(outputDir, 'fall-2026-captain-pilot-qr.png')

await mkdir(dirname(svgPath), { recursive: true })
await QRCode.toFile(svgPath, campaignUrl, {
  type: 'svg',
  errorCorrectionLevel: 'H',
  margin: 3,
  color: { dark: '#06172F', light: '#FFFFFFFF' },
})
await QRCode.toFile(pngPath, campaignUrl, {
  type: 'png',
  width: 1200,
  errorCorrectionLevel: 'H',
  margin: 3,
  color: { dark: '#06172F', light: '#FFFFFFFF' },
})

console.log(`Captain Pilot QR created for ${campaignUrl}`)
