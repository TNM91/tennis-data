"""Validate the app-specific distribution profile without printing account data."""
import datetime
import pathlib
import plistlib
import re
import sys

profile = plistlib.loads(pathlib.Path(sys.argv[1]).read_bytes())
out = pathlib.Path(sys.argv[2])
team = profile['TeamIdentifier'][0]
uuid = profile['UUID']
assert re.fullmatch(r'[A-Z0-9]{10}', team), 'Invalid team identifier'
assert re.fullmatch(r'[A-Fa-f0-9-]{36}', uuid), 'Invalid profile UUID'
assert profile['Entitlements']['application-identifier'] == team + '.com.tenaceiq.app', 'Wrong app ID'
assert profile['Entitlements'].get('aps-environment') == 'production', 'Push-enabled App Store profile required'
assert profile['Entitlements'].get('get-task-allow') is False, 'Debug profile forbidden'
assert not profile.get('ProvisionedDevices') and not profile.get('ProvisionsAllDevices'), 'Expected App Store profile'
assert profile['ExpirationDate'] > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None), 'Expired profile'
assert len(profile['DeveloperCertificates']) == 1, 'Expected one approved certificate'
out.joinpath('profile-certificate.cer').write_bytes(profile['DeveloperCertificates'][0])
out.joinpath('team').write_text(team)
out.joinpath('uuid').write_text(uuid)
options = {'method': 'app-store-connect', 'destination': 'export', 'signingStyle': 'manual',
           'teamID': team, 'signingCertificate': 'Apple Distribution',
           'provisioningProfiles': {'com.tenaceiq.app': uuid}, 'manageAppVersionAndBuildNumber': False,
           'uploadSymbols': True}
out.joinpath('export.plist').write_bytes(plistlib.dumps(options))
print('Validated distribution profile and generated manual export settings.')
