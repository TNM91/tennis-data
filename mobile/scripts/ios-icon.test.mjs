import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import sharp from 'sharp'
import {iosIcon} from './ios-icon.mjs'

test('App Store tile preserves the complete approved artwork at full tile size without extra padding', async () => {
  const source = await readFile(new URL('../../public/brand/approved/TiQ_AppIcon_Approved.png', import.meta.url))
  const icon = await iosIcon()
  const metadata = await sharp(icon).metadata()
  assert.equal(metadata.hasAlpha, false)
  assert.equal(metadata.width, 1024)
  assert.equal(metadata.height, 1024)
  const expected = await sharp(source).resize(1024,1024,{fit:'contain'})
    .flatten({background:'#06172F'}).removeAlpha().raw().toBuffer()
  const output = await sharp(icon).raw().toBuffer()
  assert.deepEqual(output, expected)
})
