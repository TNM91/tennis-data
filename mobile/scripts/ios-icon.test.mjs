import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import sharp from 'sharp'
import {iosIcon} from './ios-icon.mjs'
test('App Store tile is RGB and preserves supplied opaque artwork pixels', async () => {
  const source = await readFile(new URL('../../public/brand/icons/app-icon-1024.png', import.meta.url))
  const icon = await iosIcon()
  const metadata = await sharp(icon).metadata()
  assert.equal(metadata.hasAlpha, false)
  assert.equal(metadata.width, 1024)
  assert.equal(metadata.height, 1024)
  const original = await sharp(source).ensureAlpha().raw().toBuffer()
  const output = await sharp(icon).raw().toBuffer()
  for(let pixel=0; pixel<1024*1024; pixel++) {
    const offset=pixel*4, result=pixel*3
    if(original[offset+3]===255) assert.deepEqual(output.subarray(result,result+3),original.subarray(offset,offset+3))
    if(original[offset+3]===0) assert.deepEqual([...output.subarray(result,result+3)],[255,255,255])
  }
})
