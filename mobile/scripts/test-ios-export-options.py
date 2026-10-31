import datetime
import pathlib
import plistlib
import subprocess
import sys
import tempfile
import unittest

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
            result = subprocess.run([sys.executable,str(SCRIPTS/'validate-ios-profile.py'),str(path),str(root)],capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertIs(plistlib.loads((root/'export.plist').read_bytes())['testFlightInternalTestingOnly'],True)

    def test_profile_without_associated_domains_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder)
            profile={'TeamIdentifier':['ABCDE12345'],'UUID':'11111111-1111-4111-8111-111111111111',
                     'Entitlements':{'application-identifier':'ABCDE12345.com.tenaceiq.app','aps-environment':'production','get-task-allow':False}}
            path=root/'profile.plist';path.write_bytes(plistlib.dumps(profile))
            result=subprocess.run([sys.executable,str(SCRIPTS/'validate-ios-profile.py'),str(path),str(root)],capture_output=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn(b'Associated Domains-enabled App Store profile required',result.stderr)

    def test_channel_and_internal_distribution_are_both_required(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder)
            for channel,internal,ok in [('TestFlightInternalSandbox',True,True),('Production',True,False),(None,True,False),('TestFlightInternalSandbox',False,False),('TestFlightInternalSandbox','true',False)]:
                info={'CFBundleIdentifier':'com.tenaceiq.app'}
                if channel is not None:info['TiqApplePurchaseChannel']=channel
                (root/'Info.plist').write_bytes(plistlib.dumps(info))
                (root/'export.plist').write_bytes(plistlib.dumps({'method':'app-store-connect','testFlightInternalTestingOnly':internal}))
                result=subprocess.run([sys.executable,str(SCRIPTS/'validate-ios-beta-channel.py'),str(root/'Info.plist'),str(root/'export.plist')],capture_output=True)
                self.assertEqual(result.returncode==0,ok)

if __name__=='__main__':unittest.main()
