import { copyFile, mkdir, readFile, access, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

// Place the approved PNGs proportionally. Never generate or redraw a logo.
const work = '.codex-audit/brand-media-refresh'
const originals = join(work, 'originals')
await mkdir(originals, { recursive: true })
const full = await readFile('public/brand/approved/TenAceIQ_Light_Transparent.png')
const tiq = await readFile('public/brand/approved/TiQ_White_Transparent_Refined.png')
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
const rect = (width, height, x, y, w, h) => Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#06172f"/></svg>`)
const fit = (input, width) => sharp(input).resize({ width }).png().toBuffer()
// Reuse the tour's existing code-native background, so replacements leave no opaque logo box.
const tourGenerator = await readFile('scripts/generate-tenaceiq-premium-v2-assets.mjs', 'utf8')
const backgroundFunctions = tourGenerator.slice(tourGenerator.indexOf('function defs()'), tourGenerator.indexOf('function titleLines('))
const backgroundMarkup = new Function(`${backgroundFunctions}; return base()`)()
const tourBackground = await sharp(Buffer.from(`<svg width="2560" height="1440" xmlns="http://www.w3.org/2000/svg">${backgroundMarkup}</svg>`)).resize(1920, 1080).png().toBuffer()
async function backup(file) {
  const saved = join(originals, file)
  await mkdir(dirname(saved), { recursive: true })
  try { await access(saved) } catch { await copyFile(file, saved) }
  return saved
}
async function plate(kind) {
  const center = kind === 'center'
  const region = center ? { left: 480, top: 50, width: 960, height: 300 } : { left: 60, top: 16, width: 410, height: 132 }
  const cover = await sharp(tourBackground).extract(region).png().toBuffer()
  return sharp({ create: { width: 1920, height: 1080, channels: 4, background: transparent } })
    .composite([{ input: cover, left: region.left, top: region.top }, { input: await fit(full, center ? 850 : 350), left: center ? 535 : 80, top: center ? 105 : 48 }]).png().toBuffer()
}
const top = await plate('top')
const center = await plate('center')
await writeFile(join(work, 'top.png'), top)
await writeFile(join(work, 'center.png'), center)

// Keep every court line and interaction coordinate unchanged. Only replace the net sponsor area.
await mkdir('public/brand/courts', { recursive: true })
const courtSource = 'public/brand/courts/tiq-court-base.png'
try { await access(courtSource) } catch { await copyFile('public/tiq/courts/tiq-court-master.png', courtSource) }
await sharp(courtSource).composite([
  { input: rect(1448, 1086, 565, 374, 325, 84) },
  { input: await sharp(courtSource).extract({ left: 400, top: 374, width: 1, height: 84 }).resize(325, 84, { fit: 'fill' }).png().toBuffer(), left: 565, top: 374 },
  { input: await fit(tiq, 160), left: 644, top: 374 },
]).png().toFile('public/brand/courts/tiq-court-approved-20261024-v2.png')

// Social card uses the existing approved unbranded court background.
await sharp('public/brand/social/og-background-v2.png').resize(1200, 630).composite([
  { input: await fit(full, 580), left: 48, top: 86 },
  { input: await fit(tiq, 180), left: 960, top: 52 },
]).png().toFile('public/brand/social/og-approved-20261024.png')

const ids = ['teaser', 'platform-tour', 'free', 'player', 'coach', 'captain', 'league', 'full-court', 'club']
for (const id of ids) {
  const file = `public/media/product-tours/${id}-poster.jpg`
  const source = await backup(file)
  await sharp(source).composite([{ input: id === 'platform-tour' ? center : top }]).jpeg({ quality: 95 }).toFile(file)
}

const ffmpeg = process.env.BRAND_FFMPEG
if (!ffmpeg) {
  console.log('Court, social card, and posters refreshed. Set BRAND_FFMPEG to refresh video lockups.')
  process.exit(0)
}
for (const id of process.argv.includes('--transitions-only') ? [] : ids) {
  const file = `public/media/product-tours/${id}.mp4`
  const source = await backup(file)
  const intro = id === 'teaser' ? 2.55 : 6.05
  const outro = id === 'teaser' ? 11.1 : 77.75
  const hasCenteredScenes = id === 'teaser' || id === 'platform-tour'
  const topEnable = hasCenteredScenes ? `:enable='between(t,${intro - 0.15},${outro + 0.15})'` : ''
  const filter = hasCenteredScenes
    ? `[0:v][1:v]overlay=0:0${topEnable}[top];[top][2:v]overlay=0:0:enable='lt(t,${intro})+gte(t,${outro})'[v]`
    : '[0:v][1:v]overlay=0:0[v]'
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-i', join(work, 'top.png')]
  if (hasCenteredScenes) args.push('-i', join(work, 'center.png'))
  args.push('-filter_complex', filter, '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', file)
  const result = spawnSync(ffmpeg, args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`Video refresh failed: ${id}`)
  console.log(`Updated ${id}: narration and timing preserved`)
}

// Replace the brief intro/outro crossfades with the already-branded destination
// frame, so the retired centered lockup cannot ghost through a transition.
for (const [id, spans] of [
  ['teaser', [[2.4, 2.85, 3], [10.95, 11.55, 12]]],
  ['platform-tour', [[5.85, 6.4, 6.6], [77.65, 78.4, 78.6]]],
]) {
  const file = `public/media/product-tours/${id}.mp4`
  const frames = []
  for (const [index, [, , time]] of spans.entries()) {
    const frame = join(work, `${id}-transition-${index}.png`)
    const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(time), '-i', file, '-frames:v', '1', frame], { stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`Transition frame failed: ${id}`)
    frames.push(frame)
  }
  const output = join(work, `${id}-transitions.mp4`)
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-i', frames[0], '-i', frames[1], '-filter_complex', `[0:v][1:v]overlay=0:0:enable='between(t,${spans[0][0]},${spans[0][1]})'[first];[first][2:v]overlay=0:0:enable='between(t,${spans[1][0]},${spans[1][1]})'[v]`, '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', output]
  const result = spawnSync(ffmpeg, args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`Transition refresh failed: ${id}`)
  await copyFile(output, file)
  console.log(`Cleaned ${id} brand transitions`)
}
