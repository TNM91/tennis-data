import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

class UploadResponseTests(unittest.TestCase):
    def test_acceptance_and_rejections(self):
        with tempfile.TemporaryDirectory(prefix='tiq-upload-test-') as folder:
            path = pathlib.Path(folder) / 'response.json'
            cases = [({'success-message': "No errors uploading 'App.ipa'."}, True),
                     ({'product-errors': [{'message': 'Invalid large app icon'}]}, False),
                     ({'success-message': 'No errors uploading', 'product-errors': [{'message': 'Rejected'}]}, False),
                     ({'tool-version': '26.3'}, False)]
            for payload, accepted in cases:
                with self.subTest(payload=payload):
                    path.write_text(json.dumps(payload), encoding='utf-8')
                    result = subprocess.run([sys.executable, str(pathlib.Path(__file__).with_name('validate-altool-upload.py')), str(path)], capture_output=True)
                    self.assertEqual(result.returncode == 0, accepted)

if __name__ == '__main__':
    unittest.main()
