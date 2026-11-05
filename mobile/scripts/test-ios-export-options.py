import datetime
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

if __name__=='__main__':unittest.main()
