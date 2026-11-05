"""Verify the signed IPA matches the intended store channel and checked bundle."""
import json
import pathlib
import plistlib
import sys
import zipfile

distribution, build_number, ipa_path, export_path, bundle_path = sys.argv[1:]
channels = {'internal': 'TestFlightInternalSandbox', 'app-store': 'AppStore'}
assert distribution in channels, 'Unknown iOS distribution'
options = plistlib.loads(pathlib.Path(export_path).read_bytes())
assert options.get('method') == 'app-store-connect', 'Wrong export method'
assert options.get('testFlightInternalTestingOnly') is (distribution == 'internal'), 'Wrong distribution scope'
with zipfile.ZipFile(ipa_path) as ipa:
    app = 'Payload/App.app/'
    info = plistlib.loads(ipa.read(app + 'Info.plist'))
    assert info.get('CFBundleIdentifier') == 'com.tenaceiq.app', 'Wrong app identity'
    assert info.get('CFBundleShortVersionString') == '1.0', 'Wrong version'
    assert info.get('CFBundleVersion') == build_number, 'Wrong build number'
    assert info.get('TiqApplePurchaseChannel') == channels[distribution], 'Wrong purchase channel'
    assert info.get('ITSAppUsesNonExemptEncryption') is False, 'Unexpected encryption declaration'
    bundle = pathlib.Path(bundle_path)
    assets = ('index.html', 'app.js', 'app.css', 'style.css', 'app-atmosphere.css',
              'premium-surfaces.css', 'brand/courts/tiq-native-night-session.png')
    for path in assets:
        assert ipa.read(app + 'public/' + path) == (bundle / path).read_bytes(), f'Mismatched bundled file: {path}'
    settings = json.loads(ipa.read(app + 'capacitor.config.json'))
    assert settings.get('appId') == 'com.tenaceiq.app' and 'server' not in settings, 'Wrong bundled Capacitor configuration'

print(f'Validated signed TenAceIQ 1.0 ({build_number}) for {distribution} distribution.')
