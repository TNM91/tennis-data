import datetime
import json
import pathlib
import plistlib
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPTS = pathlib.Path(__file__).resolve().parent
class InternalBetaExport(unittest.TestCase):
    def test_profile_exports_internal_only(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            profile = {'TeamIdentifier':['ABCDE12345'], 'UUID':'11111111-1111-4111-8111-111111111111',
                       'Entitlements':{'application-identifier':'ABCDE12345.com.tenaceiq.app', 'aps-environment':'production', 'com.apple.developer.associated-domains':['*'], 'get-task-allow':False},
                       'ExpirationDate':datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)+datetime.timedelta(days=1),
                       'DeveloperCertificates':[b'synthetic-profile-certificate']}
            path = root/'profile.plist'
            path.write_bytes(plistlib.dumps(profile))
            for distribution, internal in [('internal', True), ('app-store', False)]:
                result = subprocess.run([sys.executable,str(SCRIPTS/'validate-ios-profile.py'),str(path),str(root),distribution],capture_output=True)
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertIs(plistlib.loads((root/'export.plist').read_bytes())['testFlightInternalTestingOnly'],internal)

    def test_profile_without_associated_domains_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder)
            profile={'TeamIdentifier':['ABCDE12345'],'UUID':'11111111-1111-4111-8111-111111111111',
                     'Entitlements':{'application-identifier':'ABCDE12345.com.tenaceiq.app','aps-environment':'production','get-task-allow':False}}
            path=root/'profile.plist';path.write_bytes(plistlib.dumps(profile))
            result=subprocess.run([sys.executable,str(SCRIPTS/'validate-ios-profile.py'),str(path),str(root)],capture_output=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn(b'Associated Domains-enabled App Store profile required',result.stderr)

    def test_signed_package_matches_distribution_and_bundle(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            assets = ('index.html', 'app.js', 'app.css', 'style.css', 'app-atmosphere.css',
                      'premium-surfaces.css', 'brand/courts/tiq-native-night-session.png')
            for name in assets:
                asset = root / name
                asset.parent.mkdir(parents=True, exist_ok=True)
                asset.write_bytes(b'checked asset')
            cases = [('internal', 'TestFlightInternalSandbox', True, True),
                     ('app-store', 'AppStore', False, True),
                     ('internal', 'AppStore', True, False),
                     ('app-store', 'AppStore', True, False),
                     ('app-store', 'TestFlightInternalSandbox', False, False),
                     ('internal', '', True, False),
                     ('internal', 'TestFlightInternalSandbox', 'true', False)]
            for distribution, channel, internal, ok in cases:
                with self.subTest(distribution=distribution, channel=channel, internal=internal):
                    info = {'CFBundleIdentifier': 'com.tenaceiq.app', 'CFBundleShortVersionString': '1.0',
                            'CFBundleVersion': '226', 'TiqApplePurchaseChannel': channel,
                            'ITSAppUsesNonExemptEncryption': False}
                    with zipfile.ZipFile(root/'App.ipa','w') as ipa:
                        app = 'Payload/App.app/'
                        ipa.writestr(app + 'Info.plist', plistlib.dumps(info))
                        ipa.writestr(app + 'capacitor.config.json', '{"appId":"com.tenaceiq.app"}')
                        for name in assets:
                            ipa.write(root/name, app + 'public/' + name)
                    (root/'export.plist').write_bytes(plistlib.dumps({'method':'app-store-connect','testFlightInternalTestingOnly':internal}))
                    result = subprocess.run([sys.executable, str(SCRIPTS/'validate-ios-distribution.py'),
                                             distribution, '226', str(root/'App.ipa'), str(root/'export.plist'), str(root)], capture_output=True)
                    self.assertEqual(result.returncode == 0, ok, result.stderr)

    def test_full_app_scope_and_store_channel_match_the_export(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            assets = ('index.html', 'app.js', 'app.css', 'style.css', 'app-atmosphere.css',
                      'premium-surfaces.css', 'brand/courts/tiq-native-night-session.png', 'release-scope.json')
            for name in assets:
                asset = root / name
                asset.parent.mkdir(parents=True, exist_ok=True)
                asset.write_bytes(b'checked asset')
            (root/'release-scope.json').write_text('{"profile":"first-party-full","version":1}')
            cases = [
                ('internal', 'TestFlightInternalSandbox', True, True, ['--first-party-full'], True),
                ('internal', 'TestFlightInternalSandbox', True, False, ['--first-party-full'], False),
                ('internal', 'TestFlightInternalSandbox', True, True, [], False),
                ('app-store', 'AppStore', False, True, ['--first-party-full'], True),
                ('app-store', 'AppStore', False, False, ['--first-party-full'], False),
                ('app-store', 'AppStore', True, True, ['--first-party-full'], False),
                ('app-store', 'TestFlightInternalSandbox', False, True, ['--first-party-full'], False),
            ]
            for distribution, channel, internal, include_scope, args, ok in cases:
                info = {'CFBundleIdentifier': 'com.tenaceiq.app', 'CFBundleShortVersionString': '1.0', 'CFBundleVersion': '256',
                        'TiqApplePurchaseChannel': channel, 'ITSAppUsesNonExemptEncryption': False}
                with zipfile.ZipFile(root/'App.ipa', 'w') as ipa:
                    app = 'Payload/App.app/'
                    ipa.writestr(app + 'Info.plist', plistlib.dumps(info))
                    ipa.writestr(app + 'capacitor.config.json', '{"appId":"com.tenaceiq.app","webDir":"bundled"}')
                    for name in assets if include_scope else assets[:-1]:
                        ipa.write(root/name, app + 'public/' + name)
                (root/'export.plist').write_bytes(plistlib.dumps({'method':'app-store-connect','testFlightInternalTestingOnly':internal}))
                result = subprocess.run([sys.executable, str(SCRIPTS/'validate-ios-distribution.py'), distribution, '256',
                                         str(root/'App.ipa'), str(root/'export.plist'), str(root), *args], capture_output=True)
                self.assertEqual(result.returncode == 0, ok, result.stderr)

    def test_offline_export_rejects_beta_resources_and_entitlements(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            assets = {name: b'checked asset' for name in ('index.html', 'app.js', 'app.css',
                                                         'brand/header-logo-transparent.png', 'brand/court.png')}
            assets['release-scope.json'] = b'{"profile":"first-party-offline","version":1}'
            for name, data in assets.items():
                asset = root / name
                asset.parent.mkdir(parents=True, exist_ok=True)
                asset.write_bytes(data)
            settings = {'appId': 'com.tenaceiq.app', 'appName': 'TenAceIQ', 'webDir': 'bundled-first-party',
                        'loggingBehavior': 'none', 'ios': {'path': 'ios-first-party', 'includePlugins': []},
                        'packageClassList': []}
            info = {'CFBundleIdentifier': 'com.tenaceiq.app', 'CFBundleShortVersionString': '1.0',
                    'CFBundleVersion': '255', 'ITSAppUsesNonExemptEncryption': False}
            (root/'export.plist').write_bytes(plistlib.dumps({'method': 'app-store-connect',
                                                             'teamID': 'ABCDE12345', 'testFlightInternalTestingOnly': True}))
            cases = {
                'clean offline package': {},
                'registered camera plugin': {'plugins': ['CAPCameraPlugin']},
                'camera permission': {'info': {'NSCameraUsageDescription': 'Take a photo'}},
                'StoreKit channel': {'info': {'TiqApplePurchaseChannel': 'TestFlightInternalSandbox'}},
                'push entitlement': {'entitlements': {'aps-environment': 'production'}},
                'universal link entitlement': {'entitlements': {'com.apple.developer.associated-domains': ['applinks:www.tenaceiq.com']}},
                'extra resource': {'public': {'beta.js': b'Unexpected client code'}},
                'modified shim': {'public': {'cordova.js': b'Unexpected Cordova code'}},
                'changed bundle': {'public': {'app.js': b'Wrong client'}},
                'public export': {'distribution': 'app-store'},
            }
            for name, case in cases.items():
                with self.subTest(case=name):
                    with zipfile.ZipFile(root/'App.ipa', 'w') as ipa:
                        app = 'Payload/App.app/'
                        ipa.writestr(app + 'Info.plist', plistlib.dumps({**info, **case.get('info', {})}))
                        ipa.writestr(app + 'capacitor.config.json', json.dumps({**settings, 'packageClassList': case.get('plugins', [])}))
                        public = {**assets, 'cordova.js': b'', 'cordova_plugins.js': b'', **case.get('public', {})}
                        for path, data in public.items():
                            ipa.writestr(app + 'public/' + path, data)
                    entitlements = {'application-identifier': 'ABCDE12345.com.tenaceiq.app', 'get-task-allow': False,
                                    **case.get('entitlements', {})}
                    (root/'entitlements.plist').write_bytes(plistlib.dumps(entitlements))
                    result = subprocess.run([sys.executable, str(SCRIPTS/'validate-ios-distribution.py'),
                                             case.get('distribution', 'internal'), '255', str(root/'App.ipa'),
                                             str(root/'export.plist'), str(root), '--first-party',
                                             str(root/'entitlements.plist')], capture_output=True)
                    self.assertEqual(result.returncode == 0, not case, result.stderr)

if __name__=='__main__':unittest.main()
