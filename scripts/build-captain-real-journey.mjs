import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const root = process.cwd()
const media = resolve(root, 'public/media/product-tours')
const asData = async (file, type) => `data:${type};base64,${(await readFile(resolve(media, file))).toString('base64')}`
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.setContent('<canvas width="1280" height="720"></canvas>')
try {
  const output = await page.evaluate(async ({ original, message, scorecard }) => {
    const canvas = document.querySelector('canvas'); const c = canvas.getContext('2d'); const W = 1280, H = 720
    const load = (src) => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src })
    const [messageImage, scorecardImage] = await Promise.all([load(message), load(scorecard)])
    const video = document.createElement('video'); video.src = original; video.crossOrigin = 'anonymous'; video.muted = false; video.playsInline = true; await new Promise((resolve) => { video.oncanplay = resolve })
    const audio = new AudioContext(); const source = audio.createMediaElementSource(video); const destination = audio.createMediaStreamDestination(); source.connect(destination); source.connect(audio.destination); await audio.resume()
    const stream = new MediaStream([canvas.captureStream(30).getVideoTracks()[0], ...destination.stream.getAudioTracks()]); const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 6000000 }); const chunks = []
    const drawText = (text) => { c.fillStyle = '#06172F'; c.fillRect(0, 0, W, H); c.drawImage(text === 'Send the plan.' ? messageImage : scorecardImage, 470, 35, 340, 736); c.fillStyle = '#9BE11D'; c.font = '900 18px Arial'; c.fillText(text === 'Send the plan.' ? 'CAPTAIN MESSAGING' : 'LIVE SCORECARD', 72, 180); c.fillStyle = '#fff'; c.font = '900 52px Arial'; c.fillText(text, 72, 255); c.fillStyle = '#C8D5E6'; c.font = '700 23px Arial'; c.fillText(text === 'Send the plan.' ? 'Review the message, then send it from your phone.' : 'Record the result, then share it with your team.', 72, 305) }
    const render = (elapsed) => { if (elapsed < 18) { c.fillStyle = '#000'; c.fillRect(0,0,W,H); c.drawImage(video, 0, 0, W, H) } else if (elapsed < 23) drawText('Send the plan.'); else drawText('Record it. Share it.') }
    const encoded = await new Promise((resolve, reject) => { recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }; recorder.onerror = () => reject(new Error('Recording failed')); recorder.onstop = async () => { const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer()); let binary=''; for(let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768)); resolve(btoa(binary)) }; const start = performance.now(); const frame = now => { const elapsed = (now-start)/1000; render(elapsed); if(elapsed < 28) requestAnimationFrame(frame); else recorder.stop() }; recorder.start(1000); video.play(); requestAnimationFrame(frame) })
    return encoded
  }, { original: await asData('captain.mp4', 'video/mp4'), message: await asData('captain-messaging-phone.png', 'image/png'), scorecard: await asData('captain-scorecard-phone.png', 'image/png') })
  await writeFile(resolve(media, 'captain-real-journey.webm'), Buffer.from(output, 'base64'))
  console.log('Built real Captain journey video.')
} finally { await browser.close() }
