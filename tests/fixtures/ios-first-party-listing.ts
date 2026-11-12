const capacitor = Reflect.get(window,'Capacitor')
Object.assign(window,{
  CapacitorCustomPlatform:{name:'web'},
  Capacitor:{...capacitor,PluginHeaders:[]},
})
history.replaceState(null,'','?unlinked=1&chat-display-name=1&training-inbox-review=1&training-assignment-feedback=1')
const ready = import('./mobile-navigation')

async function visible<T extends HTMLElement>(selector:string, text='') {
  for(let attempt=0;attempt<100;attempt++){
    const element = Array.from(document.querySelectorAll<T>(selector)).find(item=>
      item.getBoundingClientRect().height>0 && (!text || item.textContent?.includes(text)))
    if(element)return element
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  throw Error('missing '+selector)
}

Object.assign(window,{
  async tiqStoreScreenshot(screen:string) {
    try {
      await ready
      await visible('h1','My Lab')
      if(screen==='team-chat'){
        (await visible<HTMLButtonElement>('.app-navigation [data-screen="teams"]')).click()
        ;(await visible<HTMLButtonElement>('button','Baseline Aces')).click()
        await visible('.team-conversation','Sam')
        const message = await visible<HTMLTextAreaElement>('#chat-draft')
        message.value='See you on Court 3!'
        message.dispatchEvent(new Event('input',{bubbles:true}))
        ;(await visible<HTMLButtonElement>('#chat-composer button[type="submit"]')).click()
        await visible('.team-conversation','See you on Court 3!')
      }else if(screen==='coach-training'){
        (await visible<HTMLButtonElement>('[data-app-destination="coach"]')).click()
        ;(await visible<HTMLButtonElement>('[data-coach-next-assignment] button','Return depth under pressure')).click()
        await visible('.training-assignment-next','Return depth under pressure')
        await visible('.training-coach-feedback','Baseline recovery drill')
      }else return 'unknown_screen'
      await document.fonts.ready
      await Promise.all(Array.from(document.images,image=>image.decode().catch(()=>{})))
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
      return document.documentElement.scrollWidth<=innerWidth?screen:'horizontal_overflow'
    }catch(error){
      return error instanceof Error?error.message:'capture_failed'
    }
  },
})
