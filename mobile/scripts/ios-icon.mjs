import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

// App Store icons require an opaque tile. Preserve the supplied artwork's size,
// position and colors; composite its transparency over the approved brand white.
export async function iosIcon() {
  const source = await readFile(new URL('../../public/brand/icons/app-icon-1024.png', import.meta.url))
  const metadata = await sharp(source).metadata()
  assert.equal(metadata.width, 1024)
  assert.equal(metadata.height, 1024)
  return sharp(source).flatten({background:'#FFFFFF'}).removeAlpha().png().toBuffer()
}
