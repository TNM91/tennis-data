import {APPLE_MEMBERSHIP_PRODUCTS} from '../../lib/apple-membership-products'

const products = APPLE_MEMBERSHIP_PRODUCTS.map(product => ({id: product.productId, name: product.name}))
const native = Reflect.get(window, 'Capacitor')
Object.assign(window, {
 CapacitorCustomPlatform: {name: 'web'},
 Capacitor: {...native, PluginHeaders: []},
})

void import('./mobile-navigation').then(() => {
 const fixtureFetch = window.fetch.bind(window)
 window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input, location.href)
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  if(url.hostname === 'www.tenaceiq.com' && method === 'GET'){
   if(url.pathname === '/api/mobile/account') return Response.json({
    ok:true,email:'preview@example.test',reviewDays:7,fulfillment:'automated',verificationRequired:false,request:null,
   })
   if(url.pathname === '/api/mobile/apple-purchases') return Response.json({
    ok:true,applePurchases:1,enabled:true,environment:'Production',canPurchase:true,webAccess:false,activeProductId:null,products,
   })
  }
  return fixtureFetch(input, init)
 }
})

const selectors = {
 lab: '.lab-scoreboard',
 explore: '.native-explore-hero',
 compete: '[data-app-destination="leagues"]',
} as const

function waitForElement<T extends HTMLElement>(selector: string): Promise<T> {
 return new Promise((resolve, reject) => {
  let attempts = 0
  const timer = window.setInterval(() => {
   const element = document.querySelector<T>(selector)
   if(element?.getBoundingClientRect().height) {
    window.clearInterval(timer)
    resolve(element)
   } else if(++attempts >= 100) {
    window.clearInterval(timer)
    reject(Error('Screenshot content did not load: ' + selector))
   }
  }, 100)
 })
}

Object.assign(window, {
 async tiqStoreScreenshot(screen: string) {
  await waitForElement(selectors.lab)
  if(screen === 'player' || screen === 'captain'){
   const account = await waitForElement<HTMLButtonElement>('.native-account-entry')
   account.click()
   const sku = products.find(product => product.id.endsWith('.' + screen + '.monthly'))?.id
   if(!sku) throw Error('Unknown subscription')
   const purchase = await waitForElement<HTMLButtonElement>('[data-apple-buy="' + sku + '"]')
   const panel = await waitForElement('[data-apple-membership]')
   if(!purchase.textContent?.includes('/month')) throw Error('Missing subscription price')
   panel.scrollIntoView({block:'start',behavior:'instant'})
  } else {
   if(screen !== 'lab' && screen !== 'explore' && screen !== 'compete') throw Error('Unknown screenshot screen')
   const tab = await waitForElement<HTMLButtonElement>('.app-navigation [data-screen="' + screen + '"]')
   if(tab.getAttribute('aria-current') !== 'page') tab.click()
   await waitForElement(selectors[screen])
   window.scrollTo(0,0)
  }
  await document.fonts.ready
  await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})))
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return screen
 },
})
