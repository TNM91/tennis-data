import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

// Use the approved dark-background artwork without recoloring it. iOS requires
// an opaque tile; retain the existing 82% mark scale on the brand navy.
export async function iosIcon() {
  const source = await readFile(new URL('../../public/brand/web/header-iq-compact.png', import.meta.url))
  const metadata = await sharp(source).metadata()
  assert.equal(metadata.width, 1024)
  assert.equal(metadata.height, 1024)
  const mark = await sharp(source).resize(840, 840, {fit:'contain'}).png().toBuffer()
  return sharp({create:{width:1024,height:1024,channels:3,background:'#06172F'}})
    .composite([{input:mark,left:92,top:92}]).removeAlpha().png().toBuffer()
}
