"""Verify the signed IPA matches the intended store channel and checked bundle."""
import json
import pathlib
import plistlib
import sys
import zipfile

distribution, build_number, ipa_path, export_path, bundle_path, *args = sys.argv[1:]
first_party = len(args) == 2 and args[0] == '--first-party'
full_app = args == ['--first-party-full']
assert not args or first_party or full_app, 'Unknown iOS distribution validation option'
channels = {'internal': 'TestFlightInternalSandbox', 'app-store': 'AppStore'}
assert distribution in channels, 'Unknown iOS distribution'
assert not (first_party or full_app) or distribution == 'internal', 'This first-party candidate is internal-only'
options = plistlib.loads(pathlib.Path(export_path).read_bytes())
assert options.get('method') == 'app-store-connect', 'Wrong export method'
assert options.get('testFlightInternalTestingOnly') is (distribution == 'internal'), 'Wrong distribution scope'
if first_party:
    entitlements = plistlib.loads(pathlib.Path(args[1]).read_bytes())
    assert entitlements.get('application-identifier') == options['teamID'] + '.com.tenaceiq.app', 'Wrong offline signing identity'
    assert entitlements.get('get-task-allow') is not True, 'Unexpected debug entitlement'
    assert not entitlements.keys() & {'aps-environment', 'com.apple.developer.associated-domains'}, 'Unexpected beta entitlement in offline app'

with zipfile.ZipFile(ipa_path) as ipa:
    app = 'Payload/App.app/'
    info = plistlib.loads(ipa.read(app + 'Info.plist'))
    assert info.get('CFBundleIdentifier') == 'com.tenaceiq.app', 'Wrong app identity'
    assert info.get('CFBundleShortVersionString') == '1.0', 'Wrong version'
    assert info.get('CFBundleVersion') == build_number, 'Wrong build number'
    assert info.get('ITSAppUsesNonExemptEncryption') is False, 'Unexpected encryption declaration'
    bundle = pathlib.Path(bundle_path)
    settings = json.loads(ipa.read(app + 'capacitor.config.json'))
    assert settings.get('appId') == 'com.tenaceiq.app' and 'server' not in settings, 'Wrong bundled Capacitor configuration'
    if first_party:
        forbidden = {'TiqApplePurchaseChannel', 'UIBackgroundModes', 'CFBundleURLTypes'}
        assert not info.keys() & forbidden and not any(key.endswith('UsageDescription') for key in info), 'Unexpected beta settings in offline app'
        assert settings == {'appId': 'com.tenaceiq.app', 'appName': 'TenAceIQ', 'webDir': 'bundled-first-party',
                            'loggingBehavior': 'none', 'ios': {'path': 'ios-first-party', 'includePlugins': []},
                            'packageClassList': []}, 'Unexpected offline configuration or plugin registration'
        assets = ('index.html', 'app.js', 'app.css', 'release-scope.json', 'brand/header-logo-transparent.png', 'brand/court.png')
        shims = ('cordova.js', 'cordova_plugins.js')
        public = app + 'public/'
        packed = [name[len(public):] for name in ipa.namelist() if name.startswith(public) and not name.endswith('/')]
        assert sorted(packed) == sorted(assets + shims), 'Unexpected resources in the offline IPA'
        assert all(ipa.read(public + shim) == b'' for shim in shims), 'Unexpected Cordova code in offline IPA'
        assert json.loads(ipa.read(public + 'release-scope.json')) == {'profile': 'first-party-offline', 'version': 1}, 'Wrong release scope'
    else:
        assert info.get('TiqApplePurchaseChannel') == channels[distribution], 'Wrong purchase channel'
        assets = ('index.html', 'app.js', 'app.css', 'style.css', 'app-atmosphere.css',
                  'premium-surfaces.css', 'brand/courts/tiq-native-night-session.png')
        scope = app + 'public/release-scope.json'
        if full_app:
            assert settings.get('webDir') == 'bundled', 'Wrong full-app web directory'
            assert json.loads(ipa.read(scope)) == {'profile': 'first-party-full', 'version': 1}, 'Wrong full-app release scope'
            assets += ('release-scope.json',)
        else:
            assert scope not in ipa.namelist(), 'The standard IPA contains a first-party scope marker'
    for path in assets:
        assert ipa.read(app + 'public/' + path) == (bundle / path).read_bytes(), f'Mismatched bundled file: {path}'

profile = 'offline' if first_party else 'first-party full app' if full_app else 'standard'
print(f'Validated signed TenAceIQ 1.0 ({build_number}) {profile} build for {distribution} distribution.')
