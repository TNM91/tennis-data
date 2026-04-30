const CAPTURE_STORAGE_KEY = 'TENACEIQ_LAST_CAPTURE';
const CAPTURE_HISTORY_KEY = 'TENACEIQ_RECENT_CAPTURES';
const IMPORT_URL_STORAGE_KEY = 'TENACEIQ_IMPORT_URL';
const DEFAULT_IMPORT_URL = 'https://tenaceiq.com/admin/import';
const MAX_CAPTURE_HISTORY = 8;

const captureBtn = document.getElementById('captureBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const openImportBtn = document.getElementById('openImportBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const recentMetaEl = document.getElementById('recentMeta');
const reviewBadgeEl = document.getElementById('reviewBadge');
const importUrlInput = document.getElementById('importUrl');

let lastCaptureRecord = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function cleanText(value) {
  return String(value || '').trim();
}

function inferImportKind(payload) {
  const pageType = cleanText(payload?.pageType).toLowerCase();
  if (pageType.includes('team_summary') || payload?.teamSummary) return 'team_summary';
  if (pageType.includes('scorecard') || payload?.scorecard) return 'scorecard';
  return 'schedule';
}

function toAutoImportPageType(kind) {
  if (kind === 'schedule') return 'season_schedule';
  return kind;
}

function buildFilename(payload) {
  const pageType = (payload.pageType || 'page').replace(/[^\w-]/g, '_');
  const titleSeed =
    payload.scorecard?.matchId ||
    payload.scorecard?.homeTeam ||
    payload.seasonSchedule?.leagueName ||
    payload.title ||
    'capture';
  const safeTitle = cleanText(titleSeed)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `tenaceiq_capture_${pageType}_${safeTitle || 'capture'}_${timestamp}.json`;
}

function buildSummary(payload) {
  const scorecard = payload?.scorecard || null;
  const scheduleMatches = Array.isArray(payload?.seasonSchedule?.matches)
    ? payload.seasonSchedule.matches.length
    : 0;
  const scorecardLines = Array.isArray(scorecard?.lines) ? scorecard.lines.length : 0;
  const needsReview = Boolean(scorecard?.needsReview);
  const dataConflict = Boolean(scorecard?.dataConflict);
  const quality = typeof scorecard?.captureEngine?.captureQuality === 'number'
    ? scorecard.captureEngine.captureQuality
    : null;
  const captureMethod = scorecard?.captureMethod || null;
  const cacheHit = scorecard?.scheduleCache?.found === true;

  return [
    `Page type: ${payload?.pageType || 'unknown'}`,
    `League: ${payload?.seasonSchedule?.leagueName || scorecard?.leagueName || 'not found'}`,
    `Flight: ${payload?.seasonSchedule?.flight || scorecard?.flight || 'not found'}`,
    `Schedule matches: ${scheduleMatches}`,
    `Scorecard lines: ${scorecardLines}`,
    `Needs review: ${needsReview ? 'yes' : 'no'}`,
    `Data conflict: ${dataConflict ? 'yes' : 'no'}`,
    `Capture quality: ${quality === null ? 'n/a' : quality}`,
    ...(captureMethod ? [`Capture method: ${captureMethod}`] : []),
    ...(cacheHit ? [`Schedule cache: hit — teams verified from schedule`] : []),
  ].join('\n');
}

function getReviewBadge(payload) {
  const scorecard = payload?.scorecard || null;
  if (!scorecard) return 'No review status';
  if (scorecard.needsReview) return scorecard.dataConflict ? 'Needs review: conflict' : 'Needs review';
  if (scorecard.captureEngine?.captureQuality != null) return `Capture quality ${scorecard.captureEngine.captureQuality}`;
  return 'Review-safe capture';
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) throw new Error('No active tab found.');
  return tabs[0];
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content_script.js']
  });
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

