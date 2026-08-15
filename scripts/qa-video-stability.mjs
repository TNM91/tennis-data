import sharp from 'sharp'

const [first, second] = process.argv.slice(2)
if (!first || !second) throw new Error('Provide two frame paths.')

const region = { left: 700, top: 140, width: 1130, height: 700 }
const [a, b] = await Promise.all([
  sharp(first).extract(region).raw().toBuffer(),
  sharp(second).extract(region).raw().toBuffer(),
])

let difference = 0
for (let index = 0; index < a.length; index += 1) difference += Math.abs(a[index] - b[index])
console.log(`SCREEN_MEAN_ABS_DIFF=${(difference / a.length).toFixed(6)}`)
