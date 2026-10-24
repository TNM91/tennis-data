import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

// Scale the complete approved tile to the App Store size without adding an inset.
// Flatten transparency onto brand navy because iOS requires an opaque icon.
export async function iosIcon() {
  const source = await readFile(new URL('../../public/brand/approved/TiQ_AppIcon_Approved.png', import.meta.url))
  const metadata = await sharp(source).metadata()
  assert.equal(metadata.width, 1254)
  assert.equal(metadata.height, 1254)
  return sharp(source).resize(1024, 1024, {fit:'contain'})
    .flatten({background:'#06172F'}).removeAlpha().png().toBuffer()
}
