"""altool may return exit code zero after an Apple validation rejection."""
import json
import sys

try:
    with open(sys.argv[1], encoding='utf-8') as response:
        payload = json.load(response)
    errors = payload.get('product-errors') or []
    if errors:
        raise ValueError('Apple rejected the upload: ' + str(errors[0].get('message', 'validation failed')))
    message = str(payload.get('success-message', '')).lower()
    if 'no errors uploading' not in message and 'upload succeeded' not in message:
        raise ValueError('Apple upload acceptance was not confirmed in the structured response.')
except (OSError, ValueError, TypeError, AttributeError) as error:
    print(str(error), file=sys.stderr)
    sys.exit(1)
print('Apple confirmed upload acceptance. Processing and TestFlight availability still require verification.')