async function downloadCapture(payload, filename, saveAs = true) {
  const response = await chrome.runtime.sendMessage({
    type: 'TENACEIQ_DOWNLOAD_CAPTURE',
    payload,
    filename,
    saveAs
  });

  if (!response || !response.ok) {
    throw new Error(response?.error || 'Download failed.');
  }

  return response.downloadId;
}

async function copyPayloadToClipboard(payload) {
  const json = JSON.stringify(payload, null, 2);
  await navigator.clipboard.writeText(json);
}

async function openOrReuseImportTab(targetUrl, softPayload) {
  const importTabPattern = DEFAULT_IMPORT_URL + '*';
  let importTabs = [];
  try {
    importTabs = await chrome.tabs.query({ url: importTabPattern });
  } catch {
    // tabs permission may not be available in all contexts
  }

  const reusableTab = importTabs.find((tab) => typeof tab.id === 'number');

  if (reusableTab?.id) {
    // Soft-import: dispatch a custom event into the existing page so it handles
    // the new capture without a full page reload (preserves any in-progress review).
    if (softPayload) {
      let injected = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: reusableTab.id },
            world: 'MAIN',
            func: (eventDetail) => {
              window.dispatchEvent(new CustomEvent('TENACEIQ_SOFT_IMPORT', { detail: eventDetail }));
            },
            args: [softPayload],
          });
          injected = true;
          break;
        } catch (err) {
          console.warn(`[TenAceIQ] soft import inject attempt ${attempt + 1} failed:`, err);
          if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (injected) {
        await chrome.tabs.update(reusableTab.id, { active: true });
        if (typeof reusableTab.windowId === 'number') {
          await chrome.windows.update(reusableTab.windowId, { focused: true });
        }
        return reusableTab;
      }

      // Soft inject failed both attempts — navigate without reloading by keeping
      // the existing URL and only surfacing the tab, so the user doesn't lose state.
      console.warn('[TenAceIQ] soft import failed; surfacing tab without navigation');
      await chrome.tabs.update(reusableTab.id, { active: true });
      if (typeof reusableTab.windowId === 'number') {
        await chrome.windows.update(reusableTab.windowId, { focused: true });
      }
      return reusableTab;
    }
    await chrome.tabs.update(reusableTab.id, { url: targetUrl, active: true });
    if (typeof reusableTab.windowId === 'number') {
      await chrome.windows.update(reusableTab.windowId, { focused: true });
    }
    return reusableTab;
  }

  return chrome.tabs.create({ url: targetUrl });
}
function buildImportUrl(baseUrl, payload) {
  const kind = inferImportKind(payload);
  const nextUrl = new URL(baseUrl || DEFAULT_IMPORT_URL);
  nextUrl.searchParams.set('kind', kind);
  nextUrl.searchParams.set('source', 'edge-extension');
  nextUrl.searchParams.set('autopaste', '1');

  if (kind === 'scorecard') {
    nextUrl.searchParams.set('autopreview', '1');
    nextUrl.searchParams.set('autocommit', 'clean_safe');
    nextUrl.searchParams.set('focus', 'unresolved');
  } else {
    nextUrl.searchParams.set('autocommit', 'all');
    nextUrl.searchParams.set('focus', 'all');
  }

  const leagueOverride =
    payload?.scorecard?.leagueName ||
    payload?.seasonSchedule?.leagueName ||
    payload?.teamSummary?.leagueName ||
    '';

  if (leagueOverride) {
    nextUrl.searchParams.set('leagueOverride', leagueOverride);
  }

  return nextUrl.toString();
}

function buildAutoImportUrl(baseUrl) {
  const adminUrl = new URL(baseUrl || DEFAULT_IMPORT_URL);
  return `${adminUrl.origin}/api/import/auto`;
}

