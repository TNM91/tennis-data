import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const projectRoot = process.cwd()
const brandRoot = join(projectRoot, 'public', 'brand')
const iconsRoot = join(brandRoot, 'icons')
const socialRoot = join(brandRoot, 'social')
const navyMarkPath = join(brandRoot, 'logos', 'tenaceiq-iq-navy.jpg')
const darkMarkPath = join(brandRoot, 'logos', 'tenaceiq-iq-for-light-bg.png')
const wordmarkPath = join(brandRoot, 'web', 'home-watermark.png')
const socialBackgroundPath = join(socialRoot, 'og-background-v2.png')

const NAVY = '#06172F'
const PALE = '#F5F8FC'

async function ensureParent(path) {
  await mkdir(dirname(path), { recursive: true })
}

async function containedMark(source, size, fill, scale = 0.72, cropGuidePixels = true) {
  const insetSize = Math.round(size * scale)
  const preparedSource = cropGuidePixels
    ? await sharp(source)
      // The supplied transparent logo exports retain thin guide pixels on the
      // far left and right. Crop those export artifacts before fitting.
      .extract({ left: 42, top: 0, width: 1468, height: 1614 })
      .png()
      .toBuffer()
    : source
  const mark = await sharp(preparedSource)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({
      width: insetSize,
      height: insetSize,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: fill,
    },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .flatten({ background: fill })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function writeIcon(path, source, size, fill, scale, cropGuidePixels = true) {
  await ensureParent(path)
  const image = await containedMark(source, size, fill, scale, cropGuidePixels)
  await sharp(image).toFile(path)
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

async function buildOpenGraphImage() {
  const outputPath = join(socialRoot, 'og-image-1200x630.png')
  const background = await sharp(socialBackgroundPath)
    .resize(1200, 630, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer()
  const croppedWordmark = await sharp(wordmarkPath)
    // The wordmark export has the same guide-pixel issue along its top/bottom.
    .extract({ left: 0, top: 72, width: 6118, height: 1406 })
    .png()
    .toBuffer()
  const wordmark = await sharp(croppedWordmark)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({
      width: 430,
      height: 104,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const copy = {
    eyebrow: 'TENNIS INTELLIGENCE',
    lineOne: 'More Tennis.',
    lineTwo: 'Less Chaos.',
    audience: 'Players  •  Captains  •  Coaches  •  Clubs',
  }
  const overlay = Buffer.from(`
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#041226" stop-opacity="0.98"/>
          <stop offset="0.5" stop-color="#041226" stop-opacity="0.76"/>
          <stop offset="0.78" stop-color="#041226" stop-opacity="0.15"/>
          <stop offset="1" stop-color="#041226" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#9BE11D"/>
          <stop offset="1" stop-color="#74BEFF"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#shade)"/>
      <rect x="66" y="219" width="88" height="5" rx="2.5" fill="url(#accent)"/>
      <text x="66" y="204" fill="#9BE11D" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800" letter-spacing="4">${escapeXml(copy.eyebrow)}</text>
      <text x="66" y="314" fill="#F8FBFF" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="850" letter-spacing="-2">${escapeXml(copy.lineOne)}</text>
      <text x="66" y="386" fill="#F8FBFF" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="850" letter-spacing="-2">${escapeXml(copy.lineTwo)}</text>
      <text x="68" y="448" fill="#C6D3E4" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="650">${escapeXml(copy.audience)}</text>
      <rect x="66" y="490" width="204" height="52" rx="26" fill="#9BE11D"/>
      <text x="168" y="524" text-anchor="middle" fill="#06172F" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="850">Explore TenAceIQ</text>
      <rect x="18" y="18" width="1164" height="594" rx="34" fill="none" stroke="#74BEFF" stroke-opacity="0.16" stroke-width="2"/>
    </svg>
  `)

  await ensureParent(outputPath)
  await sharp(background)
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: wordmark, top: 56, left: 66 },
    ])
    .removeAlpha()
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPath)
}

async function main() {
  await Promise.all([
    writeIcon(join(iconsRoot, 'app-icon-1024.png'), navyMarkPath, 1024, NAVY, 0.7, false),
    writeIcon(join(iconsRoot, 'pwa-192.png'), navyMarkPath, 192, NAVY, 0.7, false),
    writeIcon(join(iconsRoot, 'pwa-512.png'), navyMarkPath, 512, NAVY, 0.7, false),
    writeIcon(join(iconsRoot, 'pwa-maskable-512.png'), navyMarkPath, 512, NAVY, 0.64, false),
    writeIcon(join(iconsRoot, 'apple-touch-icon.png'), darkMarkPath, 180, PALE, 0.72),
    writeIcon(join(iconsRoot, 'favicon-256.png'), darkMarkPath, 256, PALE, 0.76),
    writeIcon(join(iconsRoot, 'favicon-512.png'), darkMarkPath, 512, PALE, 0.76),
    buildOpenGraphImage(),
  ])
}

await main()
