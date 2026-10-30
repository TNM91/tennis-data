"""Require an internally distributed sandbox build before upload."""
import pathlib
import plistlib
import sys
info = plistlib.loads(pathlib.Path(sys.argv[1]).read_bytes())
options = plistlib.loads(pathlib.Path(sys.argv[2]).read_bytes())
assert info.get('CFBundleIdentifier') == 'com.tenaceiq.app', 'Wrong app identity'
assert info.get('TiqApplePurchaseChannel') == 'TestFlightInternalSandbox', 'Sandbox-only channel required'
assert options.get('method') == 'app-store-connect', 'Wrong export method'
assert options.get('testFlightInternalTestingOnly') is True, 'Internal-only distribution required'
print('Validated internal TestFlight sandbox channel.')
