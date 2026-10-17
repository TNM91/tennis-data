import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const media = resolve(process.cwd(), 'public/media/product-tours')
const data = async (name, mime) => `data:${mime};base64,${(await readFile(resolve(media, name))).toString('base64')}`
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.setContent('<canvas width="1280" height="720"></canvas>')
try {
  const encoded = await page.evaluate(async (assets) => {
    const canvas = document.querySelector('canvas'), c = canvas.getContext('2d'), W = 1280, H = 720
    const load = src => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src })
    const [home, lineup, scouting, messaging, scorecard] = await Promise.all(assets.screens.map(load))
    const video = document.createElement('video'); video.src = assets.voice; await new Promise(resolve => video.oncanplay = resolve)
    const audio = new AudioContext(), source = audio.createMediaElementSource(video), destination = audio.createMediaStreamDestination(); source.connect(destination); source.connect(audio.destination); await audio.resume()
    const stream = new MediaStream([canvas.captureStream(30).getVideoTracks()[0], ...destination.stream.getAudioTracks()]); const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 6000000 }); const chunks = []
    const scene = (t) => t < 5 ? [home, 'TEAM HOME', 'Start in Teams. See the match week at a glance.'] : t < 10 ? [lineup, 'LINEUPS', 'Build and compare your best lineup from your phone.'] : t < 15 ? [scouting, 'SCOUTING', 'Open the matchup context before match day.'] : t < 21 ? [messaging, 'TEAM MESSAGING', 'Review the plan, then send the right message.'] : [scorecard, 'LIVE SCORECARD', 'Record the result and share it with your team.']
    const draw = t => { const [image, label, copy] = scene(t); const g = c.createLinearGradient(0,0,W,H); g.addColorStop(0,'#06172F'); g.addColorStop(1,'#123B68'); c.fillStyle=g; c.fillRect(0,0,W,H); c.fillStyle='#9BE11D'; c.font='900 16px Arial'; c.fillText(label,76,190); c.fillStyle='#fff'; c.font='900 48px Arial'; c.fillText(copy,76,258); c.fillStyle='#BFD0E5'; c.font='700 20px Arial'; c.fillText('Captain keeps the next team decision in one place.',76,310); c.fillStyle='#9BE11D'; c.fillRect(76,345,86,5); c.save(); c.shadowColor='rgba(0,0,0,.45)'; c.shadowBlur=28; c.drawImage(image,720,26,390,844); c.restore(); c.fillStyle='rgba(255,255,255,.3)'; c.fillRect(64,675,1152,3); c.fillStyle='#9BE11D'; c.fillRect(64,675,1152*Math.min(1,t/28),3) }
    return await new Promise((resolve, reject) => { recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data) }; recorder.onerror=()=>reject(new Error('Phone journey recording failed')); recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));resolve(btoa(binary))}; const start=performance.now(); const frame=now=>{const t=(now-start)/1000;draw(t);if(t<28)requestAnimationFrame(frame);else recorder.stop()}; recorder.start(1000); video.play(); requestAnimationFrame(frame) })
  }, { voice: await data('captain.mp4','video/mp4'), screens: await Promise.all(['captain-phone-home.png','captain-phone-lineup.png','captain-phone-scouting.png','captain-phone-messaging.png','captain-phone-scorecard.png'].map(name => data(name,'image/png'))) })
  await writeFile(resolve(media, 'captain-phone-journey.webm'), Buffer.from(encoded, 'base64'))
  console.log('Built phone-only Captain journey video.')
} finally { await browser.close() }
