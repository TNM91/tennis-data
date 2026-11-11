import plistlib
import sys
with open(sys.argv[1], 'rb') as source:
    info = plistlib.load(source)
for key in ('NSFaceIDUsageDescription', 'NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription'):
    if not isinstance(info.get(key), str) or not info[key].strip():
        raise SystemExit('Missing top-level Face ID/camera/photo purpose string: ' + key)
print('Top-level Face ID/camera/photo purpose strings verified.')
if '--first-party-full' in sys.argv:
    purpose = info.get('NSLocationWhenInUseUsageDescription')
    if not isinstance(purpose, str) or 'tennis courts' not in purpose or info.get('NSLocationDefaultAccuracyReduced') is not True:
        raise SystemExit('Missing approximate foreground location settings for nearby courts.')
    if any(key.startswith('NSLocationAlways') for key in info) or 'location' in info.get('UIBackgroundModes', []):
        raise SystemExit('Nearby courts must use foreground-only location.')
    print('Foreground-only approximate location verified.')
