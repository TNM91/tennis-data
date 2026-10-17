import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const media = resolve(process.cwd(), 'public/media/product-tours')
const screenNames = [
  'home', 'availability', 'lineup', 'projection', 'scouting',
  'messaging', 'weekly-brief', 'team-brief', 'practice', 'scorecard',
]
const duration = 74

const asDataUrl = async (filename, mimeType) =>
  `data:${mimeType};base64,${(await readFile(resolve(media, filename))).toString('base64')}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.setContent('<canvas width="390" height="844"></canvas>')

try {
  const encoded = await page.evaluate(async ({ screens, voice, duration }) => {
    const canvas = document.querySelector('canvas')
    const context = canvas.getContext('2d')
    const scenes = [
      { end: 15, scroll: 0.35 },
      { end: 21.5, scroll: 0.45 },
      { end: 29, scroll: 0.5 },
      { end: 33, scroll: 0.28 },
      { end: 40, scroll: 0.45 },
      { end: 50, scroll: 0.45 },
      { end: 55, scroll: 0.3 },
      { end: 61, scroll: 0.35 },
      { end: 65, scroll: 0.25 },
      { end: duration, scroll: 0.4 },
    ]
    const loadImage = source => new Promise((resolveImage, rejectImage) => {
      const image = new Image()
      image.onload = () => resolveImage(image)
      image.onerror = rejectImage
      image.src = source
    })
    const images = await Promise.all(screens.map(loadImage))
    const sound = new Audio(voice)
    await new Promise(resolveAudio => { sound.oncanplay = resolveAudio })

    const audioContext = new AudioContext()
    const soundSource = audioContext.createMediaElementSource(sound)
    const audioDestination = audioContext.createMediaStreamDestination()
    soundSource.connect(audioDestination)
    soundSource.connect(audioContext.destination)
    await audioContext.resume()

    const stream = new MediaStream([
      canvas.captureStream(24).getVideoTracks()[0],
      ...audioDestination.stream.getAudioTracks(),
    ])
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 1500000,
    })
    const chunks = []

    const draw = time => {
      const sceneIndex = scenes.findIndex(scene => time < scene.end)
      const activeIndex = sceneIndex === -1 ? scenes.length - 1 : sceneIndex
      const scene = scenes[activeIndex]
      const sceneStart = activeIndex === 0 ? 0 : scenes[activeIndex - 1].end
      const rawProgress = Math.max(0, Math.min(1, (time - sceneStart) / (scene.end - sceneStart)))
      const scrollProgress = Math.max(0, (rawProgress - 0.28) / 0.72)
      const easedScroll = scrollProgress * scrollProgress * (3 - (2 * scrollProgress))
      const image = images[activeIndex]
      const sourceHeight = image.width * 844 / 390
      const maxSourceY = Math.max(0, image.height - sourceHeight)
      const sourceY = maxSourceY * scene.scroll * easedScroll

      context.fillStyle = '#FFFFFF'
      context.fillRect(0, 0, 390, 844)
      context.drawImage(image, 0, sourceY, image.width, sourceHeight, 0, 0, 390, 844)
    }

    return await new Promise((resolveVideo, rejectVideo) => {
      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data)
      }
      recorder.onerror = () => rejectVideo(new Error('Recording Captain story failed.'))
      recorder.onstop = async () => {
        const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
        let binary = ''
        for (let index = 0; index < bytes.length; index += 32768) {
          binary += String.fromCharCode(...bytes.subarray(index, index + 32768))
        }
        resolveVideo(btoa(binary))
      }
      const start = performance.now()
      const render = now => {
        const time = (now - start) / 1000
        draw(time)
        if (time < duration) requestAnimationFrame(render)
        else recorder.stop()
      }
      recorder.start(1000)
      sound.play()
      requestAnimationFrame(render)
    })
  }, {
    screens: await Promise.all(screenNames.map(name => asDataUrl(`captain-scroll-${name}.png`, 'image/png'))),
    voice: await asDataUrl('captain-full-phone-story.wav', 'audio/wav'),
    duration,
  })

  await writeFile(resolve(media, 'captain-scrolling-story.webm'), Buffer.from(encoded, 'base64'))
  console.log('Built the phone-native Captain story.')
} finally {
  await browser.close()
}
