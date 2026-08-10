import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const navy = '#071730'
const iconSource = join(root, 'public/brand/logos/tenaceiq-iq-navy.jpg')
const watermarkSource = join(root, 'public/brand/web/header-logo-transparent.png')

const outputs = [
  ['public/brand/icons/app-icon-1024.png', 1024],
  ['public/brand/icons/apple-touch-icon.png', 180],
  ['public/brand/icons/favicon-256.png', 256],
  ['public/brand/icons/favicon-512.png', 512],
  ['public/brand/icons/pwa-192.png', 192],
  ['public/brand/icons/pwa-512.png', 512],
]

async function renderIcon(size, rgba = false) {
  let pipeline = sharp(iconSource)
    .resize(size, size, {
      fit: 'contain',
      background: navy,
      kernel: sharp.kernel.lanczos3,
    })
    .flatten({ background: navy })

  if (rgba) pipeline = pipeline.ensureAlpha(1)

  return pipeline
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

function buildIco(frames) {
  const headerSize = 6
  const entrySize = 16
  let imageOffset = headerSize + entrySize * frames.length
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)

  const entries = frames.map(({ size, image }) => {
    const entry = Buffer.alloc(entrySize)
    entry.writeUInt8(size === 256 ? 0 : size, 0)
    entry.writeUInt8(size === 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(image.length, 8)
    entry.writeUInt32LE(imageOffset, 12)
    imageOffset += image.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...frames.map(({ image }) => image)])
}

for (const [relativePath, size] of outputs) {
  const outputPath = join(root, relativePath)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, await renderIcon(size))
}

const faviconFrames = await Promise.all(
  [16, 32, 48, 64, 128, 256].map(async (size) => ({ size, image: await renderIcon(size, true) })),
)
const favicon = buildIco(faviconFrames)
await writeFile(join(root, 'public/brand/icons/favicon.ico'), favicon)
await writeFile(join(root, 'app/favicon.ico'), favicon)

await sharp(watermarkSource)
  .extract({ left: 0, top: 0, width: 6118, height: 1550 })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(join(root, 'public/brand/web/home-watermark.png'))

console.log('Generated navy brand icons and the high-resolution home watermark.')
