update storage.buckets
set allowed_mime_types = array[
  'application/vnd.ms-excel',
  'application/octet-stream',
  'text/html',
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'data-assist-screenshots';
