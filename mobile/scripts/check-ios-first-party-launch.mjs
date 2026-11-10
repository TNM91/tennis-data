import sharp from 'sharp'

const {data,info} = await sharp(process.argv[2]).removeAlpha().raw().toBuffer({resolveWithObject:true})
let panelPixels = 0
let samples = 0

// Sample the practice card's navy surface, away from the simulator status bar.
for(let y = Math.floor(info.height*.4); y < info.height*.66; y += 8){
  for(let x = Math.floor(info.width*.25); x < info.width*.75; x += 8){
    const offset = (y*info.width+x)*info.channels
    if(data[offset]===13 && data[offset+1]===34 && data[offset+2]===59)panelPixels++
    samples++
  }
}

if(panelPixels < samples/4){
  process.exitCode = 1
}else{
  console.log('The offline practice card rendered in the simulator.')
}