async function sendAutoImport(baseUrl, payload) {
  const kind = inferImportKind(payload);
  const response = await fetch(buildAutoImportUrl(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pageType: toAutoImportPageType(kind),
      payload,
    }),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Keep the HTTP status as the useful failure signal.
  }

  if (!response.ok && !body?.status) {
    throw new Error(`Auto import request failed (${response.status})`);
  }

  return body || {
    status: response.ok ? 'imported' : 'failed',
    message: response.ok ? 'Imported' : `Import failed (${response.status})`,
  };
}

async function loadSettings() {
  const result = await storageGet([CAPTURE_STORAGE_KEY, CAPTURE_HISTORY_KEY, IMPORT_URL_STORAGE_KEY]);
  lastCaptureRecord = result?.[CAPTURE_STORAGE_KEY] || null;
  const savedImportUrl = cleanText(result?.[IMPORT_URL_STORAGE_KEY]);
  const resolvedImportUrl = !savedImportUrl || savedImportUrl.includes('localhost:3000') ? DEFAULT_IMPORT_URL : savedImportUrl;
  importUrlInput.value = resolvedImportUrl;
  if (resolvedImportUrl !== savedImportUrl) {
    await storageSet({ [IMPORT_URL_STORAGE_KEY]: resolvedImportUrl });
  }
  renderRecentCapture();
}

function renderRecentCapture() {
  if (!lastCaptureRecord?.payload) {
    recentMetaEl.textContent = 'No recent capture stored yet.';
    reviewBadgeEl.textContent = 'Ready';
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
    openImportBtn.disabled = true;
    clearBtn.disabled = true;
    return;
  }

  const payload = lastCaptureRecord.payload;
  const capturedAt = cleanText(lastCaptureRecord.capturedAt);
  const importKind = inferImportKind(payload);
  const capturedLabel = capturedAt ? new Date(capturedAt).toLocaleString() : 'Unknown time';
  recentMetaEl.textContent = [
    `Last capture: ${capturedLabel}`,
    `Import mode: ${importKind}`,
    buildSummary(payload)
  ].join('\n');
  reviewBadgeEl.textContent = getReviewBadge(payload);
  copyBtn.disabled = false;
  downloadBtn.disabled = false;
  openImportBtn.disabled = false;
  clearBtn.disabled = false;
}

async function persistCapture(payload, filename) {
  const capturedAt = new Date().toISOString();
  const record = { payload, filename, capturedAt };
  const existing = await storageGet([CAPTURE_HISTORY_KEY]);
  const history = Array.isArray(existing?.[CAPTURE_HISTORY_KEY]) ? existing[CAPTURE_HISTORY_KEY] : [];
  const nextHistory = [record, ...history].slice(0, MAX_CAPTURE_HISTORY);

  await storageSet({
    [CAPTURE_STORAGE_KEY]: record,
    [CAPTURE_HISTORY_KEY]: nextHistory,
  });

  lastCaptureRecord = record;
  renderRecentCapture();
}

