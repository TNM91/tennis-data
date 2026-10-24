import plistlib
import sys
with open(sys.argv[1], 'rb') as source:
    info = plistlib.load(source)
for key in ('NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription'):
    if not isinstance(info.get(key), str) or not info[key].strip():
        raise SystemExit('Missing top-level camera/photo purpose string: ' + key)
print('Top-level camera/photo purpose strings verified.')
