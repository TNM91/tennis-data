import assert from 'node:assert/strict'
import {androidAppId,nativeBundleTarget} from './native-bundle-target.mjs'
import {googleBillingGradle} from './android-google-billing.mjs'

export function checkAndroidConfig(config,scope) {
  assert.deepEqual(scope,{platform:'android',profile:'first-party-full',distribution:scope?.distribution,version:1})
  const expected=nativeBundleTarget(['--android','--first-party-full'],{TIQ_ANDROID_DISTRIBUTION:scope.distribution}).capacitorConfig
  assert.deepEqual(config,expected,'Build the Android first-party bundle before preparing Android.')
}
export function androidGradle(source) {
  assert.ok(source.includes(`namespace = "${androidAppId}"`)&&source.includes(`applicationId "${androidAppId}"`),'Unexpected Android application identity')
  if(source.includes("def tiqBuildNumber = System.getenv('TIQ_ANDROID_BUILD_NUMBER')")){
    assert.ok(source.includes('versionCode tiqBuildNumber.toInteger()')&&source.includes('applicationIdSuffix ".dev"')&&/release \{\s+debuggable false/.test(source),'Unexpected managed Android build configuration')
    return googleBillingGradle(source.includes('buildFeatures { buildConfig true }')?source:source.replace('android {','android {\n    buildFeatures { buildConfig true }'))
  }
  assert.ok(source.includes('versionCode 1')&&source.includes('versionName "1.0"'),'Unexpected Android version template')
  assert.ok(source.includes('    buildTypes {'),'Unexpected Android build template')
  return googleBillingGradle(source.replace('android {',`def tiqBuildNumber = System.getenv('TIQ_ANDROID_BUILD_NUMBER') ?: '1'
if (!(tiqBuildNumber ==~ /[1-9][0-9]{0,8}/)) throw new GradleException('Use a positive Android build number of at most nine digits.')

android {
    buildFeatures { buildConfig true }`).replace('versionCode 1','versionCode tiqBuildNumber.toInteger()').replace('    buildTypes {',`    buildTypes {
        debug {
            applicationIdSuffix ".dev"
            debuggable true
        }`).replace('        release {','        release {\n            debuggable false'))
}
export const androidManifest=`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-feature android:name="android.hardware.camera" android:required="false" />
  <application android:allowBackup="false" android:fullBackupContent="false" android:dataExtractionRules="@xml/data_extraction_rules"
      android:usesCleartextTraffic="false" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round"
      android:label="@string/app_name" android:supportsRtl="true" android:theme="@style/AppTheme">
    <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="tenaceiq_activity" />
    <meta-data android:name="firebase_messaging_auto_init_enabled" android:value="false" />
    <meta-data android:name="firebase_analytics_collection_deactivated" android:value="true" />
    <activity android:name=".MainActivity" android:label="@string/title_activity_main" android:theme="@style/AppTheme.NoActionBarLaunch"
        android:exported="true" android:launchMode="singleTask" android:windowSoftInputMode="adjustResize"
        android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density">
      <intent-filter><action android:name="android.intent.action.MAIN" /><category android:name="android.intent.category.LAUNCHER" /></intent-filter>
      <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" /><category android:name="android.intent.category.DEFAULT" /><category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="https" /><data android:host="www.tenaceiq.com" />
        <data android:pathPrefix="/coach/invite/" />
        <data android:path="/team-room" /><data android:path="/team-room/join" /><data android:path="/chats" /><data android:path="/chats/join" />
        <data android:pathPrefix="/explore/leagues/tiq/" /><data android:pathPrefix="/tournaments/" /><data android:pathPrefix="/matches/" />
      </intent-filter>
    </activity>
    <provider android:name="androidx.core.content.FileProvider" android:authorities="\${applicationId}.fileprovider" android:exported="false" android:grantUriPermissions="true">
      <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" />
    </provider>
  </application>
</manifest>
`
export const androidDataExtraction=`<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>${['root','file','database','sharedpref','external'].map(domain=>`<exclude domain="${domain}" path="." />`).join('')}</cloud-backup>
  <device-transfer>${['root','file','database','sharedpref','external'].map(domain=>`<exclude domain="${domain}" path="." />`).join('')}</device-transfer>
</data-extraction-rules>
`
export const androidMainActivity=`package ${androidAppId};

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(TiqGooglePurchases.class);
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    }
}
`
export const androidLegacyIcon=`<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android" android:src="@drawable/tenaceiq_app_icon" android:gravity="fill" />
`
export const androidAdaptiveIcon=`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/tenaceiq_launcher_background" />
  <foreground><inset android:inset="16%"><bitmap android:src="@drawable/tenaceiq_app_icon" android:gravity="fill" /></inset></foreground>
</adaptive-icon>
`
export const androidStyles=`<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="BaseAppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="colorPrimary">@color/tenaceiq_launcher_background</item>
    <item name="colorPrimaryDark">@color/tenaceiq_launcher_background</item>
    <item name="colorAccent">@color/tenaceiq_accent</item>
    <item name="android:windowBackground">@color/tenaceiq_launcher_background</item>
    <item name="android:windowLightStatusBar">false</item>
  </style>
  <style name="AppTheme" parent="BaseAppTheme" />
  <style name="AppTheme.NoActionBar" parent="AppTheme">
    <item name="windowActionBar">false</item><item name="windowNoTitle">true</item>
  </style>
  <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/tenaceiq_launcher_background</item>
    <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher</item>
    <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
  </style>
</resources>
`
export const androidStyles27=`<resources><style name="AppTheme" parent="BaseAppTheme"><item name="android:windowLightNavigationBar">false</item></style></resources>\n`
export const androidStyles29=`<resources><style name="AppTheme" parent="BaseAppTheme"><item name="android:windowLightNavigationBar">false</item><item name="android:forceDarkAllowed">false</item></style></resources>\n`
