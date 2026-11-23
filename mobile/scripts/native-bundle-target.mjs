export const androidAppId = 'com.tenaceiq.app'
export function nativeBundleTarget(args, environment = process.env) {
  const preview = args.includes('--first-party-preview'), fullApp = args.includes('--first-party-full'), android = args.includes('--android')
  if (preview && fullApp) throw Error('Choose one first-party bundle target.')
  if (android && (!fullApp || preview)) throw Error('Android packaging requires the full first-party app.')
  const distribution = android ? environment.TIQ_ANDROID_DISTRIBUTION || 'internal' : environment.TIQ_IOS_DISTRIBUTION
  if (android && !['internal', 'store'].includes(distribution)) throw Error('Choose internal or store for the Android distribution.')
  const capacitorConfig = android ? {
    appId: androidAppId, appName: 'TenAceIQ', webDir: 'bundled', loggingBehavior: 'none',
    android: {allowMixedContent: false, webContentsDebuggingEnabled: false, backgroundColor: '#061326'},
    plugins: {PushNotifications: {presentationOptions: []}, SystemBars: {insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'DARK'}},
  } : {
    appId: 'com.tenaceiq.prototype', appName: 'TenAceIQ Prototype', webDir: 'bundled', loggingBehavior: 'none',
    plugins: {PushNotifications: {presentationOptions: []}},
  }
  return {preview, fullApp, firstParty: preview || fullApp, android, distribution, tournamentPractice: fullApp && distribution === 'internal', capacitorConfig}
}