captureBtn.addEventListener('click', async () => {
  captureBtn.disabled = true;
  setStatus('Capturing structured data...');

  try {
    const tab = await getActiveTab();
    if (!tab.id) throw new Error('Active tab does not have an id.');
    if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
      throw new Error('Open a normal website page before capturing.');
    }

    await ensureContentScript(tab.id);

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'TENACEIQ_CAPTURE_PAGE'
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || 'No capture response received.');
    }

    const payload = response.payload;
    const filename = buildFilename(payload);

    await persistCapture(payload, filename);

    const baseUrl = cleanText(importUrlInput.value) || DEFAULT_IMPORT_URL;
    await storageSet({ [IMPORT_URL_STORAGE_KEY]: baseUrl });
    const kind = inferImportKind(payload);
    await copyPayloadToClipboard(payload);

    let autoResult = null;
    try {
      autoResult = await sendAutoImport(baseUrl, payload);
    } catch (autoError) {
      const targetUrl = buildImportUrl(baseUrl, payload);
      const softPayload = {
        payload,
        kind,
        autoPreview: true,
        autoCommitMode: kind === 'scorecard' ? 'clean_only' : 'all',
        source: 'edge-extension',
      };
      await openOrReuseImportTab(targetUrl, softPayload);
      setStatus(`Capture complete, but direct auto import was unavailable: ${autoError.message}\n\nOpened the import center fallback.\n\nSaved as:\n${filename}\n\n${buildSummary(payload)}`);
      return;
    }

    if (autoResult.status === 'needs_review') {
      const targetUrl = buildImportUrl(baseUrl, payload);
      const softPayload = {
        payload,
        kind,
        autoPreview: true,
        autoCommitMode: kind === 'scorecard' ? 'clean_only' : 'all',
        source: 'edge-extension',
      };
      await openOrReuseImportTab(targetUrl, softPayload);
    }

    const isError = autoResult.status === 'failed';
    setStatus(`${autoResult.message || 'Import complete'}\n\nSaved as:\n${filename}\n\n${buildSummary(payload)}`, isError);
  } catch (error) {
    console.error('TenAceIQ popup capture error:', error);
    setStatus(`Error: ${error.message}`, true);
  } finally {
    captureBtn.disabled = false;
  }
});

copyBtn.addEventListener('click', async () => {
  if (!lastCaptureRecord?.payload) return;
  try {
    await copyPayloadToClipboard(lastCaptureRecord.payload);
    setStatus(`Copied latest capture to clipboard.\n\n${buildSummary(lastCaptureRecord.payload)}`);
  } catch (error) {
    setStatus(`Clipboard copy failed: ${error.message}`, true);
  }
});

downloadBtn.addEventListener('click', async () => {
  if (!lastCaptureRecord?.payload) return;
  try {
    await downloadCapture(lastCaptureRecord.payload, lastCaptureRecord.filename || buildFilename(lastCaptureRecord.payload), true);
    setStatus(`Downloaded latest capture again.\n\n${buildSummary(lastCaptureRecord.payload)}`);
  } catch (error) {
    setStatus(`Download failed: ${error.message}`, true);
  }
});

openImportBtn.addEventListener('click', async () => {
  if (!lastCaptureRecord?.payload) return;
  try {
    const baseUrl = cleanText(importUrlInput.value) || DEFAULT_IMPORT_URL;
    await storageSet({ [IMPORT_URL_STORAGE_KEY]: baseUrl });
    await copyPayloadToClipboard(lastCaptureRecord.payload);
    const targetUrl = buildImportUrl(baseUrl, lastCaptureRecord.payload);
    const kind = inferImportKind(lastCaptureRecord.payload);
    const softPayload = {
      payload: lastCaptureRecord.payload,
      kind,
      autoPreview: true,
      autoCommitMode: kind === 'scorecard' ? 'clean_only' : 'all',
      source: 'edge-extension',
    };
    await openOrReuseImportTab(targetUrl, softPayload);
    setStatus(`Opened the import center, copied the latest capture, and requested automatic handoff into preview. Clean items will move through automatically, and unresolved scorecards will land in focused review.`);
  } catch (error) {
    setStatus(`Open import failed: ${error.message}`, true);
  }
});

clearBtn.addEventListener('click', async () => {
  lastCaptureRecord = null;
  await storageSet({
    [CAPTURE_STORAGE_KEY]: null,
    [CAPTURE_HISTORY_KEY]: [],
  });
  renderRecentCapture();
  setStatus('Cleared the stored recent capture.');
});

importUrlInput.addEventListener('change', async () => {
  const value = cleanText(importUrlInput.value) || DEFAULT_IMPORT_URL;
  importUrlInput.value = value;
  await storageSet({ [IMPORT_URL_STORAGE_KEY]: value });
});

loadSettings().catch((error) => {
  console.error('Failed to load popup state:', error);
  setStatus(`Popup setup failed: ${error.message}`, true);
});











