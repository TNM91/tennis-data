// FINAL content_script.js — FULL replacement with BOTH season_schedule + scorecard support
// Preserves the working season schedule parser and strengthens TennisLink scorecard parsing
// without changing the synchronous capture message flow.

(() => {
  'use strict';

  if (window.__TENACEIQ_CAPTURE_LISTENER__) return;
  window.__TENACEIQ_CAPTURE_LISTENER__ = true;

  const DEBUG = false;
  const SCHEDULE_CACHE_KEY = 'TENACEIQ_SCHEDULE_MATCH_CACHE';
  const SCHEDULE_CACHE_MAX_ENTRIES = 200;

  // Order matters: longer (more specific) strings must come before shorter ones
  // that are substrings of them (e.g. "Missouri Athletic Club - West" before
  // "Missouri Athletic Club") so the first match wins correctly.
  const KNOWN_FACILITIES = [
    'Forest Lake Tennis Club',
    'St. Clair Tennis Club',
    'Missouri Athletic Club - West',
    'Vetta Sports Club - Concord',
    'Chesterfield Athletic Club',
    'Sunset Tennis Center',
    'Woodsmill Tennis Club',
    'Missouri Athletic Club',
    'Vetta Sports Club',
    'Vetta West',
    'Vetta Sports',
    'Forest Lake',
    'St. Clair',
    'Vetta',
    'Sunset',
    'Chesterfield',
  ];

  function log(...args) {
    if (DEBUG) {
      console.log('[TenAceIQ content_script]', ...args);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'TENACEIQ_CAPTURE_PAGE') return;

    capturePageAsync()
      .then((payload) => {
        persistHelpfulCache(payload);
        sendResponse({ ok: true, payload });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown capture error',
        });
      });

    return true; // keep message channel open for async response
  });

  async function capturePageAsync() {
    const text = document.body?.innerText || '';
    const pageType = detectPageType(text);

    if (pageType === 'team_summary') {
      return { pageType: 'team_summary', teamSummary: extractTeamSummary() };
    }

    if (pageType !== 'scorecard') {
      const seasonSchedule = extractSeasonSchedule(text);
      const leagueMeta = extractLeagueMetadata(text);
      return { pageType: 'season_schedule', seasonSchedule: { ...leagueMeta, ...seasonSchedule } };
    }

    // Scorecards: look up the schedule cache BEFORE extracting so cached team
    // names are injected as the highest-priority source, not a last-resort fallback.
    const urlMatchId = extractMatchIdFromHref(window.location.href);
    const cachedScheduleEntry = await loadScheduleCacheEntry(urlMatchId);

    const scorecard = extractScorecard(cachedScheduleEntry);
    const enrichedScorecard = attachScheduleCacheMeta(scorecard, cachedScheduleEntry);

    return { pageType: 'scorecard', scorecard: enrichedScorecard };
  }

  async function loadScheduleCacheEntry(matchId) {
    const id = String(matchId || '').trim();
    if (!id || !chrome?.storage?.local?.get) return null;

    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get([SCHEDULE_CACHE_KEY], resolve);
      });
      const cache = result?.[SCHEDULE_CACHE_KEY];
      if (!cache || typeof cache !== 'object') return null;
      return cache[id] || null;
    } catch (err) {
      log('schedule cache load failed', err);
      return null;
    }
  }

  function attachScheduleCacheMeta(scorecard, cached) {
    if (!cached) return scorecard;

    const sc = { ...scorecard };

    // Attach cache provenance so the import pipeline can show it.
    sc.scheduleCache = {
      found: true,
      matchId: cached.matchId || sc.matchId || null,
      homeTeam: cached.homeTeam || null,
      awayTeam: cached.awayTeam || null,
      facility: cached.facility || null,
      scheduleDate: cached.scheduleDate || null,
      scheduleTime: cached.scheduleTime || null,
    };

    // Surface the cache hit in the diagnostics visible in the review panel.
    if (sc.captureEngine && Array.isArray(sc.captureEngine.diagnostics)) {
      const teamNote =
        `schedule cache hit — home: ${cached.homeTeam || '?'}, away: ${cached.awayTeam || '?'}`;
      sc.captureEngine = {
        ...sc.captureEngine,
        diagnostics: [...sc.captureEngine.diagnostics, teamNote],
      };
    }

    return sc;
  }

  function capturePage() {
    const text = document.body?.innerText || '';
    const pageType = detectPageType(text);

    if (pageType === 'team_summary') {
      return {
        pageType: 'team_summary',
        teamSummary: extractTeamSummary(),
      };
    }

    if (pageType === 'scorecard') {
      return {
        pageType: 'scorecard',
        scorecard: extractScorecard(),
      };
    }

    const seasonSchedule = extractSeasonSchedule(text);
    const leagueMeta = extractLeagueMetadata(text);

    return {
      pageType: 'season_schedule',
      seasonSchedule: {
        ...leagueMeta,
        ...seasonSchedule,
      },
    };
  }

  function persistHelpfulCache(payload) {
    try {
      if (!payload || payload.pageType !== 'season_schedule') return;
      const matches = payload.seasonSchedule?.matches;
      if (!Array.isArray(matches) || !matches.length) return;
      if (!chrome?.storage?.local?.get || !chrome?.storage?.local?.set) return;

      chrome.storage.local.get([SCHEDULE_CACHE_KEY], (result) => {
        const existing =
          result?.[SCHEDULE_CACHE_KEY] && typeof result[SCHEDULE_CACHE_KEY] === 'object'
            ? result[SCHEDULE_CACHE_KEY]
            : {};

        const next = { ...existing };

        for (const match of matches) {
          if (!match?.matchId) continue;
          next[String(match.matchId)] = {
            matchId: match.matchId || null,
            scheduleDate: match.scheduleDate || null,
            homeTeam: match.homeTeam || null,
            awayTeam: match.awayTeam || null,
            facility: match.facility || null,
            scheduleTime: match.scheduleTime || null,
            scheduleTimeDisplay: match.scheduleTimeDisplay || null,
          };
        }

        // Prune oldest entries (insertion-order) to stay under the size cap
        const allKeys = Object.keys(next);
        if (allKeys.length > SCHEDULE_CACHE_MAX_ENTRIES) {
          for (const key of allKeys.slice(0, allKeys.length - SCHEDULE_CACHE_MAX_ENTRIES)) {
            delete next[key];
          }
        }

        chrome.storage.local.set({ [SCHEDULE_CACHE_KEY]: next });
      });
    } catch (error) {
      log('cache persist failed', error);
    }
  }

  function detectPageType(text) {
    const bodyText = String(text || '');
    const normalized = bodyText.toLowerCase();
    const url = String(window.location.href || '').toLowerCase();

    const teamSummarySignals = [
      normalized.includes('team summary'),
      normalized.includes('team standings'),
      normalized.includes('players'),
      normalized.includes('wins'),
      normalized.includes('losses'),
      url.includes('teamsummary'),
    ].filter(Boolean).length;

    if (teamSummarySignals >= 3) return 'team_summary';

    const scorecardSignals = [
      url.includes('scorecard'),
      url.includes('printscorecard'),
      normalized.includes('home team') && normalized.includes('visiting team'),
      normalized.includes('date match played'),
      normalized.includes('entry date'),
      normalized.includes('3rd set tie-break'),
      normalized.includes('vs.'),
      normalized.includes('completed'),
      /\b\d+\s*#\s*singles\b/i.test(bodyText),
      /\b\d+\s*#\s*doubles\b/i.test(bodyText),
    ].filter(Boolean).length;

    if (scorecardSignals >= 2) return 'scorecard';

    const scheduleSignals = [
      url.includes('statsandstandings'),
      url.includes('schedule'),
      normalized.includes('season schedule'),
      normalized.includes('team schedule'),
      normalized.includes('match date'),
      /\b\d{10}\b/.test(bodyText),
    ].filter(Boolean).length;

    if (scheduleSignals >= 1) return 'season_schedule';

    return 'season_schedule';
  }

  function normalizeWhitespace(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lower(value) {
    return normalizeWhitespace(value).toLowerCase();
  }

  function textOf(node) {
    return normalizeWhitespace(node ? node.textContent || '' : '');
  }

  function innerTextOf(node) {
    return normalizeWhitespace(node ? node.innerText || node.textContent || '' : '');
  }

  function toNumber(value) {
    if (value === null || value === undefined) return null;
    const match = String(value).match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function firstTruthy(...values) {
    for (const value of values) {
      if (value) return value;
    }
    return null;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getTables() {
    return Array.from(document.querySelectorAll('table'));
  }

  function getRows(table) {
    return Array.from(table.querySelectorAll('tr'));
  }

  function getCells(row) {
    return Array.from(row.querySelectorAll('th, td'));
  }

  function rowTexts(row) {
    return getCells(row).map((cell) => textOf(cell));
  }

  function getPageLines() {
    const text = document.body?.innerText || '';
    return text
      .split(/\n+/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);
  }

  function normalizeDate(v) {
    const value = normalizeWhitespace(v);
    const parts = value.split(/[/-]/);
    if (parts.length !== 3) return value || null;

    let [m, d, y] = parts;

    if (String(y).length === 2) {
      y = Number(y) >= 70 ? `19${y}` : `20${y}`;
    }

    return `${String(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function normalizeTime(v) {
    const m = String(v || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return v;

    let h = parseInt(m[1], 10);
    const mins = m[2];
    const meridiem = m[3].toUpperCase();

    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;

    return `${String(h).padStart(2, '0')}:${mins}`;
  }

  function normalizeTeamName(value) {
    return String(value || '')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isPhone(v) {
    return /^\d{3}-\d{3}-\d{4}$/.test(String(v || '').trim());
  }

  function isDate(v) {
    return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(v || '').trim());
  }

  function isTimeLike(v) {
    return /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(normalizeWhitespace(v));
  }

  function isLineLabel(v) {
    return /^\d+\s*#\s*(singles|doubles)\b/i.test(normalizeWhitespace(v));
  }

  function removeFooter(text) {
    const stopWords = ['Learn More', 'USTA', '©'];

    let out = String(text || '');
    for (const word of stopWords) {
      if (out.includes(word)) {
        out = out.split(word)[0].trim();
      }
    }

    return out.trim();
  }

  function smartSplit(text) {
    const cleaned = removeFooter(text);

    for (const facility of KNOWN_FACILITIES) {
      if (cleaned.includes(facility)) {
        return {
          team: cleaned.replace(facility, '').trim(),
          facility,
        };
      }
    }

    return {
      team: cleaned.trim(),
      facility: '',
    };
  }

  function parseScheduleTeamsAndFacility(joined, homeCaptains = [], awayCaptains = []) {
    const cleanedJoined = removeFooter(joined || '');

    if (!cleanedJoined) {
      return {
        homeTeam: '',
        awayTeam: '',
        facility: '',
      };
    }

    let working = cleanedJoined;
    let facility = '';

    for (const candidate of KNOWN_FACILITIES) {
      if (working.includes(candidate)) {
        facility = candidate;
        working = working.replace(candidate, ' ').replace(/\s+/g, ' ').trim();
        break;
      }
    }

    const splitOnFlag = working
      .split(/\(\s*F\s*\)/i)
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean);

    if (splitOnFlag.length >= 2) {
      return {
        homeTeam: normalizeTeamName(splitOnFlag[0]),
        awayTeam: normalizeTeamName(splitOnFlag.slice(1).join(' ')),
        facility: normalizeWhitespace(facility),
      };
    }

    const homeCaptainLastNames = homeCaptains
      .map((captain) => normalizeWhitespace(captain?.name || '').split(' ').pop())
      .filter(Boolean);

    const awayCaptainLastNames = awayCaptains
      .map((captain) => normalizeWhitespace(captain?.name || '').split(' ').pop())
      .filter(Boolean);

    for (const lastName of awayCaptainLastNames) {
      const idx = working.indexOf(lastName);
      if (idx > 0) {
        const left = normalizeWhitespace(working.slice(0, idx));
        const right = normalizeWhitespace(working.slice(idx));

        if (left && right) {
          return {
            homeTeam: normalizeTeamName(left),
            awayTeam: normalizeTeamName(right),
            facility: normalizeWhitespace(facility),
          };
        }
      }
    }

    for (const lastName of homeCaptainLastNames) {
      const idx = working.indexOf(lastName);
      if (idx > 0) {
        const left = normalizeWhitespace(working.slice(0, idx));
        const right = normalizeWhitespace(working.slice(idx));

        if (left && right) {
          return {
            homeTeam: normalizeTeamName(left),
            awayTeam: normalizeTeamName(right),
            facility: normalizeWhitespace(facility),
          };
        }
      }
    }

    const knownTeamFragments = [
      'Meinert/The Other Guys',
      "Bad Bill's Badly Badgered Badgers",
      'Schlueter/Big',
      'Huchet/Ariston',
      'Hodge/Kammann',
      'Levin/Collop',
      'Hamilton',
      'William\'s Wily Wolverines',
      'Gontarz/Wild',
    ];

    for (const fragment of knownTeamFragments) {
      if (!working.includes(fragment)) continue;

      const start = working.indexOf(fragment);
      const after = normalizeWhitespace(working.slice(start + fragment.length));
      const before = normalizeWhitespace(working.slice(0, start));

      if (before && after) {
        return {
          homeTeam: normalizeTeamName(before),
          awayTeam: normalizeTeamName(`${fragment} ${after}`),
          facility: normalizeWhitespace(facility),
        };
      }

      if (!before && after) {
        const remainder = normalizeWhitespace(after);
        if (remainder) {
          return {
            homeTeam: normalizeTeamName(fragment),
            awayTeam: normalizeTeamName(remainder),
            facility: normalizeWhitespace(facility),
          };
        }
      }
    }

    const smart = smartSplit(working);
    working = smart.team;
    if (!facility && smart.facility) facility = smart.facility;

    const partsBySpacing = working
      .split(/\s{2,}/)
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean);

    if (partsBySpacing.length >= 2) {
      return {
        homeTeam: normalizeTeamName(partsBySpacing[0]),
        awayTeam: normalizeTeamName(partsBySpacing.slice(1).join(' ')),
        facility: normalizeWhitespace(facility),
      };
    }

    return {
      homeTeam: normalizeTeamName(working),
      awayTeam: '',
      facility: normalizeWhitespace(facility),
    };
  }

  function splitDoubleTeam(homeTeam) {
    const value = normalizeTeamName(homeTeam || '');
    if (!value) return null;

    if (value.includes('/')) return null;

    if (
      /the other guys/i.test(value) ||
      /wily wolverines/i.test(value) ||
      /badly badgered badgers/i.test(value)
    ) {
      return null;
    }

    const parts = value
      .split(/\s{2,}/)
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean);

    if (parts.length === 2) {
      return {
        home: parts[0],
        away: parts[1],
      };
    }

    return null;
  }

  function normalizeLineNumber(lineNumber, matchType) {
    const num = Number(lineNumber);
    if (!Number.isFinite(num)) return null;

    if (matchType === 'singles') {
      return num;
    }

    if (matchType === 'doubles') {
      return num + 2;
    }

    return num;
  }

  function repairBrokenScheduleTeams(homeTeam, awayTeam) {
    let home = normalizeTeamName(homeTeam || '');
    let away = normalizeTeamName(awayTeam || '');

    if (home.endsWith('/The') && away.startsWith('Other Guys')) {
      home = normalizeTeamName(`${home} Other Guys`);
      away = normalizeTeamName(away.replace(/^Other Guys\s*/, ''));
      return {
        homeTeam: home,
        awayTeam: away,
      };
    }

    if (home.endsWith('/') && away.startsWith('The Other Guys')) {
      home = normalizeTeamName(`${home}The Other Guys`);
      away = normalizeTeamName(away.replace(/^The Other Guys\s*/, ''));
      return {
        homeTeam: home,
        awayTeam: away,
      };
    }

    if (home === 'Gontarz/Wild' && away.startsWith("William's Wily Wolverines")) {
      home = normalizeTeamName(`${home} William's Wily Wolverines`);
      away = normalizeTeamName(
        away.replace(/^William's Wily Wolverines\s*/, '')
      );
      return {
        homeTeam: home,
        awayTeam: away,
      };
    }

    return {
      homeTeam: home,
      awayTeam: away,
    };
  }


  function normalizeSummaryLookupKey(value) {
    return normalizeTeamName(value || '').toLowerCase();
  }

  function looksLikeTeamStandingsTable(table) {
    const rows = getRows(table);
    if (rows.length < 2) return false;
    const preview = rows.slice(0, 8).map((row) => lower(rowTexts(row).join(' | '))).join(' || ');
    if (!preview.includes('team')) return false;
    if (!(preview.includes('wins') || preview.includes('w'))) return false;
    if (!(preview.includes('losses') || preview.includes('l'))) return false;
    // Require at least one data row with a purely numeric wins/losses value to
    // exclude navigation or footer tables that happen to contain the same keywords.
    const dataRows = rows.slice(1, Math.min(rows.length, 8));
    return dataRows.some((row) =>
      rowTexts(row).some((cell) => /^\d+$/.test(cell.trim()))
    );
  }

  function looksLikePlayersTable(table) {
    const rows = getRows(table);
    if (!rows.length) return false;
    const preview = rows.slice(0, 6).map((row) => lower(rowTexts(row).join(' | '))).join(' || ');
    const hasPlayerCol = preview.includes('player') || preview.includes('name');
    const hasRatingCol = preview.includes('ntrp') || preview.includes('rating') || preview.includes('level');
    return hasPlayerCol && hasRatingCol;
  }

  function dedupeTeamSummaryTeams(teams) {
    const seen = new Set();
    const results = [];
    for (const team of safeArray(teams)) {
      const name = cleanTeamName(team?.name);
      if (!name) continue;
      const key = normalizeSummaryLookupKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ name, wins: toNumber(team?.wins), losses: toNumber(team?.losses) });
    }
    return results;
  }

  function dedupeTeamSummaryPlayers(players) {
    const seen = new Set();
    const results = [];
    for (const player of safeArray(players)) {
      const name = normalizeWhitespace(player?.name || '');
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ name, ntrp: toNumber(player?.ntrp), teamName: cleanTeamName(player?.teamName || '') || null });
    }
    return results;
  }

  function extractTeamStandingsFromTables() {
    const results = [];
    for (const table of getTables()) {
      if (!looksLikeTeamStandingsTable(table)) continue;
      const rows = getRows(table);
      if (rows.length < 2) continue;
      const header = rowTexts(rows[0]).map((value) => lower(value));
      const teamIndex = header.findIndex((value) => value.includes('team'));
      const winsIndex = header.findIndex((value) => value === 'wins' || value === 'w' || value.includes('wins'));
      const lossesIndex = header.findIndex((value) => value === 'losses' || value === 'l' || value.includes('losses'));
      for (let i = 1; i < rows.length; i += 1) {
        const texts = rowTexts(rows[i]);
        const candidate = cleanTeamName(texts[teamIndex >= 0 ? teamIndex : 0]);
        if (!candidate) continue;
        results.push({
          name: candidate,
          wins: winsIndex >= 0 ? toNumber(texts[winsIndex]) : null,
          losses: lossesIndex >= 0 ? toNumber(texts[lossesIndex]) : null,
        });
      }
    }
    return dedupeTeamSummaryTeams(results);
  }

  function extractPlayersFromTables() {
    const results = [];
    for (const table of getTables()) {
      if (!looksLikePlayersTable(table)) continue;
      const rows = getRows(table);
      if (rows.length < 2) continue;
      // Find the actual column header row — TennisLink sometimes puts a spanning
      // "Players" section header above the real [Player Name | NTRP | ...] row.
      let headerRowIndex = 0;
      for (let ri = 0; ri < Math.min(rows.length, 5); ri += 1) {
        const rowPreview = lower(rowTexts(rows[ri]).join(' | '));
        if (
          (rowPreview.includes('player') || rowPreview.includes('name')) &&
          (rowPreview.includes('ntrp') || rowPreview.includes('rating') || rowPreview.includes('level'))
        ) {
          headerRowIndex = ri;
          break;
        }
      }

      const header = rowTexts(rows[headerRowIndex]).map((value) => lower(value));
      const teamIndex = header.findIndex((value) => value.includes('team'));

      // TennisLink renders players in a multi-column grid within a single table:
      //   [Player Name | NTRP | Player Name | NTRP | Player Name | NTRP]
      // Collect ALL [name, rating] column-index pairs so every group is extracted.
      const columnGroups = [];
      for (let h = 0; h < header.length; h += 1) {
        if (header[h].includes('player') || header[h].includes('name')) {
          const ratingCol = header.findIndex(
            (v, j) => j > h && (v.includes('ntrp') || v.includes('rating') || v.includes('level'))
          );
          columnGroups.push({ nameCol: h, ratingCol });
        }
      }
      // Fall back to a single group at column 0 when no labelled headers found.
      if (!columnGroups.length) {
        const ratingIndex = header.findIndex((v) => v.includes('ntrp') || v.includes('rating') || v.includes('level'));
        columnGroups.push({ nameCol: 0, ratingCol: ratingIndex });
      }

      for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
        const texts = rowTexts(rows[i]);
        for (const { nameCol, ratingCol } of columnGroups) {
          const name = normalizeWhitespace(texts[nameCol]);
          if (!name || looksLikePureLabel(name) || isFooterishLine(name)) continue;
          if (ratingCol >= 0 && !texts[ratingCol] && /\bplayers?\b|\bteam\b|\broster\b/i.test(name)) continue;
          results.push({
            name,
            ntrp: ratingCol >= 0 ? toNumber(texts[ratingCol]) : null,
            teamName: teamIndex >= 0 ? cleanTeamName(texts[teamIndex]) : null,
          });
        }
      }
    }
    return dedupeTeamSummaryPlayers(results);
  }

  function extractTeamSummary() {
    const text = document.body?.innerText || '';
    const leagueMeta = extractLeagueMetadata(text);
    const teams = extractTeamStandingsFromTables();
    const players = extractPlayersFromTables();
    const canonicalTeamMap = {};
    const playerRatingSeeds = {};

    for (const team of teams) {
      if (!team?.name) continue;
      canonicalTeamMap[normalizeSummaryLookupKey(team.name)] = team.name;
    }

    for (const player of players) {
      if (!player?.name) continue;
      const rating = toNumber(player?.ntrp);
      if (rating !== null) playerRatingSeeds[player.name] = rating;
    }

    return {
      ...leagueMeta,
      teams,
      players,
      canonicalTeamMap,
      playerRatingSeeds,
      source: 'tennislink_team_summary',
    };
  }

  function extractLeagueMetadata(text) {
    const pageText = String(text || '');
    const full = pageText.replace(/\s+/g, ' ');
    const lines = getPageLines();
    const titleSelectors = ['h1', 'h2', 'h3', '.pageTitle', '.pagetitle', '.title', '.PageTitle', '.ContentTitle'];

    const titleTexts = [];
    for (const selector of titleSelectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        const value = innerTextOf(node);
        if (value) titleTexts.push(value);
      }
    }

    const candidates = [...titleTexts, ...lines, full];

    const leagueNamePattern = /\b(20\d{2}\s+(?:Adult|Mixed|Combo|Tri-Level)[^|•\n]{0,80}?\b(?:Spring|Summer|Fall|Winter))\b/i;
    const altLeaguePattern = /\b(20\d{2}\s+[^|•\n]{0,120}?\b(?:Spring|Summer|Fall|Winter))\b/i;
    const flightPattern = /\b((?:Men|Women|Mixed|Tri-Level|Combo)\s+\d\.\d(?:\/\d\.\d)?)\b/i;
    const sectionPattern = /\b(USTA\/[A-Z ]+(?:VALLEY|SOUTHERN|MIDWEST|EASTERN|TEXAS|FLORIDA|CARIBBEAN|NEW ENGLAND|PACIFIC NORTHWEST|NORTHERN|INTERMOUNTAIN|HAWAII|MIDDLE STATES))\b/i;
    const districtPattern = /\b([A-Z][A-Za-z.\- ]+ - [A-Za-z.\- ]+ Local Leagues)\b/;

    let leagueName = null;
    let flight = null;
    let ustaSection = null;
    let districtArea = null;

    for (const candidate of candidates) {
      if (!leagueName) {
        const match = String(candidate).match(leagueNamePattern) || String(candidate).match(altLeaguePattern);
        if (match) leagueName = normalizeWhitespace(match[1]);
      }
      if (!flight) {
        const match = String(candidate).match(flightPattern);
        if (match) flight = normalizeWhitespace(match[1]);
      }
      if (!ustaSection) {
        const match = String(candidate).match(sectionPattern);
        if (match) ustaSection = normalizeWhitespace(match[1]);
      }
      if (!districtArea) {
        const match = String(candidate).match(districtPattern);
        if (match) districtArea = normalizeWhitespace(match[1]);
      }
    }

    return {
      leagueName,
      flight,
      ustaSection,
      districtArea,
    };
  }

  // =========================================================
  // PRESERVED SEASON SCHEDULE PARSER
  // =========================================================

  function extractSeasonSchedule(text) {
    const matches = [];
    const regex = /(\d{10})\n([\s\S]*?)(?=\n\d{10}\n|$)/g;

    let m;

    while ((m = regex.exec(text)) !== null) {
      const matchId = m[1];

      let tokens = String(m[2] || '')
        .replace(/\(S\)/g, '')
        .split(/\s+/)
        .filter(Boolean);

      if (tokens.length < 5) continue;

      const date = tokens.shift();
      if (!isDate(date)) continue;

      const timeToken1 = tokens.shift();
      const timeToken2 = tokens.shift();
      if (!timeToken1 || !timeToken2) continue;

      const timeParts = `${timeToken1} ${timeToken2}`;
      const scheduleTimeDisplay = timeParts;
      const scheduleTime = normalizeTime(timeParts);
      const scheduleDate = normalizeDate(date);

      const people = [];
      const textParts = [];

      for (let i = 0; i < tokens.length; i += 1) {
        if (i + 2 < tokens.length && isPhone(tokens[i + 2])) {
          people.push({
            name: `${tokens[i]} ${tokens[i + 1]}`,
            phone: tokens[i + 2],
          });
          i += 2;
        } else {
          textParts.push(tokens[i]);
        }
      }

      const mid = Math.floor(people.length / 2);
      const homeCaptains = people.slice(0, mid);
      const awayCaptains = people.slice(mid);

      let joined = textParts.join(' ');
      joined = removeFooter(joined);

      // When captain data is absent (phone numbers not visible), still try to parse
      // team names and facility from the raw text rather than skipping the match.
      if (people.length < 2) {
        const parsedTeams = parseScheduleTeamsAndFacility(joined, [], []);
        if (parsedTeams.homeTeam && parsedTeams.awayTeam) {
          let fac = parsedTeams.facility;
          const repairedTeams = repairBrokenScheduleTeams(parsedTeams.homeTeam, parsedTeams.awayTeam);
          const homeSplit = smartSplit(repairedTeams.homeTeam);
          const awaySplit = smartSplit(repairedTeams.awayTeam);
          let ht = repairedTeams.homeTeam;
          let at = repairedTeams.awayTeam;
          if (!fac && homeSplit.facility) { fac = homeSplit.facility; ht = homeSplit.team; }
          if (!fac && awaySplit.facility) { fac = awaySplit.facility; at = awaySplit.team; }
          matches.push({
            matchId,
            scheduleDate,
            scheduleTime,
            scheduleTimeDisplay,
            homeTeam: ht,
            homeCaptains: [],
            awayTeam: at,
            awayCaptains: [],
            facility: fac,
            scorecardKey: matchId,
          });
        }
        continue;
      }

      const parsedTeams = parseScheduleTeamsAndFacility(joined, homeCaptains, awayCaptains);
      let facility = parsedTeams.facility;


      const repairedTeams = repairBrokenScheduleTeams(parsedTeams.homeTeam, parsedTeams.awayTeam);

      const awaySplit = smartSplit(repairedTeams.awayTeam);
      let awayTeam = repairedTeams.awayTeam;
      if (!facility && awaySplit.facility) {
        facility = awaySplit.facility;
        awayTeam = awaySplit.team;
      }

      const homeSplit = smartSplit(repairedTeams.homeTeam);
      let homeTeam = repairedTeams.homeTeam;
      if (!facility && homeSplit.facility) {
        facility = homeSplit.facility;
        homeTeam = homeSplit.team;
      }

      matches.push({
        matchId,
        scheduleDate,
        scheduleTime,
        scheduleTimeDisplay,
        homeTeam: homeTeam,
        homeCaptains,
        awayTeam: awayTeam,
        awayCaptains,
        facility,
        scorecardKey: matchId,
      });
    }

    return { matches };
  }

  // =========================================================
  // SCORECARD PARSER
  // =========================================================

  function extractMatchIdFromHref(href) {
    if (!href) return null;

    const patterns = [
      /[?&](?:MatchID|matchid|matchId|MID|mid)=([^&#]+)/,
      /[?&](?:id|ID)=([^&#]+)/,
      /\/(\d{5,})\b/,
    ];

    for (const pattern of patterns) {
      const match = href.match(pattern);
      if (match) return decodeURIComponent(match[1]);
    }

    return null;
  }

  function extractAllMatchIdsFromPage() {
    const ids = [];
    const links = Array.from(document.querySelectorAll('a[href]'));

    for (const link of links) {
      const id = extractMatchIdFromHref(link.href);
      if (id) ids.push(id);
    }

    const currentUrlId = extractMatchIdFromHref(window.location.href);
    if (currentUrlId) ids.push(currentUrlId);

    const bodyText = document.body?.innerText || '';
    const bodyMatchIds = bodyText.match(/\b\d{9,10}\b/g) || [];
    ids.push(...bodyMatchIds);

    return unique(ids);
  }

  function parseDateFromValue(value) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) return null;

    const numericMatch = normalized.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/);
    if (numericMatch) return numericMatch[0];

    const monthNameMatch = normalized.match(
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/i
    );
    if (monthNameMatch) return monthNameMatch[0];

    return null;
  }

  function cleanTeamName(value) {
    let v = normalizeWhitespace(value);
    if (!v) return null;

    v = v
      .replace(/\s*\((?:home team|visiting team|away team)\)\s*/gi, ' ')
      .replace(/\s*\((?:s|h|v)\)\s*/gi, ' ')
      .replace(/\b3rd Set Tie-break\b/gi, '')
      .replace(/\bLeague Match\b/gi, '')
      .replace(/\bDate Scheduled\b.*$/i, '')
      .replace(/\bDate Match Played\b.*$/i, '')
      .replace(/\bEntry Date\b.*$/i, '')
      .replace(/\bIndividual Score\b.*$/i, '')
      .replace(/\bTOTAL TEAM SCORE\b.*$/i, '')
      .replace(/\*GAME WINNING %:.*$/i, '')
      .replace(/^Home Team:?/i, '')
      .replace(/^Visiting Team:?/i, '')
      .replace(/^Away Team:?/i, '')
      .replace(/^Team 1:?/i, '')
      .replace(/^Team 2:?/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!v) return null;
    if (isTimeLike(v)) return null;
    if (isLineLabel(v)) return null;

    const bannedExact = new Set([
      'league match',
      '3rd set tie-break',
      'home team',
      'visiting team',
      'away team',
      'date match played',
      'date scheduled',
      'entry date',
      'individual score',
      'winner',
      'position',
      'line',
      'set 1',
      'set 2',
      'set 3',
      'score',
      'team score',
      'vs',
      'vs.',
      'completed',
      'home',
      'away',
      'visiting',
      'learn more',
      'want to find more tennis?',
      'careers',
      'internships',
      'contact us',
      'terms of use',
      'usta connect portal',
      'api developer portal',
      'safe play disciplinary list',
      'sitemap',
      'umpire policy',
      'privacy policy',
      'find your account',
      'accessibility statement',
      'cookie policy',
      'usta apps',
    ]);

    if (bannedExact.has(v.toLowerCase())) return null;
    if (/^\d+([./-]\d+)*$/.test(v)) return null;
    if (/^\d+\s*#\s*(singles|doubles)\b/i.test(v)) return null;
    if (/^\d{1,2}:\d{2}\s*(am|pm)$/i.test(v)) return null;
    if (/\b\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(v)) return null;
    if (/usta\/|local leagues|adult 18 & over spring|district\/area|flight:/i.test(v)) return null;
    if (/^team id:/i.test(v)) return null;
    if (/^(men|women|mixed)\b/i.test(v) && /usta\//i.test(v)) return null;
    if (/^code\s+\d/i.test(v)) return null;
    if (/^©\s*\d{4}/i.test(v)) return null;
    if (isFooterishLine(v)) return null;

    return normalizeTeamName(v);
  }

  function looksLikePureLabel(value) {
    const v = lower(value);
    return [
      'home team',
      'visiting team',
      'away team',
      'date match played',
      'date scheduled',
      'entry date',
      'team score',
      'league match',
      '3rd set tie-break',
      'individual score',
      'position',
      'winner',
      'score',
      'vs',
      'vs.',
      'completed',
      'home',
      'away',
      'visiting',
      'total team score:',
      '*game winning %:',
    ].includes(v);
  }

  function isFooterishLine(value) {
    const v = lower(value);
    return (
      v === 'learn more' ||
      v === 'want to find more tennis?' ||
      v === 'careers' ||
      v === 'internships' ||
      v === 'contact us' ||
      v === 'terms of use' ||
      v === 'usta connect portal' ||
      v === 'api developer portal' ||
      v === 'safe play disciplinary list' ||
      v === 'sitemap' ||
      v === 'umpire policy' ||
      v === 'privacy policy' ||
      v === 'find your account' ||
      v === 'accessibility statement' ||
      v === 'cookie policy' ||
      v === 'usta apps' ||
      /^code\s+\d/i.test(v) ||
      /^©\s*\d{4}/i.test(v)
    );
  }

  function isIgnorableScorecardText(value) {
    const v = normalizeWhitespace(value);
    if (!v) return true;
    if (looksLikePureLabel(v)) return true;
    if (isTimeLike(v)) return true;
    if (isLineLabel(v)) return true;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) return true;
    if (/^team id:/i.test(v)) return true;
    if (/^completed$/i.test(v)) return true;
    if (isFooterishLine(v)) return true;
    return false;
  }

  function parseTeamNamesFromTitleArea() {
    const titleCandidates = [];

    const headingSelectors = [
      'h1',
      'h2',
      'h3',
      '.pageTitle',
      '.pagetitle',
      '.title',
      '.PageTitle',
      '.ContentTitle',
      'strong',
      'b',
    ];

    for (const selector of headingSelectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        const value = cleanTeamName(innerTextOf(node));
        if (value) titleCandidates.push(value);
      }
    }

    const pageLines = getPageLines().slice(0, 80);
    titleCandidates.push(...pageLines);

    for (const candidateRaw of titleCandidates) {
      const candidate = cleanTeamName(candidateRaw);
      if (!candidate) continue;
      if (isIgnorableScorecardText(candidate)) continue;

      const vsMatch = candidate.match(/^(.+?)\s+(?:vs\.?|v\.?)\s+(.+)$/i);
      if (vsMatch) {
        return {
          homeTeam: cleanTeamName(vsMatch[1]),
          awayTeam: cleanTeamName(vsMatch[2]),
        };
      }

      const dashMatch = candidate.match(/^(.+?)\s+[-–]\s+(.+)$/);
      if (dashMatch && !/\b\d+\s*[-–]\s*\d+\b/.test(candidate)) {
        return {
          homeTeam: cleanTeamName(dashMatch[1]),
          awayTeam: cleanTeamName(dashMatch[2]),
        };
      }
    }

    return {
      homeTeam: null,
      awayTeam: null,
    };
  }

  function cleanPlayerText(value) {
    let v = normalizeWhitespace(value);
    if (!v) return '';

    v = v
      .replace(/^\d{1,2}:\d{2}\s*(AM|PM)\s+/i, '')
      .replace(/\bCompleted\b/gi, '')
      .replace(/\s*\((?:home team|visiting team|away team)\)\s*/gi, ' ')
      .replace(/\s*\((?:s|h|v)\)\s*/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (isFooterishLine(v)) return '';
    if (isIgnorableScorecardText(v)) return '';
    if (looksLikePureLabel(v)) return '';
    if (isTimeLike(v)) return '';
    if (isLineLabel(v)) return '';
    if (/^total team score:?$/i.test(v)) return '';
    if (/^\*game winning %:?$/i.test(v)) return '';

    return v;
  }

  function splitPlayers(raw) {
    const rawText = String(raw || '');
    const value = normalizeWhitespace(rawText);
    if (!value) return [];

    const multiLine = rawText
      .split(/\n+/)
      .map((part) => cleanPlayerText(part))
      .filter(Boolean)
      .filter((part) => {
        // Drop this part only if it is purely a score token — i.e., it contains
        // set-pair numbers and has NO meaningful name-like content beyond score
        // keywords. A part like "6-3" is dropped; "Smith 6-3" is kept and the
        // score digits will be ignored by cleanPlayerText downstream.
        if (!extractSetPairsFromText(part).length) return true;
        const withoutScores = part.replace(/\b\d{1,2}\s*[-–]\s*\d{1,2}(?:\s*[\(\[]\d+[\)\]])?/g, '').replace(/\s+/g, ' ').trim();
        return Boolean(withoutScores) && /[A-Za-z]{2,}/.test(withoutScores);
      });

    if (multiLine.length > 1) {
      return multiLine;
    }

    const cleaned = cleanPlayerText(value);
    if (!cleaned) return [];

    const separators = [
      /\s*\/\s*/g,
      /\s*&\s*/g,
      /\s+and\s+/gi,
      /\s*;\s*/g,
    ];

    let parts = [cleaned];

    for (const separator of separators) {
      separator.lastIndex = 0;
      if (separator.test(cleaned)) {
        parts = cleaned.split(separator);
        break;
      }
    }

    return parts
      .map((part) => cleanPlayerText(part))
      .filter(Boolean);
  }

  function filterMeaningfulSets(sets) {
    const allSets = safeArray(sets).filter(Boolean);
    if (!allSets.length) return [];

    const nonZeroSets = allSets.filter((set) => {
      const h = toNumber(set.homeGames);
      const a = toNumber(set.awayGames);
      return h !== 0 || a !== 0;
    });

    const tinySets = nonZeroSets.filter((set) => {
      const h = toNumber(set.homeGames);
      const a = toNumber(set.awayGames);
      return (h === 1 && a === 0) || (h === 0 && a === 1);
    });

    const fullSets = nonZeroSets.filter((set) => {
      const h = toNumber(set.homeGames);
      const a = toNumber(set.awayGames);
      return !((h === 1 && a === 0) || (h === 0 && a === 1));
    });

    if (fullSets.length >= 2 && tinySets.length) {
      return [...fullSets, tinySets[0]];
    }

    return fullSets;
  }

  function normalizeScorePair(homeGames, awayGames, options = {}) {
    const home = toNumber(homeGames);
    const away = toNumber(awayGames);

    if (home === null || away === null) return null;

    return {
      homeGames: home,
      awayGames: away,
      ...(options.tiebreak !== undefined ? { tiebreak: options.tiebreak } : {}),
      ...(options.isMatchTiebreak ? { isMatchTiebreak: true } : {}),
      ...(options.isTimed ? { isTimed: true } : {}),
    };
  }

  function extractTiebreakValue(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) return null;

    const match = normalized.match(/\((\d{1,3})\)|\[(\d{1,3})\]|TB\s*(\d{1,3})|Tiebreak\s*(\d{1,3})/i);
    if (!match) return null;

    return Number(match[1] || match[2] || match[3] || match[4]);
  }

  function isTimedScoreText(text) {
    const normalized = lower(text);
    return (
      normalized.includes('timed') ||
      normalized.includes('time limit') ||
      normalized.includes('ad scoring') ||
      normalized.includes('pro set')
    );
  }

  function classifyScoreEventType(rawScoreText, sets) {
    const normalized = normalizeWhitespace(rawScoreText);
    const lowerScore = lower(normalized);

    const hasTimedMarker =
      isTimedScoreText(normalized) ||
      safeArray(sets).some((set) => Boolean(set?.isTimed));

    const hasThirdSetMatchTiebreakMarker =
      safeArray(sets).some((set) => Boolean(set?.isMatchTiebreak)) ||
      lowerScore.includes('3rd set tie-break') ||
      lowerScore.includes('third set tiebreak') ||
      lowerScore.includes('third set tie-break') ||
      lowerScore.includes('match tiebreak') ||
      lowerScore.includes('match tb');

    if (hasTimedMarker) return 'timed_match';
    if (hasThirdSetMatchTiebreakMarker) return 'third_set_match_tiebreak';
    return 'standard';
  }

  function collectCellScoreCandidates(cell) {
    if (!cell) return [];

    const htmlish = normalizeWhitespace(
      String(cell.innerHTML || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
    );

    const candidates = [
      textOf(cell),
      innerTextOf(cell),
      htmlish,
      normalizeWhitespace(cell.getAttribute?.('title') || ''),
      normalizeWhitespace(cell.getAttribute?.('aria-label') || ''),
      normalizeWhitespace(cell.getAttribute?.('data-original-title') || ''),
      normalizeWhitespace(cell.getAttribute?.('alt') || ''),
      normalizeWhitespace(cell.getAttribute?.('value') || ''),
    ].filter(Boolean);

    const descendants = Array.from(cell.querySelectorAll('*'));
    for (const node of descendants) {
      candidates.push(
        normalizeWhitespace(node.getAttribute?.('title') || ''),
        normalizeWhitespace(node.getAttribute?.('aria-label') || ''),
        normalizeWhitespace(node.getAttribute?.('alt') || ''),
        normalizeWhitespace(node.textContent || ''),
        normalizeWhitespace(
          String(node.innerHTML || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
        )
      );
    }

    return unique(candidates.filter(Boolean));
  }

  function extractSetPairsDeepFromNode(node) {
    if (!node) return [];

    const rawBlocks = [];
    if (node.innerText) rawBlocks.push(...String(node.innerText).split(/\n+/));
    if (node.textContent && node.textContent !== node.innerText) {
      rawBlocks.push(...String(node.textContent).split(/\n+/));
    }
    const rawHtml = String(node.innerHTML || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    rawBlocks.push(...rawHtml.split(/\n+/));

    // Deduplicate normalized blocks before processing to avoid scoring duplicate sets
    const blocks = unique(rawBlocks.map((b) => normalizeWhitespace(b)).filter(Boolean));

    const sets = [];
    for (const block of blocks) {
      const extracted = extractSetPairsFromText(block);
      for (const set of extracted) {
        sets.push(set);
      }
    }

    return filterMeaningfulSets(sets);
  }

  function extractSetPairsFromCellNode(cell) {
    const values = collectCellScoreCandidates(cell);
    const sets = [];

    for (const value of values) {
      const extracted = extractSetPairsFromText(value);
      for (const set of extracted) {
        sets.push(set);
      }
    }

    const deepSets = extractSetPairsDeepFromNode(cell);
    for (const set of deepSets) {
      sets.push(set);
    }

    return filterMeaningfulSets(sets);
  }

  function detectLockedSetColumnIndexes(headerMap, rowNode) {
    const explicit = ['set1', 'set2', 'set3']
      .map((key) => (typeof headerMap[key] === 'number' ? headerMap[key] : null))
      .filter((value) => value !== null);

    if (explicit.length >= 2) {
      return explicit.slice(0, 3);
    }

    if (!rowNode) return explicit;

    const rowCells = Array.from(rowNode.querySelectorAll('th, td'));
    const candidateIndexes = [];

    for (let i = 0; i < rowCells.length; i += 1) {
      const candidates = collectCellScoreCandidates(rowCells[i]);
      const joined = candidates.join(' | ');
      const extracted = extractSetPairsFromText(joined);
      if (extracted.length) {
        candidateIndexes.push(i);
      }
    }

    if (candidateIndexes.length >= 2) {
      return candidateIndexes.slice(-3);
    }

    return explicit;
  }

  function extractLockedSetPairsFromRow(rowNode, headerMap) {
    if (!rowNode) return [];

    const rowCells = Array.from(rowNode.querySelectorAll('th, td'));
    const lockedIndexes = detectLockedSetColumnIndexes(headerMap, rowNode);
    const sets = [];

    for (const index of lockedIndexes) {
      const cellNode = rowCells[index];
      if (!cellNode) continue;

      const fromCell = extractSetPairsFromCellNode(cellNode);
      if (fromCell.length) {
        sets.push(fromCell[0]);
        continue;
      }

      const raw = collectCellScoreCandidates(cellNode).join(' ').replace(/\s+/g, ' ').trim();
      const pair = raw.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
      if (pair) {
        sets.push(
          normalizeScorePair(pair[1], pair[2], {
            isMatchTiebreak: index === lockedIndexes[lockedIndexes.length - 1] && looksLikeMatchTiebreakSet(pair[1], pair[2], raw),
            isTimed: isTimedScoreText(raw),
          })
        );
      }
    }

    if (sets.length < 3) {
      const deepRowSets = extractSetPairsDeepFromNode(rowNode);
      for (const set of deepRowSets) {
        const duplicate = sets.some((existing) =>
          toNumber(existing?.homeGames) === toNumber(set?.homeGames) &&
          toNumber(existing?.awayGames) === toNumber(set?.awayGames) &&
          Boolean(existing?.isMatchTiebreak) === Boolean(set?.isMatchTiebreak)
        );
        if (!duplicate && sets.length < 3) {
          sets.push(set);
        }
      }
    }

    return filterMeaningfulSets(sets);
  }

  function setsAreSplitWithoutDecider(sets) {
    const meaningful = filterMeaningfulSets(sets);
    if (meaningful.length < 2) return false;

    const firstTwo = meaningful.slice(0, 2);
    let homeWins = 0;
    let awayWins = 0;

    for (const set of firstTwo) {
      const home = toNumber(set?.homeGames);
      const away = toNumber(set?.awayGames);
      if (home === null || away === null) continue;
      if (home > away) homeWins += 1;
      else if (away > home) awayWins += 1;
    }

    return homeWins === 1 && awayWins === 1 && meaningful.length < 3;
  }

  function looksLikeMatchTiebreakSet(homeGames, awayGames, sourceText = '') {
    const home = toNumber(homeGames);
    const away = toNumber(awayGames);

    if (home === null || away === null) return false;

    // 1-0 / 0-1 is TennisLink's condensed notation for a won/lost super-tiebreak
    if ((home === 1 && away === 0) || (home === 0 && away === 1)) {
      return true;
    }

    // Regular tennis sets max out at 7 games (7-5 or 7-6 tiebreak).
    // Any score where one side reached 8+ games cannot be a standard set,
    // so it must be a match tiebreak (super-tiebreak) shown with actual points.
    if (Math.max(home, away) >= 8) {
      return true;
    }

    if (Math.max(home, away) >= 7 && Math.max(home, away) <= 25) {
      if (
        lower(sourceText).includes('tiebreak') ||
        lower(sourceText).includes('match tb') ||
        lower(sourceText).includes('match tiebreak')
      ) {
        return true;
      }
    }

    return false;
  }


  function collectWinnerMarkerText(node) {
    if (!node) return '';

    const values = [
      node.getAttribute?.('aria-label'),
      node.getAttribute?.('title'),
      node.getAttribute?.('alt'),
      node.getAttribute?.('data-original-title'),
      node.getAttribute?.('data-title'),
      node.getAttribute?.('data-tip'),
      node.getAttribute?.('class'),
      node.getAttribute?.('src'),
      node.getAttribute?.('style'),
      node.textContent,
    ]
      .filter(Boolean)
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean);

    return values.join(' | ');
  }

  function nodeLooksLikeWinnerMarker(node) {
    const markerText = lower(collectWinnerMarkerText(node));
    if (!markerText) return false;

    if (/[✓✔☑✅]/.test(markerText)) return true;
    if (markerText.includes('winner')) return true;
    if (markerText.includes('won')) return true;
    if (/\bwin\b/.test(markerText)) return true;
    if (markerText.includes('check')) return true;
    if (markerText.includes('tick')) return true;
    if (markerText.includes('victory')) return true;
    if (markerText.includes('greencheck')) return true;
    if (markerText.includes('icon-check')) return true;
    if (markerText.includes('fa-check')) return true;
    if (markerText.includes('glyphicon-ok')) return true;
    if (markerText.includes('selected')) return true;
    if (markerText.includes('highlight')) return true;
    if (markerText.includes('bold')) return true;
    if (markerText.includes('font-weight:700')) return true;
    if (markerText.includes('font-weight: 700')) return true;
    if (markerText.includes('font-weight:600')) return true;
    if (markerText.includes('font-weight: 600')) return true;
    if (markerText.includes('font-weight: bold')) return true;
    if (markerText.includes('font-weight:bold')) return true;

    return false;
  }

  function nodeLooksEmphasized(node) {
    if (!node) return false;

    const tag = String(node.tagName || '').toLowerCase();
    if (tag === 'strong' || tag === 'b') return true;

    const classText = lower(node.getAttribute?.('class') || '');
    if (
      classText.includes('winner') ||
      classText.includes('selected') ||
      classText.includes('highlight') ||
      classText.includes('bold') ||
      classText.includes('emphasis') ||
      classText.includes('current')
    ) {
      return true;
    }

    const styleText = lower(node.getAttribute?.('style') || '');
    if (
      styleText.includes('font-weight:700') ||
      styleText.includes('font-weight: 700') ||
      styleText.includes('font-weight:600') ||
      styleText.includes('font-weight: 600') ||
      styleText.includes('font-weight: bold') ||
      styleText.includes('font-weight:bold')
    ) {
      return true;
    }

    return false;
  }

  function cellLooksLikePlayerCell(cell) {
    const text = normalizeWhitespace(cell ? cell.textContent || '' : '');
    if (!text) return false;
    if (extractSetPairsFromText(text).length) return false;
    if (isIgnorableScorecardText(text)) return false;
    if (/^\d+$/.test(text)) return false;
    return /[A-Za-z]/.test(text);
  }

  function detectWinnerSideFromRowMarkers(row, options = {}) {
    if (!row) return null;

    const cells = Array.from(row.querySelectorAll('td, th'));
    if (!cells.length) return null;

    const homeCellIndex =
      typeof options.homeCellIndex === 'number'
        ? options.homeCellIndex
        : 1;

    const awayCellIndex =
      typeof options.awayCellIndex === 'number'
        ? options.awayCellIndex
        : Math.max(cells.length - 2, 1);

    const midpoint = (homeCellIndex + awayCellIndex) / 2;

    let homeHits = 0;
    let awayHits = 0;

    const winnerSelectors = [
      '[aria-label*="win" i]',
      '[aria-label*="winner" i]',
      '[title*="win" i]',
      '[title*="winner" i]',
      '[alt*="win" i]',
      '[alt*="winner" i]',
      '[class*="winner" i]',
      '[class*="check" i]',
      '[class*="highlight" i]',
      '[class*="selected" i]',
      '[src*="check" i]',
      'img',
      'svg',
      'i',
      'span',
      'strong',
      'b',
      'div',
    ];

    const winnerElements = Array.from(
      row.querySelectorAll(winnerSelectors.join(', '))
    ).filter((node) => nodeLooksLikeWinnerMarker(node));

    for (const element of winnerElements) {
      const ownerCell = element.closest('td, th');
      if (!ownerCell) continue;

      const ownerIndex = cells.indexOf(ownerCell);
      if (ownerIndex === -1) continue;

      // A cell that contains player-name text alongside a marker icon is likely showing
      // a match-status indicator (e.g. TennisLink's "Completed" checkmark embedded in
      // the player cell). Give such markers weight 1 so a dedicated winner-marker column
      // (an icon-only cell with no other text, weight 2) can break the tie.
      const cellText = normalizeWhitespace(ownerCell.textContent || '');
      const cellHasPlayerText = cellText.length > 2 &&
        /[A-Za-z]{2,}/.test(cellText) &&
        !extractSetPairsFromText(cellText).length;
      const markerWeight = cellHasPlayerText ? 1 : 2;

      if (ownerIndex <= homeCellIndex) homeHits += markerWeight;
      else if (ownerIndex >= awayCellIndex) awayHits += markerWeight;
      else if (ownerIndex <= midpoint) homeHits += 1;
      else awayHits += 1;
    }

    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (!cellLooksLikePlayerCell(cell)) continue;

      const emphasized = nodeLooksEmphasized(cell) || Array.from(cell.querySelectorAll('*')).some(nodeLooksEmphasized);
      if (!emphasized) continue;

      if (i <= homeCellIndex) homeHits += 1;
      else if (i >= awayCellIndex) awayHits += 1;
      else if (i <= midpoint) homeHits += 1;
      else awayHits += 1;
    }

    if (homeHits > awayHits) return 'home';
    if (awayHits > homeHits) return 'away';

    // "Vs." anchor fallback — works regardless of what the winner icon looks like.
    // Find the "Vs." cell, then count any <img>/<svg> to its left (home) or right (away).
    // This fires unconditionally so it can override a weak or wrong first-pass result.
    {
      const vsCell = cells.find((cell) =>
        /^(vs\.?|v\.?)$/i.test(normalizeWhitespace(cell.textContent || ''))
      );
      const vsIdx = vsCell ? cells.indexOf(vsCell) : -1;

      if (vsIdx !== -1) {
        let imgHome = 0;
        let imgAway = 0;
        for (const img of Array.from(row.querySelectorAll('img, svg'))) {
          const ownerCell = img.closest('td, th');
          if (!ownerCell) continue;
          const ownerIndex = cells.indexOf(ownerCell);
          if (ownerIndex === -1 || ownerIndex === vsIdx) continue;
          // Skip the scores column (last cell in the row)
          if (ownerIndex === cells.length - 1) continue;
          if (ownerIndex < vsIdx) imgHome += 1;
          else imgAway += 1;
        }
        if (imgHome > imgAway) return 'home';
        if (imgAway > imgHome) return 'away';
      }
    }

    const rowText = row.textContent || '';
    const normalized = normalizeWhitespace(rowText);
    const compact = normalized.replace(/\s+/g, '');

    if (/[✓✔☑✅]/.test(compact)) {
      const split = compact.split(/vs\.?/i);
      const leftSide = split[0] || '';
      const rightSide = split[1] || '';
      const leftChecks = (leftSide.match(/[✓✔☑✅]/g) || []).length;
      const rightChecks = (rightSide.match(/[✓✔☑✅]/g) || []).length;

      if (leftChecks > rightChecks) return 'home';
      if (rightChecks > leftChecks) return 'away';
    }

    return null;
  }

  function buildLineScoreMetadata(rawScoreText, sets) {
    const normalized = normalizeWhitespace(rawScoreText);
    const scoreEventType = classifyScoreEventType(normalized, sets);

    return {
      rawScoreText: normalized || null,
      timedMatch: scoreEventType === 'timed_match',
      hasThirdSetMatchTiebreak: scoreEventType === 'third_set_match_tiebreak',
      scoreEventType,
    };
  }



  function countResolvedLineWinners(lines) {
    return safeArray(lines).reduce(
      (acc, line) => {
        if (line?.winnerSide === 'home') acc.home += 1;
        if (line?.winnerSide === 'away') acc.away += 1;
        if (!line?.winnerSide) acc.unresolved += 1;
        return acc;
      },
      { home: 0, away: 0, unresolved: 0 }
    );
  }

  function lineHasExplicitWinner(line) {
    return Boolean(line?.markerWinnerSide || line?.textWinnerSide);
  }

  function isCleanStraightSetWin(line) {
    const sets = safeArray(line?.sets);
    if (sets.length !== 2) return false;
    if (line?.timedMatch) return false;
    if (setsAreSplitWithoutDecider(sets)) return false;

    let homeWins = 0;
    let awayWins = 0;

    for (const set of sets) {
      const home = toNumber(set?.homeGames);
      const away = toNumber(set?.awayGames);
      if (home === null || away === null || home === away) return false;
      if (home > away) homeWins += 1;
      if (away > home) awayWins += 1;
    }

    if (homeWins === 2 && awayWins === 0) return true;
    if (awayWins === 2 && homeWins === 0) return true;
    return false;
  }

  function classifyEvidence(line) {
    if (line?.isLocked && line?.winnerSide) return 'locked';
    if (line?.winnerSource === 'inferred_missing_third_set' && line?.winnerSide) return 'inferred';
    if (!line?.winnerSide) return 'unresolved';
    return 'conflict_candidate';
  }

  function evaluateWinnerConfidence(line) {
    const notes = [];
    let confidence = 0.2;
    let winnerSource = 'unknown';

    const sets = safeArray(line?.sets);
    const hasPlayers =
      safeArray(line?.homePlayers).filter(Boolean).length > 0 &&
      safeArray(line?.awayPlayers).filter(Boolean).length > 0;
    const markerWinner = line?.markerWinnerSide || null;
    const textWinner = line?.textWinnerSide || null;
    const setWinner = line?.setWinnerSide || null;
    const explicitWinner = markerWinner || textWinner || null;
    const cleanStraightSet = isCleanStraightSetWin(line);
    const locked =
      Boolean(line?.winnerSide) &&
      (Boolean(markerWinner) || Boolean(textWinner) || cleanStraightSet || (line?.timedMatch && explicitWinner));

    if (hasPlayers) confidence += 0.1;
    else notes.push('missing player names on one side');

    if (sets.length >= 2) confidence += 0.18;
    else if (sets.length === 1) {
      confidence += 0.08;
      notes.push('only one set captured');
    } else {
      notes.push('no set scores captured');
    }

    if (markerWinner && line?.winnerSide === markerWinner) {
      confidence = Math.max(confidence, 0.95);
      winnerSource = 'dom_marker';
    }

    if (textWinner && line?.winnerSide === textWinner) {
      confidence = Math.max(confidence, 0.9);
      winnerSource = winnerSource === 'unknown' ? 'winner_column' : winnerSource;
    }

    if (setWinner && line?.winnerSide === setWinner && winnerSource === 'unknown') {
      winnerSource = 'set_math';
      confidence = Math.max(confidence, cleanStraightSet ? 0.82 : 0.76);
    }

    if (line?.winnerSource === 'inferred_missing_third_set' && line?.winnerSide) {
      winnerSource = 'inferred_missing_third_set';
      confidence = Math.max(confidence, 0.68);
    }

    if (line?.timedMatch) {
      notes.push('timed match detected');
      if (!explicitWinner && !line?.winnerSide) {
        confidence = Math.min(confidence, 0.35);
      } else if (explicitWinner && line?.winnerSide) {
        confidence = Math.max(confidence, 0.9);
      }
    }

    if (cleanStraightSet && line?.winnerSide) {
      notes.push('clean straight-set winner locked');
    }

    if (markerWinner && textWinner && markerWinner !== textWinner) {
      notes.push('marker and winner column disagree');
      confidence = Math.min(confidence, 0.45);
    }

    if (setWinner && markerWinner && setWinner !== markerWinner) {
      notes.push('set math and DOM marker disagree');
      confidence = Math.min(confidence, 0.5);
    }

    if (!line?.winnerSide) {
      notes.push('winner unresolved');
      confidence = Math.min(confidence, line?.timedMatch ? 0.4 : 0.35);
    }

    if (setsAreSplitWithoutDecider(sets) && !line?.timedMatch) {
      notes.push('split opening sets without captured deciding set');
    }

    confidence = Math.max(0, Math.min(1, confidence));

    return {
      confidence: Number(confidence.toFixed(2)),
      winnerSource,
      parseNotes: unique(notes),
      isLocked: locked,
    };
  }

  function addLineDiagnostics(line) {
    const diagnostic = evaluateWinnerConfidence(line);
    const winnerSource =
      line?.winnerSource && line.winnerSource !== 'unknown'
        ? line.winnerSource
        : diagnostic.winnerSource;
    const isLocked = Boolean(line?.isLocked) || diagnostic.isLocked;

    const nextLine = {
      ...line,
      captureConfidence:
        typeof line?.captureConfidence === 'number'
          ? Math.max(0, Math.min(1, Number(line.captureConfidence.toFixed(2))))
          : diagnostic.confidence,
      winnerSource,
      isLocked,
      parseNotes: unique([
        ...safeArray(line?.parseNotes),
        ...diagnostic.parseNotes,
        ...(line?.scoreEventType === 'third_set_match_tiebreak' ? ['third-set match tiebreak handling applied'] : []),
        ...(line?.scoreEventType === 'timed_match' ? ['timed-match handling applied'] : []),
      ]),
    };

    nextLine.evidenceClass = classifyEvidence(nextLine);
    return nextLine;
  }

  function reconcileLinesWithOfficialTeamScore(lines, totalTeamScore) {
    const officialHome = toNumber(totalTeamScore?.home);
    const officialAway = toNumber(totalTeamScore?.away);

    let nextLines = safeArray(lines).map((line) =>
      addLineDiagnostics({
        ...line,
        parseNotes: safeArray(line?.parseNotes),
      })
    );

    const diagnostics = [];
    let dataConflict = false;
    let conflictType = null;
    let needsReview = false;

    function lineIsSafeInferenceCandidate(line) {
      if (!line || line.isLocked) return false;
      if (line.timedMatch) return false;
      if (lineHasExplicitWinner(line)) return false;
      if (line.winnerSide) return false;
      const sets = safeArray(line?.sets);
      return sets.length === 2 && setsAreSplitWithoutDecider(sets);
    }

    function inferMissingThirdSetWinner() {
      if (officialHome === null || officialAway === null) return false;

      const counts = countResolvedLineWinners(nextLines);
      const candidates = nextLines.filter((line) => lineIsSafeInferenceCandidate(line));

      if (candidates.length !== 1) return false;

      const missingHome = officialHome - counts.home;
      const missingAway = officialAway - counts.away;
      if (missingHome < 0 || missingAway < 0) return false;

      const target = candidates[0];

      if (missingHome === 1 && missingAway === 0) {
        target.winnerSide = 'home';
      } else if (missingAway === 1 && missingHome === 0) {
        target.winnerSide = 'away';
      } else {
        return false;
      }

      target.winnerSource = 'inferred_missing_third_set';
      target.scoreEventType = 'third_set_match_tiebreak';
      target.hasThirdSetMatchTiebreak = true;
      target.timedMatch = false;
      target.captureConfidence = Math.max(
        typeof target.captureConfidence === 'number' ? target.captureConfidence : 0,
        0.68
      );
      target.parseNotes = unique([
        ...safeArray(target.parseNotes),
        'missing deciding set inferred from official team total',
        'implicit third-set match tiebreak winner assigned',
      ]);

      diagnostics.push(
        `Safely inferred the missing deciding-set winner on line ${target.lineNumber} from the official team total.`
      );
      return true;
    }

    const inferred = inferMissingThirdSetWinner();
    nextLines = nextLines.map(addLineDiagnostics);

    const counts = countResolvedLineWinners(nextLines);

    if (counts.unresolved > 0) {
      diagnostics.push(
        `Official score is ${officialHome === null ? 'unknown' : officialHome}-${officialAway === null ? 'unknown' : officialAway}, but ${counts.unresolved} line winner(s) remain unresolved.`
      );
      needsReview = true;
    }

    if (officialHome !== null && officialAway !== null) {
      if (counts.home !== officialHome || counts.away !== officialAway) {
        dataConflict = true;
        conflictType = 'team_total_mismatch';
        needsReview = true;
        diagnostics.push(
          `Derived line winners (${counts.home}-${counts.away}) do not match official team score (${officialHome}-${officialAway}).`
        );
        diagnostics.push(
          'Locked-confidence protection preserved high-confidence line evidence over official team total.'
        );

        nextLines = nextLines.map((line) =>
          addLineDiagnostics({
            ...line,
            parseNotes: unique([
              ...safeArray(line.parseNotes),
              'scorecard total mismatch - review this line',
            ]),
            captureConfidence:
              typeof line.captureConfidence === 'number'
                ? Math.max(0, Number((line.captureConfidence - 0.08).toFixed(2)))
                : 0.38,
          })
        );
      } else if (inferred) {
        diagnostics.push('Resolved a safe missing deciding set without changing any locked lines.');
      }
    }

    if (
      nextLines.some(
        (line) => line.timedMatch && !line.winnerSide
      )
    ) {
      needsReview = true;
      diagnostics.push('Timed match winner could not be determined from explicit page evidence.');
    }

    return {
      lines: nextLines,
      diagnostics: unique(diagnostics),
      dataConflict,
      conflictType,
      needsReview,
    };
  }

  function extractSetPairsFromText(scoreText) {
    const text = normalizeWhitespace(scoreText);
    if (!text) return [];

    const compact = text
      .replace(/\bret(?:ired)?\b/gi, ' ')
      .replace(/\bdefault(?:ed)?\b/gi, ' ')
      .replace(/\bwalkover\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const matches = compact.match(/\b\d{1,2}\s*[-–]\s*\d{1,2}(?:\s*[\(\[]\d+[\)\]])?/g) || [];

    const parsed = matches
      .map((setText) => {
        const pair = setText.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
        if (!pair) return null;

        const tiebreak = extractTiebreakValue(setText);
        return normalizeScorePair(pair[1], pair[2], {
          tiebreak,
          isMatchTiebreak: looksLikeMatchTiebreakSet(pair[1], pair[2], compact),
          isTimed: isTimedScoreText(compact),
        });
      })
      .filter(Boolean);

    return filterMeaningfulSets(parsed);
  }

  function extractSetPairsFromColumns(cells, headerMap, rowNode) {
    const sets = [];
    const lockedSets = extractLockedSetPairsFromRow(rowNode, headerMap);

    for (const set of lockedSets) {
      sets.push(set);
    }

    if (!sets.length) {
      for (const key of ['set1', 'set2', 'set3']) {
        const index = headerMap[key];
        if (typeof index !== 'number') continue;

        const raw = cells[index];
        const extracted = extractSetPairsFromText(raw);

        if (extracted.length) {
          sets.push(extracted[0]);
          continue;
        }

        const cellNode =
          rowNode && typeof index === 'number'
            ? rowNode.querySelectorAll('th, td')[index]
            : null;

        const fromCell = extractSetPairsFromCellNode(cellNode);
        if (fromCell.length) {
          sets.push(fromCell[0]);
          continue;
        }

        const pair = String(raw || '').match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
        if (pair) {
          sets.push(
            normalizeScorePair(pair[1], pair[2], {
              isMatchTiebreak: key === 'set3' && looksLikeMatchTiebreakSet(pair[1], pair[2], String(raw || '')),
              isTimed: isTimedScoreText(String(raw || '')),
            })
          );
        }
      }
    }

    if (rowNode && sets.length < 3) {
      const rowCells = Array.from(rowNode.querySelectorAll('th, td'));
      const extraSets = [];

      for (let i = 0; i < rowCells.length; i += 1) {
        const isDeclaredSetCell = detectLockedSetColumnIndexes(headerMap, rowNode).includes(i);
        if (isDeclaredSetCell) continue;
        const fromCell = extractSetPairsFromCellNode(rowCells[i]);
        for (const set of fromCell) {
          extraSets.push(set);
        }
      }

      for (const set of extraSets) {
        const duplicate = sets.some((existing) =>
          toNumber(existing?.homeGames) === toNumber(set?.homeGames) &&
          toNumber(existing?.awayGames) === toNumber(set?.awayGames) &&
          Boolean(existing?.isMatchTiebreak) === Boolean(set?.isMatchTiebreak)
        );
        if (!duplicate && sets.length < 3) {
          sets.push(set);
        }
      }
    }

    return filterMeaningfulSets(sets);
  }

  function determineWinnerSideFromSets(sets) {
    const safeSets = safeArray(sets);
    const timedSets = safeSets.filter((set) => Boolean(set?.isTimed));
    const matchTiebreakSets = safeSets.filter((set) => Boolean(set?.isMatchTiebreak));

    if (timedSets.length) {
      const finalTimed = timedSets[timedSets.length - 1];
      const home = toNumber(finalTimed?.homeGames);
      const away = toNumber(finalTimed?.awayGames);
      if (home !== null && away !== null) {
        if (home > away) return 'home';
        if (away > home) return 'away';
      }
    }

    let homeSetWins = 0;
    let awaySetWins = 0;

    for (const set of safeSets) {
      const home = toNumber(set.homeGames);
      const away = toNumber(set.awayGames);

      if (home === null || away === null) continue;

      if (home > away) homeSetWins += 1;
      else if (away > home) awaySetWins += 1;
    }

    if (homeSetWins > awaySetWins) return 'home';
    if (awaySetWins > homeSetWins) return 'away';

    const finalSet = safeSets.length ? safeSets[safeSets.length - 1] : null;
    if (finalSet && finalSet.isMatchTiebreak) {
      const home = toNumber(finalSet.homeGames);
      const away = toNumber(finalSet.awayGames);

      if (home !== null && away !== null) {
        if (home > away) return 'home';
        if (away > home) return 'away';
      }
    }

    if (matchTiebreakSets.length) {
      const finalTiebreak = matchTiebreakSets[matchTiebreakSets.length - 1];
      const home = toNumber(finalTiebreak?.homeGames);
      const away = toNumber(finalTiebreak?.awayGames);
      if (home !== null && away !== null) {
        if (home > away) return 'home';
        if (away > home) return 'away';
      }
    }

    if (safeArray(sets).length === 2) {
      const first = safeArray(sets)[0];
      const second = safeArray(sets)[1];
      const diff =
        (toNumber(first?.homeGames) - toNumber(first?.awayGames)) +
        (toNumber(second?.homeGames) - toNumber(second?.awayGames));

      if (diff > 0) return 'home';
      if (diff < 0) return 'away';
    }

    return null;
  }

  function inferMatchType(value, lineNumber, homePlayers, awayPlayers) {
    const text = lower(value);

    if (text.includes('single')) return 'singles';
    if (text.includes('double')) return 'doubles';

    if (safeArray(homePlayers).length >= 2 || safeArray(awayPlayers).length >= 2) {
      return 'doubles';
    }

    if (safeArray(homePlayers).length === 1 && safeArray(awayPlayers).length === 1) {
      return 'singles';
    }

    const line = toNumber(lineNumber);
    if (line === null) return null;
    if (line === 1 || line === 2) return 'singles';
    if (line >= 3) return 'doubles';

    return null;
  }

  function inferMatchTypeFromRenderedLabel(label) {
    const text = lower(label);
    if (text.includes('single')) return 'singles';
    if (text.includes('double')) return 'doubles';
    return null;
  }

  function inferLineNumberFromRenderedLabel(label) {
    const text = normalizeWhitespace(label);
    const match = text.match(/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function parseTeamScoreFromTextNearTeams(homeTeam, awayTeam) {
    const bodyText = normalizeWhitespace(document.body?.innerText || '');
    if (!bodyText) return { home: null, away: null };

    const escapedHome = homeTeam ? homeTeam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    const escapedAway = awayTeam ? awayTeam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;

    if (escapedHome && escapedAway) {
      const regexes = [
        new RegExp(
          `${escapedHome}\\s*(\\d+(?:\\.\\d+)?)\\s*[-–:]\\s*(\\d+(?:\\.\\d+)?)\\s*${escapedAway}`,
          'i'
        ),
        new RegExp(
          `${escapedHome}\\s*\\((\\d+(?:\\.\\d+)?)\\)\\s*.*?${escapedAway}\\s*\\((\\d+(?:\\.\\d+)?)\\)`,
          'i'
        ),
        new RegExp(
          `${escapedHome}.*?(\\d+(?:\\.\\d+)?)\\s*[-–]\\s*(\\d+(?:\\.\\d+)?) .*?${escapedAway}`,
          'i'
        ),
      ];

      for (const regex of regexes) {
        const match = bodyText.match(regex);
        if (match) {
          return {
            home: Number(match[1]),
            away: Number(match[2]),
          };
        }
      }
    }

    const teamScoreLine = bodyText.match(/\bteam score\b.*?(\d+(?:\.\d+)?)\s*[-–:]\s*(\d+(?:\.\d+)?)/i);
    if (teamScoreLine) {
      return {
        home: Number(teamScoreLine[1]),
        away: Number(teamScoreLine[2]),
      };
    }

    const winsPattern =
      /([^\n]+?)\s*\(.*?home team.*?\)\s*(\d+)\s*wins.*?([^\n]+?)\s*\(.*?(?:visiting team|away team).*?\)\s*(\d+)\s*wins/i;
    const winsMatch = bodyText.match(winsPattern);
    if (winsMatch) {
      return {
        home: Number(winsMatch[2]),
        away: Number(winsMatch[4]),
      };
    }

    return { home: null, away: null };
  }

  function getHeaderMap(headerCells) {
    const map = {};

    headerCells.forEach((cellText, index) => {
      const key = lower(cellText);
      if (!key) return;

      if (key.includes('line') || key.includes('position') || key === '#') map.lineNumber = index;
      if (key.includes('match type') || key === 'type' || key.includes('court')) map.matchType = index;
      if (key.includes('individual score')) map.individualScore = index;
      if (key === 'set 1' || key.includes('1st set') || key.includes('first set')) map.set1 = index;
      if (key === 'set 2' || key.includes('2nd set') || key.includes('second set')) map.set2 = index;
      if (
        key === 'set 3' ||
        key.includes('3rd set') ||
        key.includes('third set') ||
        key.includes('set 3') ||
        key.includes('match tiebreak') ||
        key.includes('match tie-break')
      ) map.set3 = index;
      if (key.includes('winner')) map.winner = index;

      if (key.includes('home') && key.includes('player')) map.homePlayers = index;
      if (key.includes('visiting') && key.includes('player')) map.awayPlayers = index;
      if (key.includes('away') && key.includes('player')) map.awayPlayers = index;
      if (key.includes('team 1') && key.includes('player')) map.homePlayers = index;
      if (key.includes('team 2') && key.includes('player')) map.awayPlayers = index;
    });

    return map;
  }

  function findLabelValue(labelRegex) {
    const labelPattern = labelRegex instanceof RegExp ? labelRegex : new RegExp(labelRegex, 'i');
    const rows = Array.from(document.querySelectorAll('tr'));

    for (const row of rows) {
      const cells = getCells(row).map((cell) => textOf(cell)).filter(Boolean);

      if (cells.length >= 2) {
        for (let i = 0; i < cells.length; i += 1) {
          if (!labelPattern.test(cells[i])) continue;

          for (let j = i + 1; j < cells.length; j += 1) {
            const candidate = normalizeWhitespace(cells[j]);
            if (!candidate) continue;
            if (isIgnorableScorecardText(candidate)) continue;
            if (cleanTeamName(candidate)) return candidate;
          }

          if (i > 0) {
            const leftCandidate = normalizeWhitespace(cells[i - 1]);
            if (leftCandidate && !isIgnorableScorecardText(leftCandidate) && cleanTeamName(leftCandidate)) {
              return leftCandidate;
            }
          }
        }
      }
    }

    const lines = getPageLines();

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!labelPattern.test(line)) continue;

      const sameLineColon = line.split(':').slice(1).join(':').trim();
      if (sameLineColon && !isIgnorableScorecardText(sameLineColon) && cleanTeamName(sameLineColon)) {
        return sameLineColon;
      }

      const inlineMatches = [
        line.match(/^home team\s*:?\s*(.+)$/i),
        line.match(/^(visiting team|away team)\s*:?\s*(.+)$/i),
        line.match(/^date match played\s*:?\s*(.+)$/i),
      ].filter(Boolean);

      for (const inlineMatch of inlineMatches) {
        const candidate = normalizeWhitespace(inlineMatch[inlineMatch.length - 1]);
        if (candidate && !isIgnorableScorecardText(candidate)) {
          return candidate;
        }
      }

      for (let offset = 1; offset <= 6; offset += 1) {
        const next = lines[index + offset];
        if (!next) break;
        const candidate = normalizeWhitespace(next);
        if (!candidate) continue;
        if (isIgnorableScorecardText(candidate)) continue;
        if (/^date match played$/i.test(candidate)) break;
        if (/^entry date$/i.test(candidate)) break;
        if (/^3rd set tie-break$/i.test(candidate)) break;
        if (/^total team score:?$/i.test(candidate)) break;
        return candidate;
      }
    }

    return null;
  }

  function isLikelyRenderedScorecardTable(table) {
    const rows = getRows(table);
    if (rows.length < 2) return false;

    const preview = rows
      .slice(0, 14)
      .map((row) => lower(rowTexts(row).join(' | ')))
      .join(' || ');

    let score = 0;

    if (preview.includes('home team')) score += 4;
    if (preview.includes('visiting team') || preview.includes('away team')) score += 4;
    if (preview.includes('3rd set tie-break')) score += 4;
    if (preview.includes('vs.') || preview.includes('vs')) score += 2;
    if (preview.includes('singles')) score += 2;
    if (preview.includes('doubles')) score += 2;
    if (preview.includes('completed')) score += 2;

    return score >= 8;
  }

function getLeafScorecardTables() {
  const allTables = getTables();

  return allTables.filter((table) => {
    // Ignore layout/wrapper tables. The actual scorecard table should not contain nested tables.
    if (table.querySelectorAll('table').length > 0) return false;

    const rows = getRows(table);
    if (rows.length < 2) return false;

    return true;
  });
}

function scoreScorecardTable(table) {
  const rows = getRows(table);
  const tableText = lower(textOf(table));
  const preview = rows
    .slice(0, 20)
    .map((row) => lower(rowTexts(row).join(' | ')))
    .join(' || ');

  let score = 0;

  if (preview.includes('individual score')) score += 12;
  if (preview.includes('set 1')) score += 10;
  if (preview.includes('set 2')) score += 6;
  if (preview.includes('set 3') || preview.includes('3rd set')) score += 4;
  if (preview.includes('line')) score += 6;
  if (preview.includes('position')) score += 5;
  if (preview.includes('winner')) score += 4;

  if (preview.includes('home team')) score += 3;
  if (preview.includes('visiting team') || preview.includes('away team')) score += 3;
  if (preview.includes('vs.') || preview.includes(' vs ')) score += 4;
  if (preview.includes('completed')) score += 2;
  if (preview.includes('singles')) score += 4;
  if (preview.includes('doubles')) score += 4;

  const scoreLikeRows = rows.filter((row) =>
    /\b\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(row.textContent || '')
  ).length;

  score += Math.min(scoreLikeRows * 3, 15);

  const lineLabelRows = rows.filter((row) =>
    /\b\d+\s*#\s*(singles|doubles)\b/i.test(row.textContent || '')
  ).length;

  score += Math.min(lineLabelRows * 4, 20);

  const rowsWithEnoughDirectCells = rows.filter((row) => {
    const directCells = Array.from(row.children).filter((el) =>
      ['TD', 'TH'].includes(el.tagName)
    );
    return directCells.length >= 4;
  }).length;

  score += Math.min(rowsWithEnoughDirectCells, 10);

  if (!/singles|doubles|individual score|set 1|set 2|\d+\s*#\s*(singles|doubles)/i.test(tableText)) {
    score -= 20;
  }

  return score;
}

function extractBestScorecardTable() {
  const allTables = getTables();
  const leafTables = getLeafScorecardTables();

  let bestTable = null;
  let bestScore = -1;
  let bestIndex = -1;

  leafTables.forEach((table, index) => {
    const score = scoreScorecardTable(table);

    if (score > bestScore) {
      bestScore = score;
      bestTable = table;
      bestIndex = index;
    }
  });

  if (!bestTable || bestScore < 8) {
    log('Scorecard table selection failed', {
      totalTables: allTables.length,
      leafTables: leafTables.length,
      bestScore,
      bestIndex,
    });
    return null;
  }

  log('Scorecard table selected', {
    totalTables: allTables.length,
    leafTables: leafTables.length,
    selectedLeafIndex: bestIndex,
    bestScore,
  });

  return bestTable;
}

  function extractScorecardLinesFromTable(table) {
    if (!table) return [];

    const rows = getRows(table);
    if (!rows.length) return [];

    let headerIndex = -1;
    let headerMap = {};

    for (let index = 0; index < rows.length; index += 1) {
      const cells = rowTexts(rows[index]);
      const joined = lower(cells.join(' | '));

      if (
        joined.includes('line') ||
        joined.includes('position') ||
        joined.includes('individual score') ||
        joined.includes('set 1') ||
        joined.includes('winner')
      ) {
        headerIndex = index;
        headerMap = getHeaderMap(cells);
        break;
      }
    }

    if (headerIndex === -1) return [];

    const lines = [];

    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index];
      const cells = rowTexts(row);

      if (!cells.length) continue;

      const joined = normalizeWhitespace(cells.join(' | '));
      const lowered = lower(joined);

      if (!joined) continue;

      if (
        lowered.includes('team total') ||
        lowered.includes('date match played') ||
        lowered.includes('entry date') ||
        lowered === 'line' ||
        lowered === 'position'
      ) {
        continue;
      }

      let rawLineNumber = null;

      if (typeof headerMap.lineNumber === 'number') {
        rawLineNumber = toNumber(cells[headerMap.lineNumber]);
      }

      if (rawLineNumber === null && /^\d+$/.test(String(cells[0] || '').trim())) {
        rawLineNumber = Number(cells[0]);
      }

      if (rawLineNumber === null) {
        const inlineLine = joined.match(/\bline\s*(\d+)\b/i);
        if (inlineLine) rawLineNumber = Number(inlineLine[1]);
      }

      if (rawLineNumber === null) {
        log('Skipping row — no line number detected:', cells);
        continue;
      }

      let homePlayersRaw =
        typeof headerMap.homePlayers === 'number'
          ? cells[headerMap.homePlayers]
          : null;

      let awayPlayersRaw =
        typeof headerMap.awayPlayers === 'number'
          ? cells[headerMap.awayPlayers]
          : null;

      if (!homePlayersRaw || !awayPlayersRaw) {
        const candidateTextCells = cells.filter((cell) => {
          const lc = lower(cell);
          if (!cell) return false;
          if (/^\d+$/.test(cell)) return false;
          if (/\b\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(cell)) return false;
          if (lc === 'w' || lc === 'l') return false;
          if (lc.includes('winner')) return false;
          if (looksLikePureLabel(cell)) return false;
          if (isTimeLike(cell)) return false;
          if (isLineLabel(cell)) return false;
          if (isFooterishLine(cell)) return false;
          return true;
        });

        if (!homePlayersRaw && candidateTextCells[1]) homePlayersRaw = candidateTextCells[1];
        if (!awayPlayersRaw && candidateTextCells[2]) awayPlayersRaw = candidateTextCells[2];
      }

      const homePlayers = splitPlayers(homePlayersRaw);
      const awayPlayers = splitPlayers(awayPlayersRaw);

      const matchTypeSource = firstTruthy(
        typeof headerMap.matchType === 'number' ? cells[headerMap.matchType] : null,
        joined
      );

      const matchType = inferMatchType(matchTypeSource, rawLineNumber, homePlayers, awayPlayers);
      const lineNumber = normalizeLineNumber(rawLineNumber, matchType);

      let sets = extractSetPairsFromColumns(cells, headerMap, row);

      if (!sets.length) {
        const scoreRaw = firstTruthy(
          typeof headerMap.individualScore === 'number' ? cells[headerMap.individualScore] : null,
          cells.find((cell) => /\b\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(cell)),
          joined
        );
        sets = extractSetPairsFromText(scoreRaw);
      }

      const rawScoreText = [
        typeof headerMap.individualScore === 'number' ? cells[headerMap.individualScore] : null,
        typeof headerMap.set1 === 'number' ? cells[headerMap.set1] : null,
        typeof headerMap.set2 === 'number' ? cells[headerMap.set2] : null,
        typeof headerMap.set3 === 'number' ? cells[headerMap.set3] : null,
      ]
        .filter(Boolean)
        .join(' ');

      const scoreMeta = buildLineScoreMetadata(rawScoreText, sets);

      const setWinnerSide = determineWinnerSideFromSets(sets);

      const markerWinnerSide = detectWinnerSideFromRowMarkers(row, {
        homeCellIndex:
          typeof headerMap.homePlayers === 'number'
            ? headerMap.homePlayers
            : 1,
        awayCellIndex:
          typeof headerMap.awayPlayers === 'number'
            ? headerMap.awayPlayers
            : Math.max(cells.length - 2, 1),
      });

      // Always check the winner column — both text labels and embedded marker images.
      // Don't gate this on markerWinnerSide; gather it independently for cross-confirmation.
      let textWinnerSide = null;
      if (typeof headerMap.winner === 'number') {
        const winnerText = lower(cells[headerMap.winner]);
        if (winnerText.includes('home')) textWinnerSide = 'home';
        else if (winnerText.includes('away')) textWinnerSide = 'away';
        else if (winnerText.includes('visiting')) textWinnerSide = 'away';
        else if (winnerText.includes('team 1')) textWinnerSide = 'home';
        else if (winnerText.includes('team 2')) textWinnerSide = 'away';
        // Standard USTA/TennisLink convention: 'W' = home team wins this line,
        // 'L' = visiting team wins. Only match exact single-letter values to avoid
        // catching partial words like "water" or "loss".
        else if (winnerText === 'w') textWinnerSide = 'home';
        else if (winnerText === 'l') textWinnerSide = 'away';

        // If the winner column shows an image marker but no readable text, look at
        // which player cell in the same row is visually emphasized (bold, winner class,
        // or has a checkmark adjacent to it). This is more reliable than using the
        // winner column's cell position, which varies by scorecard layout.
        if (!textWinnerSide) {
          const rowCells = Array.from(row.querySelectorAll('td, th'));
          const winnerCell = rowCells[headerMap.winner];
          const hasWinnerMarkerInColumn = winnerCell
            ? Array.from(winnerCell.querySelectorAll('img, svg, i, span')).some(nodeLooksLikeWinnerMarker)
            : false;

          if (hasWinnerMarkerInColumn) {
            // Determine winner by which player cell is emphasized, not column position
            const homeIdx = typeof headerMap.homePlayers === 'number' ? headerMap.homePlayers : -1;
            const awayIdx = typeof headerMap.awayPlayers === 'number' ? headerMap.awayPlayers : -1;
            const homeCell = homeIdx >= 0 ? rowCells[homeIdx] : null;
            const awayCell = awayIdx >= 0 ? rowCells[awayIdx] : null;

            const homeEmphasized = homeCell &&
              (nodeLooksEmphasized(homeCell) || Array.from(homeCell.querySelectorAll('*')).some(nodeLooksEmphasized));
            const awayEmphasized = awayCell &&
              (nodeLooksEmphasized(awayCell) || Array.from(awayCell.querySelectorAll('*')).some(nodeLooksEmphasized));

            if (homeEmphasized && !awayEmphasized) textWinnerSide = 'home';
            else if (awayEmphasized && !homeEmphasized) textWinnerSide = 'away';
            else textWinnerSide = markerWinnerSide; // fall back to position if emphasis is ambiguous
          }
        }
      }

      // DOM marker and text column are reliable; set math is not when TennisLink
      // shows the winner's score first rather than the home player's score first.
      const reliableWinner = markerWinnerSide || textWinnerSide;

      // When the reliable winner contradicts set math, the scores are inverted —
      // normalize all set scores to home-first perspective by swapping.
      let normalizedSets = sets;
      let normalizedSetWinnerSide = setWinnerSide;
      if (reliableWinner && setWinnerSide && reliableWinner !== setWinnerSide) {
        normalizedSets = sets.map((set) => {
          if (!set) return set;
          return { ...set, homeGames: set.awayGames, awayGames: set.homeGames };
        });
        // Recompute so confidence scoring sees agreement rather than a false conflict
        normalizedSetWinnerSide = determineWinnerSideFromSets(normalizedSets);
      }

      const winnerSide = reliableWinner || normalizedSetWinnerSide || null;

      lines.push({
        lineNumber,
        matchType,
        homePlayers,
        awayPlayers,
        sets: normalizedSets,
        winnerSide,
        setWinnerSide: normalizedSetWinnerSide,
        textWinnerSide,
        markerWinnerSide,
        parseNotes: [],
        ...scoreMeta,
      });
    }

    return dedupeAndSortLines(lines);
  }

  function dedupeAndSortLines(lines) {
    const deduped = [];
    const seen = new Set();

    for (const line of lines) {
      const cleanLine = {
        lineNumber: line.lineNumber,
        matchType: line.matchType,
        homePlayers: safeArray(line.homePlayers).filter(Boolean),
        awayPlayers: safeArray(line.awayPlayers).filter(Boolean),
        sets: safeArray(line.sets).filter(Boolean),
        winnerSide: line.winnerSide || null,
        rawScoreText: line.rawScoreText || null,
        timedMatch: Boolean(line.timedMatch),
        hasThirdSetMatchTiebreak: Boolean(line.hasThirdSetMatchTiebreak),
        scoreEventType: line.scoreEventType || 'standard',
      };

      if (!cleanLine.homePlayers.length && !cleanLine.awayPlayers.length && !cleanLine.sets.length) {
        continue;
      }

      const key = JSON.stringify({
        lineNumber: cleanLine.lineNumber,
        matchType: cleanLine.matchType,
        homePlayers: cleanLine.homePlayers,
        awayPlayers: cleanLine.awayPlayers,
        sets: cleanLine.sets,
      });

      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(cleanLine);
    }

    function lineCompleteness(line) {
      return (safeArray(line.homePlayers).filter(Boolean).length) +
             (safeArray(line.awayPlayers).filter(Boolean).length) +
             (safeArray(line.sets).filter(Boolean).length * 2) +
             (line.winnerSide ? 3 : 0);
    }

    const uniqueByLine = {};

    for (const line of deduped) {
      const existing = uniqueByLine[line.lineNumber];
      if (!existing || lineCompleteness(line) > lineCompleteness(existing)) {
        uniqueByLine[line.lineNumber] = line;
      }
    }

    return Object.values(uniqueByLine).sort((a, b) => {
      const left = toNumber(a.lineNumber) || 0;
      const right = toNumber(b.lineNumber) || 0;
      return left - right;
    });
  }

  function extractRenderedScorecardLines(table) {
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll('tr'));
    const lines = [];

    rows.forEach((row) => {
      const rowText = innerTextOf(row);

      if (/total team score/i.test(rowText)) return;
      if (/\*game winning %/i.test(rowText)) return;
      if (/learn more/i.test(rowText)) return;
      if (/want to find more tennis/i.test(rowText)) return;
      if (/careers/i.test(rowText)) return;

      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 2) return;

      const cellTexts = cells.map((cell) => innerTextOf(cell));

      let labelIndex = -1;
      let labelText = '';

      for (let i = 0; i < cellTexts.length; i += 1) {
        if (/\b\d+\s*#\s*(singles|doubles)\b/i.test(cellTexts[i])) {
          labelIndex = i;
          labelText = cellTexts[i];
          break;
        }
      }

      if (labelIndex === -1 || !labelText) return;

      const rawLineNumber = inferLineNumberFromRenderedLabel(labelText);
      const matchType = inferMatchTypeFromRenderedLabel(labelText);
      const lineNumber = normalizeLineNumber(rawLineNumber, matchType);

      if (lineNumber === null || !matchType) return;

      const scoreCandidates = cellTexts.filter((value) => {
        if (extractSetPairsFromText(value).length) return true;
        // Include bare "N-N" cells that filterMeaningfulSets strips as tiny sets
        // (e.g. "1-0" shown in a dedicated 3rd-set tiebreak column).
        const trimmed = normalizeWhitespace(value);
        return /^\d{1,2}[-–]\d{1,2}$/.test(trimmed);
      });
      const scoreRaw = scoreCandidates.join(' ') || '';

      let vsIndex = -1;
      for (let i = 0; i < cellTexts.length; i += 1) {
        if (/^(vs\.?|v\.?)$/i.test(cellTexts[i])) {
          vsIndex = i;
          break;
        }
      }

      let homePlayers = [];
      let awayPlayers = [];

      if (vsIndex !== -1) {
        const leftBlock = cellTexts.slice(labelIndex + 1, vsIndex).join('\n');
        const rightBlock = cellTexts.slice(vsIndex + 1).join('\n');

        homePlayers = splitPlayers(leftBlock);

        const rightLines = rightBlock
          .split(/\n+/)
          .map((item) => normalizeWhitespace(item))
          .filter(Boolean)
          .filter((item) => !extractSetPairsFromText(item).length);

        awayPlayers = splitPlayers(rightLines.join('\n'));
      } else {
        const playerBlocks = cellTexts.filter((value) => {
          if (!value) return false;
          if (isIgnorableScorecardText(value)) return false;
          if (extractSetPairsFromText(value).length) return false;
          if (isFooterishLine(value)) return false;
          if (/total team score/i.test(value)) return false;
          if (/\*game winning %/i.test(value)) return false;
          return true;
        });

        if (playerBlocks.length >= 2) {
          if (matchType === 'singles') {
            homePlayers = splitPlayers(playerBlocks[0]);
            awayPlayers = splitPlayers(playerBlocks[1]);
          } else {
            homePlayers = splitPlayers(playerBlocks.slice(0, 2).join('\n'));
            awayPlayers = splitPlayers(playerBlocks.slice(2, 4).join('\n'));
          }
        }
      }

      const sets = extractSetPairsFromText(scoreRaw);
      const scoreMeta = buildLineScoreMetadata(scoreRaw || rowText, sets);
      const setWinnerSide = determineWinnerSideFromSets(sets);
      // When the "Vs." separator is known, anchor the away side start to the cell
      // immediately after it — more precise than the generic cellTexts.length - 2 heuristic.
      const markerWinnerSide = detectWinnerSideFromRowMarkers(row, {
        homeCellIndex: Math.max(labelIndex + 1, 1),
        awayCellIndex: vsIndex !== -1
          ? Math.max(vsIndex + 1, labelIndex + 2)
          : Math.max(cellTexts.length - 2, labelIndex + 2),
      });

      // Normalize scores to home-first if DOM marker contradicts set math
      let normalizedSets = sets;
      let normalizedSetWinnerSide = setWinnerSide;
      if (markerWinnerSide && setWinnerSide && markerWinnerSide !== setWinnerSide) {
        normalizedSets = sets.map((set) => {
          if (!set) return set;
          return { ...set, homeGames: set.awayGames, awayGames: set.homeGames };
        });
        normalizedSetWinnerSide = determineWinnerSideFromSets(normalizedSets);
      }

      const winnerSide = markerWinnerSide || normalizedSetWinnerSide || null;

      if (!homePlayers.length && !awayPlayers.length && !sets.length) return;

      lines.push({
        lineNumber,
        matchType,
        homePlayers,
        awayPlayers,
        sets: normalizedSets,
        winnerSide,
        setWinnerSide: normalizedSetWinnerSide,
        textWinnerSide: null,
        markerWinnerSide,
        parseNotes: [],
        ...scoreMeta,
      });
    });

    return dedupeAndSortLines(lines);
  }

  function extractRenderedScorecardLinesFromText(pageText) {
    const allLines = String(pageText || '')
      .split(/\n+/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);

    const results = [];

    for (let i = 0; i < allLines.length; i += 1) {
      const label = allLines[i];
      if (!/\b\d+\s*#\s*(singles|doubles)\b/i.test(label)) continue;

      const rawLineNumber = inferLineNumberFromRenderedLabel(label);
      const matchType = inferMatchTypeFromRenderedLabel(label);
      const lineNumber = normalizeLineNumber(rawLineNumber, matchType);
      if (lineNumber === null || !matchType) continue;

      const block = [];
      let j = i + 1;

      while (j < allLines.length) {
        const nextLine = allLines[j];

        if (/\b\d+\s*#\s*(singles|doubles)\b/i.test(nextLine)) break;
        if (/^total team score:?$/i.test(nextLine)) break;
        if (/^\*game winning %:?$/i.test(nextLine)) break;
        if (/^learn more$/i.test(nextLine)) break;
        if (/^want to find more tennis\?$/i.test(nextLine)) break;
        if (/^careers$/i.test(nextLine)) break;
        if (/^(home team|visiting team|away team|date match played|entry date|3rd set tie-break)$/i.test(nextLine)) break;

        block.push(nextLine);
        j += 1;
      }

      let vsIndex = -1;
      const filteredBlock = block.filter((item) => {
        if (!item) return false;
        if (/^team id:/i.test(item)) return false;
        if (/^completed$/i.test(item)) return false;
        if (isTimeLike(item)) return false;
        if (looksLikePureLabel(item)) return false;
        if (isFooterishLine(item)) return false;
        if (/^total team score:?$/i.test(item)) return false;
        if (/^\*game winning %:?$/i.test(item)) return false;
        return true;
      });

      vsIndex = filteredBlock.findIndex((item) => /^(vs\.?|v\.?)$/i.test(item));

      const scoreRaw = filteredBlock.filter((item) => extractSetPairsFromText(item).length).join(' ');
      const sets = extractSetPairsFromText(scoreRaw);

      if (vsIndex !== -1) {
        const homeRaw = filteredBlock
          .slice(0, vsIndex)
          .filter((item) => !extractSetPairsFromText(item).length);

        const awayRaw = filteredBlock
          .slice(vsIndex + 1)
          .filter((item) => !extractSetPairsFromText(item).length);

        const homePlayers = splitPlayers(homeRaw.join('\n'));
        const awayPlayers = splitPlayers(awayRaw.join('\n'));
        const scoreMeta = buildLineScoreMetadata(scoreRaw, sets);
        const setWinnerSide = determineWinnerSideFromSets(sets);
        // Text-only fallback: no DOM access means no checkmark detection.
        // Leave winner unresolved so the review system can catch discrepancies.
        const winnerSide = null;

        if (homePlayers.length || awayPlayers.length || sets.length) {
          results.push({
            lineNumber,
            matchType,
            homePlayers,
            awayPlayers,
            sets,
            winnerSide,
            setWinnerSide,
            textWinnerSide: null,
            markerWinnerSide: null,
            parseNotes: [],
            ...scoreMeta,
          });
        }

        i = j - 1;
        continue;
      }

      const nonScoreItems = filteredBlock
        .filter((item) => !extractSetPairsFromText(item).length)
        .filter((item) => !isIgnorableScorecardText(item));

      let playerItems = nonScoreItems.slice();

      if (playerItems.length && /^(vs\.?|v\.?)$/i.test(playerItems[0])) {
        playerItems = playerItems.slice(1);
      }

      const homePlayers = [];
      const awayPlayers = [];

      if (matchType === 'singles' && playerItems.length >= 2) {
        homePlayers.push(cleanPlayerText(playerItems[0]));
        awayPlayers.push(cleanPlayerText(playerItems[1]));
      } else if (matchType === 'doubles' && playerItems.length >= 4) {
        homePlayers.push(cleanPlayerText(playerItems[0]));
        homePlayers.push(cleanPlayerText(playerItems[1]));
        awayPlayers.push(cleanPlayerText(playerItems[2]));
        awayPlayers.push(cleanPlayerText(playerItems[3]));
      } else if (playerItems.length >= 2) {
        const mid = Math.ceil(playerItems.length / 2);
        const left = playerItems.slice(0, mid).join('\n');
        const right = playerItems.slice(mid).join('\n');
        homePlayers.push(...splitPlayers(left));
        awayPlayers.push(...splitPlayers(right));
      }

      const scoreMeta = buildLineScoreMetadata(scoreRaw || filteredBlock.join(' '), sets);
      const setWinnerSide = determineWinnerSideFromSets(sets);
      // Text-only fallback: leave winner unresolved; no DOM evidence available
      const winnerSide = null;

      if (homePlayers.length || awayPlayers.length || sets.length) {
        results.push({
          lineNumber,
          matchType,
          homePlayers: homePlayers.filter(Boolean),
          awayPlayers: awayPlayers.filter(Boolean),
          sets,
          winnerSide,
          setWinnerSide,
          textWinnerSide: null,
          markerWinnerSide: null,
          parseNotes: [],
          ...scoreMeta,
        });
      }

      i = j - 1;
    }

    return dedupeAndSortLines(results);
  }

  function extractDateMatchPlayed(text) {
    const lines = getPageLines();

    for (const line of lines) {
      const match = line.match(/date match played\s*:\s*([^\n]+)/i);
      if (match) {
        const raw = normalizeWhitespace(match[1]);
        const dateOnly = raw.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
        return dateOnly ? normalizeDate(dateOnly[0]) : raw;
      }

      const inline = line.match(/date match played\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (inline) {
        return normalizeDate(inline[1]);
      }
    }

    const labelValue = findLabelValue(/date match played/i);
    if (labelValue) {
      const dateOnly = String(labelValue).match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
      return dateOnly ? normalizeDate(dateOnly[0]) : labelValue;
    }

    const parsed = parseDateFromValue(text);
    if (parsed && isDate(parsed)) return normalizeDate(parsed);

    return parsed || null;
  }

  function extractMetadataFromPageText() {
    const lines = getPageLines();
    const meta = {
      homeTeam: null,
      awayTeam: null,
      dateMatchPlayed: null,
      teamScore: { home: null, away: null },
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const lc = lower(line);

      if (!meta.homeTeam && lc === 'home team') {
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
          const candidate = cleanTeamName(lines[j]);
          if (candidate) {
            meta.homeTeam = candidate;
            break;
          }
        }
      }

      if (!meta.awayTeam && (lc === 'visiting team' || lc === 'away team')) {
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
          const candidate = cleanTeamName(lines[j]);
          if (candidate) {
            meta.awayTeam = candidate;
            break;
          }
        }
      }

      if (!meta.homeTeam) {
        const inlineHome = line.match(/^home team\s*:?\s*(.+)$/i);
        if (inlineHome) {
          const candidate = cleanTeamName(inlineHome[1]);
          if (candidate) meta.homeTeam = candidate;
        }
      }

      if (!meta.awayTeam) {
        const inlineAway = line.match(/^(visiting team|away team)\s*:?\s*(.+)$/i);
        if (inlineAway) {
          const candidate = cleanTeamName(inlineAway[2]);
          if (candidate) meta.awayTeam = candidate;
        }
      }

      if (!meta.dateMatchPlayed) {
        const match = line.match(/date match played\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
        if (match) {
          meta.dateMatchPlayed = normalizeDate(match[1]);
        }
      }

      if (lc === 'team score' && lines[i + 1]) {
        const pair = lines[i + 1].match(/(\d+(?:\.\d+)?)\s*[-–:]\s*(\d+(?:\.\d+)?)/);
        if (pair) {
          meta.teamScore = {
            home: Number(pair[1]),
            away: Number(pair[2]),
          };
        }
      }

      const inlineScore = line.match(/team score\s*:?\s*(\d+(?:\.\d+)?)\s*[-–:]\s*(\d+(?:\.\d+)?)/i);
      if (inlineScore) {
        meta.teamScore = {
          home: Number(inlineScore[1]),
          away: Number(inlineScore[2]),
        };
      }

      const winsMatch = line.match(/(.+?)\s+(\d+)\s+wins$/i);
      if (
        winsMatch &&
        meta.teamScore.home === null &&
        i + 1 < lines.length &&
        /wins$/i.test(lines[i + 1])
      ) {
        const nextWins = lines[i + 1].match(/(.+?)\s+(\d+)\s+wins$/i);
        if (nextWins) {
          meta.teamScore = {
            home: Number(winsMatch[2]),
            away: Number(nextWins[2]),
          };
        }
      }
    }

    return meta;
  }

  function findValueNearLabel(rows, rowIndex, cellIndex) {
    const currentRowTexts = rowTexts(rows[rowIndex]);

    for (let i = cellIndex + 1; i < currentRowTexts.length; i += 1) {
      const candidate = normalizeWhitespace(currentRowTexts[i]);
      if (candidate && !isIgnorableScorecardText(candidate) && cleanTeamName(candidate)) return candidate;
    }

    for (let nextRow = rowIndex + 1; nextRow <= Math.min(rowIndex + 3, rows.length - 1); nextRow += 1) {
      const nextTexts = rowTexts(rows[nextRow]);
      for (const candidate of nextTexts) {
        const cleanCandidate = normalizeWhitespace(candidate);
        if (cleanCandidate && !isIgnorableScorecardText(cleanCandidate) && cleanTeamName(cleanCandidate)) {
          return cleanCandidate;
        }
      }
    }

    return null;
  }

  function extractMetadataFromTables() {
    const meta = {
      homeTeam: null,
      awayTeam: null,
      dateMatchPlayed: null,
      teamScore: { home: null, away: null },
    };

    const labelMatchers = {
      homeTeam: /^home team$/i,
      awayTeam: /^(visiting team|away team)$/i,
      dateMatchPlayed: /^date match played$/i,
      teamScore: /^team score$/i,
    };

    for (const table of getTables()) {
      const rows = getRows(table);

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const cells = getCells(row);
        const texts = cells.map((cell) => textOf(cell));

        for (let cellIndex = 0; cellIndex < texts.length; cellIndex += 1) {
          const cellText = texts[cellIndex];
          if (!cellText) continue;

          if (!meta.homeTeam && labelMatchers.homeTeam.test(cellText)) {
            const value = findValueNearLabel(rows, rowIndex, cellIndex);
            const cleaned = cleanTeamName(value);
            if (cleaned) meta.homeTeam = cleaned;
          }

          if (!meta.awayTeam && labelMatchers.awayTeam.test(cellText)) {
            const value = findValueNearLabel(rows, rowIndex, cellIndex);
            const cleaned = cleanTeamName(value);
            if (cleaned) meta.awayTeam = cleaned;
          }

          if (!meta.dateMatchPlayed && labelMatchers.dateMatchPlayed.test(cellText)) {
            const value = findValueNearLabel(rows, rowIndex, cellIndex);
            const parsed = parseDateFromValue(value);
            if (parsed) meta.dateMatchPlayed = normalizeDate(parsed);
          }

          if ((meta.teamScore.home === null || meta.teamScore.away === null) && labelMatchers.teamScore.test(cellText)) {
            const value = findValueNearLabel(rows, rowIndex, cellIndex);
            const pair = String(value || '').match(/(\d+(?:\.\d+)?)\s*[-–:]\s*(\d+(?:\.\d+)?)/);
            if (pair) {
              meta.teamScore = {
                home: Number(pair[1]),
                away: Number(pair[2]),
              };
            }
          }
        }
      }
    }

    return meta;
  }

  function extractMetadataFromDomBlocks() {
    const meta = {
      homeTeam: null,
      awayTeam: null,
      dateMatchPlayed: null,
      teamScore: { home: null, away: null },
    };

    const nodes = Array.from(document.querySelectorAll('td, th, div, span, p, strong, b, font'));
    const values = nodes.map((node) => innerTextOf(node)).filter(Boolean);

    for (let i = 0; i < values.length; i += 1) {
      const current = values[i];
      const lc = lower(current);

      if (!meta.homeTeam) {
        if (lc === 'home team' || /^home team\s*:/.test(lc)) {
          const inline = current.replace(/^home team\s*:?\s*/i, '');
          const inlineClean = cleanTeamName(inline);
          if (inlineClean && lower(inlineClean) !== 'home team') {
            meta.homeTeam = inlineClean;
          } else {
            for (let j = i + 1; j < Math.min(i + 6, values.length); j += 1) {
              const candidate = cleanTeamName(values[j]);
              if (candidate) {
                meta.homeTeam = candidate;
                break;
              }
            }
          }
        }
      }

      if (!meta.awayTeam) {
        if (lc === 'visiting team' || lc === 'away team' || /^(visiting team|away team)\s*:/.test(lc)) {
          const inline = current.replace(/^(visiting team|away team)\s*:?\s*/i, '');
          const inlineClean = cleanTeamName(inline);
          if (inlineClean && lower(inlineClean) !== 'visiting team' && lower(inlineClean) !== 'away team') {
            meta.awayTeam = inlineClean;
          } else {
            for (let j = i + 1; j < Math.min(i + 6, values.length); j += 1) {
              const candidate = cleanTeamName(values[j]);
              if (candidate) {
                meta.awayTeam = candidate;
                break;
              }
            }
          }
        }
      }

      if (!meta.dateMatchPlayed) {
        const m = current.match(/date match played\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
        if (m) {
          meta.dateMatchPlayed = normalizeDate(m[1]);
        }
      }

      if (meta.teamScore.home === null || meta.teamScore.away === null) {
        const scoreMatch = current.match(/team score\s*:?\s*(\d+(?:\.\d+)?)\s*[-–:]\s*(\d+(?:\.\d+)?)/i);
        if (scoreMatch) {
          meta.teamScore = {
            home: Number(scoreMatch[1]),
            away: Number(scoreMatch[2]),
          };
        }
      }

      if (
        meta.teamScore.home === null &&
        /home team/i.test(current) &&
        /(\d+)\s*wins/i.test(current) &&
        i + 1 < values.length &&
        /(?:visiting team|away team)/i.test(values[i + 1]) &&
        /(\d+)\s*wins/i.test(values[i + 1])
      ) {
        const homeWins = current.match(/(\d+)\s*wins/i);
        const awayWins = values[i + 1].match(/(\d+)\s*wins/i);
        if (homeWins && awayWins) {
          meta.teamScore = {
            home: Number(homeWins[1]),
            away: Number(awayWins[1]),
          };
        }
      }
    }

    return meta;
  }

  function extractSummaryTeamsAndScore(pageText) {
    const lines = String(pageText || '')
      .split(/\n+/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);

    const meta = {
      homeTeam: null,
      awayTeam: null,
      teamScore: {
        home: null,
        away: null,
      },
    };

    let summaryStart = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^TOTAL TEAM SCORE:?$/i.test(lines[i])) {
        summaryStart = i;
        break;
      }
    }

    if (summaryStart === -1) return meta;

    for (let i = summaryStart + 1; i < Math.min(summaryStart + 10, lines.length); i += 1) {
      const line = lines[i];
      if (!line) continue;
      if (/^\*GAME WINNING %:?$/i.test(line)) break;
      if (isFooterishLine(line)) break;

      const winsMatch = line.match(/^(.+?)\s*(?:\([^)]*\)\s*)*\((Home Team|Visiting Team|Away Team)\)\s*(\d+)\s*WINS?$/i);
      if (!winsMatch) continue;

      const rawName = cleanTeamName(winsMatch[1]);
      const side = lower(winsMatch[2]);
      const wins = Number(winsMatch[3]);

      if (!rawName || Number.isNaN(wins)) continue;

      if (side === 'home team') {
        meta.homeTeam = rawName;
        meta.teamScore.home = wins;
      } else {
        meta.awayTeam = rawName;
        meta.teamScore.away = wins;
      }
    }

    return meta;
  }

  function deriveScoreFromLines(lines) {
    let home = 0;
    let away = 0;

    lines.forEach((line) => {
      if (line.winnerSide === 'home') home += 1;
      if (line.winnerSide === 'away') away += 1;
    });

    if (!home && !away) {
      return { home: null, away: null };
    }

    return { home, away };
  }

  function mergeTeamCandidates(...candidates) {
    for (const candidate of candidates) {
      const cleaned = cleanTeamName(candidate);
      if (cleaned) return normalizeTeamName(cleaned);
    }
    return null;
  }

  function extractScorecard(cachedScheduleEntry) {
    const text = document.body?.innerText || '';
    const bestTable = extractBestScorecardTable();

    let lines = extractScorecardLinesFromTable(bestTable);
    let captureMethod = 'table';

    if (!lines.length && bestTable && isLikelyRenderedScorecardTable(bestTable)) {
      lines = extractRenderedScorecardLines(bestTable);
      captureMethod = 'rendered_table';
    }

    if (!lines.length) {
      lines = extractRenderedScorecardLinesFromText(text);
      captureMethod = 'text_fallback';
    }

    const summaryMeta = extractSummaryTeamsAndScore(text);
    const pageMeta = extractMetadataFromPageText();
    const tableMeta = extractMetadataFromTables();
    const domMeta = extractMetadataFromDomBlocks();
    const titleTeams = parseTeamNamesFromTitleArea();

    const urlMatchId = extractMatchIdFromHref(window.location.href);
    const pageMatchIds = extractAllMatchIdsFromPage();
    const matchId = firstTruthy(urlMatchId, pageMatchIds[0], null);

    // Schedule cache is the highest-priority team source — it comes from the
    // structured schedule page and is authoritative about which team is home vs away.
    const cacheHomeTeam = cachedScheduleEntry?.homeTeam || null;
    const cacheAwayTeam = cachedScheduleEntry?.awayTeam || null;

    const homeTeam = mergeTeamCandidates(
      cacheHomeTeam,
      summaryMeta.homeTeam,
      tableMeta.homeTeam,
      domMeta.homeTeam,
      pageMeta.homeTeam,
      findLabelValue(/home team/i),
      findLabelValue(/^team 1$/i),
      titleTeams.homeTeam
    );

    const awayTeam = mergeTeamCandidates(
      cacheAwayTeam,
      summaryMeta.awayTeam,
      tableMeta.awayTeam,
      domMeta.awayTeam,
      pageMeta.awayTeam,
      findLabelValue(/visiting team/i),
      findLabelValue(/away team/i),
      findLabelValue(/^team 2$/i),
      titleTeams.awayTeam
    );

    const dateMatchPlayed =
      tableMeta.dateMatchPlayed ||
      domMeta.dateMatchPlayed ||
      pageMeta.dateMatchPlayed ||
      extractDateMatchPlayed(text) ||
      (cachedScheduleEntry?.scheduleDate ? normalizeDate(cachedScheduleEntry.scheduleDate) : null) ||
      null;

    let totalTeamScore = summaryMeta.teamScore;
    if (totalTeamScore.home === null || totalTeamScore.away === null) {
      totalTeamScore = tableMeta.teamScore;
    }
    if (totalTeamScore.home === null || totalTeamScore.away === null) {
      totalTeamScore = domMeta.teamScore;
    }
    if (totalTeamScore.home === null || totalTeamScore.away === null) {
      totalTeamScore = pageMeta.teamScore;
    }
    if (totalTeamScore.home === null || totalTeamScore.away === null) {
      totalTeamScore = parseTeamScoreFromTextNearTeams(homeTeam, awayTeam);
    }
    if (totalTeamScore.home === null || totalTeamScore.away === null) {
      totalTeamScore = deriveScoreFromLines(lines);
    }

    const reconciled = reconcileLinesWithOfficialTeamScore(lines, totalTeamScore);
    lines = reconciled.lines;

    const engineDiagnostics = unique([
      ...safeArray(reconciled.diagnostics),
      `capture method: ${captureMethod}`,
            `scorecard table scan: ${getTables().length} total table(s), ${getLeafScorecardTables().length} leaf table(s)`,
      ...(safeArray(lines).some((line) => line?.hasThirdSetMatchTiebreak)
        ? ['third-set match tiebreak detected']
        : []),
      ...(safeArray(lines).some((line) => line?.timedMatch)
        ? ['timed match detected']
        : []),
      ...(captureMethod === 'text_fallback'
        ? ['text-only fallback used — no DOM table found; all line winners unresolved']
        : []),
    ]);

    const captureQuality = (() => {
      if (!lines.length) return 0;
      const scores = lines
        .map((line) =>
          typeof line?.captureConfidence === 'number' ? line.captureConfidence : 0
        );
      const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      return Number(avg.toFixed(2));
    })();

    const unresolvedLineCount = safeArray(lines).filter((line) => !line?.winnerSide).length;

    // Facility is not reliably present on the scorecard page itself, but the
    // schedule cache carries it from the structured schedule page.
    const facility = cachedScheduleEntry?.facility
      ? normalizeWhitespace(cachedScheduleEntry.facility)
      : null;

    return {
      matchId,
      homeTeam: normalizeTeamName(homeTeam || ''),
      awayTeam: normalizeTeamName(awayTeam || ''),
      dateMatchPlayed: dateMatchPlayed || null,
      facility,
      totalTeamScore: {
        home: totalTeamScore.home ?? null,
        away: totalTeamScore.away ?? null,
      },
      captureEngine: {
        version: 'review-safe-v2',
        captureQuality,
        diagnostics: engineDiagnostics,
      },
      dataConflict: Boolean(reconciled.dataConflict),
      conflictType: reconciled.conflictType || null,
      needsReview: Boolean(reconciled.needsReview || unresolvedLineCount > 0 || captureMethod === 'text_fallback'),
      captureMethod,
      lines,
    };
  }

  window.__TENACEIQ_CAPTURE_PAGE__ = capturePage;
})();
