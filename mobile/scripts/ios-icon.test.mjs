import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import sharp from 'sharp'
import {iosIcon} from './ios-icon.mjs'

test('App Store tile is opaque navy with approved dark-background artwork', async () => {
  const source = await readFile(new URL('../../public/brand/approved/TiQ_AppIcon_Approved.png', import.meta.url))
  const icon = await iosIcon()
  const metadata = await sharp(icon).metadata()
  assert.equal(metadata.hasAlpha, false)
  assert.equal(metadata.width, 1024)
  assert.equal(metadata.height, 1024)
  const original = await sharp(source).resize(840,840,{fit:'contain'}).ensureAlpha().raw().toBuffer()
  const output = await sharp(icon).raw().toBuffer()
  for(let y=0;y<1024;y++) for(let x=0;x<1024;x++) {
    const result=(y*1024+x)*3
    if(x<92||x>=932||y<92||y>=932) {
      assert.deepEqual([...output.subarray(result,result+3)],[6,23,47])
      continue
    }
    const offset=((y-92)*840+x-92)*4
    if(original[offset+3]===255) assert.deepEqual(output.subarray(result,result+3),original.subarray(offset,offset+3))
    if(original[offset+3]===0) assert.deepEqual([...output.subarray(result,result+3)],[6,23,47])
  }
})
