import {readFile} from 'node:fs/promises'
import {build} from 'esbuild'
import {fileURLToPath} from 'node:url'

export const googleBillingVersion='9.1.0'
export function googleBillingGradle(source){
 const dependency=`implementation "com.android.billingclient:billing:${googleBillingVersion}"`
 if(source.includes(dependency))return source
 if(source.includes('com.android.billingclient:billing:')||!source.includes('dependencies {'))throw Error('Review the Android billing dependency before preparing.')
 return source.replace('dependencies {','dependencies {\n    '+dependency)
}
export async function googleBillingJava(){
 const compiled=await build({entryPoints:[fileURLToPath(new URL('../../lib/google-play-products.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false})
 const {GOOGLE_PLAY_PRODUCTS}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
 const declarations=GOOGLE_PLAY_PRODUCTS.map(p=>`        specs.put(${JSON.stringify(p.id)}, new Spec(${JSON.stringify(p.type)}, ${p.amountCents*10000}L, ${JSON.stringify(p.basePlanId??p.purchaseOptionId)}));`).join('\n')
 const source=await readFile(new URL('../android-native/TiqGooglePurchases.java',import.meta.url),'utf8')
 if(source.split('/* TIQ_PRODUCT_SPECS */').length!==2)throw Error('Google purchase catalog placeholder missing')
 return source.replace('/* TIQ_PRODUCT_SPECS */',declarations)
}
