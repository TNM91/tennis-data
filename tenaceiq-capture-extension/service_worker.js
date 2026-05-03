chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'TENACEIQ_DOWNLOAD_CAPTURE') return;

  downloadCapture(message.payload, message.filename, message.saveAs)
    .then((downloadId) => sendResponse({ ok: true, downloadId }))
    .catch((error) => {
      console.error('TenAceIQ download failed:', error);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown download error'
      });
    });

  return true;
});

async function downloadCapture(payload, filename, saveAs = true) {
  const json = JSON.stringify(payload, null, 2);
  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);

  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: saveAs !== false
  });

  if (typeof downloadId !== 'number') {
    throw new Error('Chrome did not return a valid download id.');
  }

  return downloadId;
}
