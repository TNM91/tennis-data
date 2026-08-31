import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const brand = join(root, 'public', 'brand')
const masters = join(brand, 'masters')
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
const navy = '#06172F'
const green = '#9BE11D'

const fullDark = join(masters, 'tenaceiq-full-dark-ui.svg')
const fullLight = join(masters, 'tenaceiq-full-light-ui.svg')
const iqDark = join(masters, 'tenaceiq-iq-dark-ui.svg')
const iqLight = join(masters, 'tenaceiq-iq-light-ui.svg')

async function ensure(path) {
  await mkdir(dirname(path), { recursive: true })
}

async function trimmed(source) {
  return sharp(source, { density: 144 })
    .ensureAlpha()
    .trim({ background: transparent })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

async function render(source, width, height) {
  return sharp(await trimmed(source))
    .resize({ width, height, fit: 'contain', background: transparent, kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

async function writePng(path, source, width, height) {
  await ensure(path)
  await writeFile(path, await render(source, width, height))
}

async function writeJpeg(path, source, width, height) {
  await ensure(path)
  await sharp(await render(source, width, height))
    .flatten({ background: '#FFFFFF' })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toFile(path)
}

async function containedMark(source, size, scale = 0.9) {
  const mark = await render(source, Math.round(size * scale), Math.round(size * scale))
  return sharp({ create: { width: size, height: size, channels: 4, background: transparent } })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

function ico(frames) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  let offset = 6 + frames.length * 16
  const entries = frames.map(({ size, image }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size === 256 ? 0 : size, 0)
    entry.writeUInt8(size === 256 ? 0 : size, 1)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(image.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += image.length
    return entry
  })
  return Buffer.concat([header, ...entries, ...frames.map(({ image }) => image)])
}

async function buildLogos() {
  const logos = join(brand, 'logos')
  await Promise.all([
    writePng(join(logos, 'tenaceiq-full-transparent.png'), fullDark, 4096),
    writePng(join(logos, 'tenaceiq-full-white.png'), fullDark, 4096),
    writePng(join(logos, 'tenaceiq-full-for-light-bg.png'), fullLight, 4096),
    writePng(join(logos, 'tenaceiq-full-black.png'), fullLight, 4096),
    writeJpeg(join(logos, 'tenaceiq-full-navy.jpg'), fullLight, 4096),
    writePng(join(logos, 'tenaceiq-iq-transparent.png'), iqDark, 2048, 2048),
    writePng(join(logos, 'tenaceiq-iq-white.png'), iqDark, 2048, 2048),
    writePng(join(logos, 'tenaceiq-iq-for-light-bg.png'), iqLight, 2048, 2048),
    writePng(join(logos, 'tenaceiq-iq-black.png'), iqLight, 2048, 2048),
    writeJpeg(join(logos, 'tenaceiq-iq-navy.jpg'), iqLight, 2048, 2048),
  ])
}

async function buildWebAndApparel() {
  const web = join(brand, 'web')
  const apparel = join(brand, 'apparel')
  await Promise.all([
    writePng(join(web, 'header-logo-transparent.png'), fullDark, 1600),
    writePng(join(web, 'header-logo-light-bg.png'), fullLight, 1600),
    writePng(join(web, 'footer-logo-dark-bg.png'), fullDark, 1600),
    writePng(join(web, 'footer-logo-light-bg.png'), fullLight, 1600),
    writePng(join(web, 'header-iq-compact.png'), iqDark, 1024, 1024),
    writePng(join(web, 'header-iq-light-bg.png'), iqLight, 1024, 1024),
    writePng(join(apparel, 'tenaceiq-full-white-clean.png'), fullDark, 4096),
    writePng(join(apparel, 'tenaceiq-full-light-clean.png'), fullLight, 4096),
    writePng(join(apparel, 'tenaceiq-full-navy-clean.png'), fullLight, 4096),
    writePng(join(apparel, 'tenaceiq-full-black-clean.png'), fullLight, 4096),
    writePng(join(apparel, 'tenaceiq-iq-clean.png'), iqDark, 2048, 2048),
    writePng(join(apparel, 'tenaceiq-iq-white-clean.png'), iqDark, 2048, 2048),
    writePng(join(apparel, 'tenaceiq-iq-light-clean.png'), iqLight, 2048, 2048),
    writePng(join(apparel, 'tenaceiq-iq-navy-clean.png'), iqLight, 2048, 2048),
  ])
}

async function buildIcons() {
  const icons = join(brand, 'icons')
  const specs = [
    ['app-icon-1024.png', 1024, 0.9], ['apple-touch-icon.png', 180, 0.9],
    ['favicon-16.png', 16, 0.92], ['favicon-32.png', 32, 0.92],
    ['favicon-256.png', 256, 0.9], ['favicon-512.png', 512, 0.9],
    ['pwa-192.png', 192, 0.86], ['pwa-512.png', 512, 0.86], ['pwa-maskable-512.png', 512, 0.72],
  ]
  const iconsByName = await Promise.all(specs.map(async ([name, size, scale]) => [name, await containedMark(iqLight, size, scale)]))
  await Promise.all(iconsByName.map(async ([name, image]) => {
    const path = join(icons, name)
    await ensure(path)
    await writeFile(path, image)
  }))
  const frames = await Promise.all([16, 32, 48, 64, 128, 256].map(async (size) => ({ size, image: await containedMark(iqLight, size, 0.9) })))
  const favicon = ico(frames)
  await writeFile(join(icons, 'favicon.ico'), favicon)
  await writeFile(join(root, 'app', 'favicon.ico'), favicon)

  // Write browser aliases serially. Windows can transiently lock a public
  // asset when browser tooling discovers it during a build.
  const aliases = [
    ['apple-touch-icon.png', 'app/apple-icon.png'],
    ['apple-touch-icon.png', 'public/apple-touch-icon.png'],
    ['apple-touch-icon.png', 'public/apple-touch-icon-precomposed.png'],
    ['apple-touch-icon.png', 'public/apple-touch-icon-180x180.png'],
    ['favicon-16.png', 'public/favicon-16x16.png'],
    ['favicon-32.png', 'public/favicon-32x32.png'],
    ['pwa-192.png', 'public/android-chrome-192x192.png'],
    ['pwa-512.png', 'public/android-chrome-512x512.png'],
  ]
  for (const [source, destination] of aliases) {
    await writeFile(join(root, destination), await readFile(join(icons, source)))
  }
}

async function buildSocialAndWallpapers() {
  const social = join(brand, 'social')
  const darkLogo = await render(fullDark, 510, 180)
  const socialBase = await sharp(join(social, 'og-background-ace-v6.png'))
    .resize({ width: 1200, height: 630, fit: 'cover' })
    .composite([{ input: Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#06172F" fill-opacity=".72"/></svg>`) }])
    .png()
    .toBuffer()
  await sharp(socialBase).composite([{ input: darkLogo, left: 54, top: 58 }]).png({ compressionLevel: 9 }).toFile(join(social, 'og-image-1200x630.png'))
  await sharp({ create: { width: 1080, height: 1080, channels: 4, background: navy } })
    .composite([{ input: await containedMark(iqDark, 780, 0.9), gravity: 'center' }])
    .png({ compressionLevel: 9 }).toFile(join(social, 'social-profile-1080.png'))
  const watermark = await render(fullDark, 1900, 620)
  await sharp({ create: { width: 2400, height: 1040, channels: 4, background: transparent } })
    .composite([{ input: watermark, gravity: 'center', opacity: 0.12 }])
    .png({ compressionLevel: 9 }).toFile(join(brand, 'web', 'home-watermark.png'))
  const wallpaper = await render(fullDark, 2500, 820)
  await sharp({ create: { width: 3840, height: 2160, channels: 4, background: navy } })
    .composite([{ input: wallpaper, gravity: 'center', opacity: 0.8 }])
    .png({ compressionLevel: 9 }).toFile(join(brand, 'wallpapers', 'tenaceiq-desktop-4k-logo.png'))
  await sharp({ create: { width: 1290, height: 2796, channels: 4, background: navy } })
    .composite([{ input: await render(fullDark, 1050, 360), left: 120, top: 1218, opacity: 0.9 }])
    .png({ compressionLevel: 9 }).toFile(join(brand, 'wallpapers', 'tenaceiq-phone-1290x2796-logo.png'))
}

async function buildCourtSurface() {
  const court = join(root, 'public', 'tiq', 'courts', 'tiq-court-master.png')
  const lockup = await render(fullDark, 260, 80)
  // Sample the uninterrupted right side of the net so the new lockup sits in
  // the court texture rather than on a flat cover panel.
  const netPanel = await sharp(court)
    .extract({ left: 876, top: 373, width: 310, height: 82 })
    .png()
    .toBuffer()

  const courtBase = await sharp(court).png().toBuffer()
  await sharp(courtBase)
    .composite([
      { input: netPanel, left: 569, top: 373 },
      { input: lockup, left: 594, top: 377 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(court)
}

if (process.argv.includes('--court-only')) {
  await buildCourtSurface()
  console.log(`Updated the TenAceIQ court lockup with official green ${green}.`)
} else {
  await buildLogos()
  await buildWebAndApparel()
  await buildIcons()
  await buildSocialAndWallpapers()
  await buildCourtSurface()
  console.log(`Promoted final TenAceIQ brand masters with official green ${green}.`)
}
