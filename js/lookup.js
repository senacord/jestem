/** YouTube Lookup — uses YouTube Data API v3 (key in lookup-config.js). */

const video = document.getElementById('bgVideo');
const muteBtn = document.getElementById('muteBtn');
const volume = document.getElementById('volume');

const input = document.getElementById('identifier');
const btn = document.getElementById('go');
const statusEl = document.getElementById('status');
const profileEl = document.getElementById('profile');
const copyImageBtn = document.getElementById('copyImageBtn');
const resultEl = document.querySelector('.result');

const toastEl = document.getElementById('toast');
const toastTextEl = document.getElementById('toastText');
let toastTimer = null;

const bannerImg = document.getElementById('banner');
const bannerWrap = document.getElementById('bannerWrap');
const avatarImg = document.getElementById('avatar');
const nameEl = document.getElementById('name');
const verifiedBadgeEl = document.getElementById('verifiedBadge');
const channelLink = document.getElementById('channelLink');
const uploadsLink = document.getElementById('uploadsLink');

const metaHandle = document.getElementById('metaHandle');
const metaVerified = document.getElementById('metaVerified');
const metaId = document.getElementById('metaId');
const metaViews = document.getElementById('metaViews');
const metaVideos = document.getElementById('metaVideos');
const metaSubs = document.getElementById('metaSubs');
const metaAge = document.getElementById('metaAge');
const metaCountry = document.getElementById('metaCountry');
const metaBlocks = document.getElementById('metaBlocks');
const metaUploadsLink = document.getElementById('metaUploadsLink');
const uploadsOpenBtn = document.getElementById('uploadsOpenBtn');
const metaDesc = document.getElementById('metaDesc');
const metaHidden = document.getElementById('metaHidden');
const metaRedirect = document.getElementById('metaRedirect');
const metaKeywords = document.getElementById('metaKeywords');

const rowVerified = document.getElementById('rowVerified');
const rowHandle = document.getElementById('rowHandle');
const rowViews = document.getElementById('rowViews');
const rowVideos = document.getElementById('rowVideos');
const rowSubs = document.getElementById('rowSubs');
const rowAge = document.getElementById('rowAge');
const rowCountry = document.getElementById('rowCountry');
const rowBlocks = document.getElementById('rowBlocks');
const rowUploads = document.getElementById('rowUploads');
const rowDesc = document.getElementById('rowDesc');
const rowKeywords = document.getElementById('rowKeywords');

const NO_DATA = "YouTube didn't return this data for some reason, sorry.";
const NO_HANDLE = 'Channel does not have a @ handle set.';
const NO_NAME = "The channel doesn't have channel name set";
const NO_COUNTRY = 'This channel does not have a country/region set';
const NO_DESC = "Channel doesn't have a description set";
const NO_KEYWORDS = "No keywords are set for this channel";

const BADGE_ARTIST = 'images/Artist_Verification_Badge.svg';
const BADGE_VERIFIED = 'images/Verified_Checkmark.svg';

const API_VERIFIED_NOTE =
  'Tryb bez serwera: YouTube Data API wywoływane z przeglądarki nie zwraca weryfikacji ani bloków z metadanych filmów. Uruchom backend (npm start + zmienna YOUTUBE_DATA_API_KEY), potem wejdź na http://localhost:3333/lookup.html.';

function getYouTubeApiKey() {
  const k = typeof window !== 'undefined' ? window.YOUTUBE_DATA_API_KEY : '';
  return typeof k === 'string' ? k.trim() : '';
}

function getIdentifierFromLocation() {
  const p = new URLSearchParams(window.location.search);
  const h = p.get('h') || p.get('handle');
  const id = p.get('id');
  const q = p.get('q');
  if (h) return `@${h.replace(/^@/, '')}`;
  if (id) return id;
  if (q) return q;
  return '';
}

function syncUrlWithChannel(data) {
  try {
    if (!data?.channel_id) return;
    const p = new URLSearchParams();
    if (data.handle) {
      p.set('h', String(data.handle).replace(/^@/, ''));
    } else {
      p.set('id', data.channel_id);
    }
    const nextSearch = `?${p.toString()}`;
    if (window.location.search === nextSearch) return;

    const next = `${window.location.pathname}${nextSearch}`;
    history.pushState({ channelId: data.channel_id }, '', next);
  } catch {
    // ignore
  }
}

function updateLookupModeBanner(lookupMode, clientReason) {
  const el = document.getElementById('lookupModeBanner');
  if (!el) return;
  el.classList.toggle('lookupModeBanner--ok', lookupMode === 'server');

  if (lookupMode === 'server') {
    el.hidden = false;
    el.textContent =
      'Pełny tryb: dane z YouTube API + analiza strony kanału (weryfikacja) + metadane ostatnich uploadów (blokady regionów).';
    return;
  }

  el.hidden = false;
  let msg =
    'Jesteś w trybie tylko-przeglądarki.\n\n' +
    'Zwykłe API YouTube z kluczem w stronie NIE udostępnia odznaki weryfikacji ani bloków regionalnych z filmów — stąd komunikat, że „YouTube nie daje tych informacji”. Pełne funkcje wymagają małego serwera Node obok strony.';

  if (clientReason === 'server_missing_key') {
    msg +=
      '\n\nSerwer odpowiada, ale nie ma klucza: ustaw w PowerShell przed npm start:\n$env:YOUTUBE_DATA_API_KEY="TWÓJ_KLUCZ"';
  } else if (clientReason === 'static_only') {
    msg +=
      '\n\nBrak działającego /api/channel. Często: otwierasz plik z dysku (file://) albo hosting bez Node. Użyj adresu http://localhost:3333/lookup.html po starcie serwera.';
  }

  msg +=
    '\n\nKroki (Windows, PowerShell):\n' +
    '1) cd do tego folderu projektu\n' +
    '2) npm install\n' +
    '3) $env:YOUTUBE_DATA_API_KEY="twój_klucz_z_Google_Cloud"\n' +
    '4) npm start\n' +
    '5) Wejdź na: http://localhost:3333/lookup.html\n\n' +
    '(Potrzebny zainstalowany Node.js LTS z nodejs.org — wtedy działa też polecenie npm.)';

  el.textContent = msg;
}

function hideLookupModeBanner() {
  const el = document.getElementById('lookupModeBanner');
  if (el) el.hidden = true;
}

/**
 * @returns {Promise<{ data: object, lookupMode: 'server' | 'client', clientReason?: string }>}
 */
async function fetchChannelFromServerOrClient(identifier) {
  const bases = [];
  if (typeof window.LOOKUP_API_BASE === 'string' && window.LOOKUP_API_BASE.trim()) {
    bases.push(window.LOOKUP_API_BASE.trim().replace(/\/$/, ''));
  }
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    bases.push(window.location.origin);
  }

  const seen = new Set();
  let serverMissingKey = false;

  for (const base of bases) {
    if (seen.has(base)) continue;
    seen.add(base);

    let res;
    try {
      const url = new URL('/api/channel', base);
      url.searchParams.set('identifier', identifier);
      res = await fetch(url.toString());
    } catch {
      continue;
    }

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (res.status === 429) {
      throw new Error((json && json.message) || 'Rate limited. Try again later.');
    }

    if (res.ok && json && json.ok && json.data) {
      return { data: json.data, lookupMode: 'server' };
    }

    if (res.status === 503 && json && json.code === 'NO_API_KEY') {
      serverMissingKey = true;
      break;
    }

    if (!res.ok && json && json.message) {
      throw new Error(json.message);
    }
  }

  if (!getYouTubeApiKey()) {
    const err = new Error('MISSING_API_KEY');
    err.clientReason = serverMissingKey ? 'server_missing_key' : 'static_only';
    throw err;
  }

  const channelId = await resolveChannelId(identifier);
  const data = await fetchChannelPayload(channelId);
  return {
    data,
    lookupMode: 'client',
    clientReason: serverMissingKey ? 'server_missing_key' : 'static_only',
  };
}

function parseYouTubeIdentifier(raw) {
  const s0 = raw.trim();
  if (!s0) return { error: 'Enter something to look up.' };

  const ucStandalone = /^UC[\w-]{22}$/i.exec(s0);
  if (ucStandalone) return { channelId: ucStandalone[0] };

  const hasProtocol = /^https?:\/\//i.test(s0);
  const looksLikeUrl = hasProtocol || (s0.includes('youtube.com') && s0.includes('/'));

  if (looksLikeUrl || s0.includes('youtube.')) {
    try {
      const urlStr = hasProtocol ? s0 : `https://${s0.replace(/^\/\//, '')}`;
      const u = new URL(urlStr);
      const host = u.hostname.replace(/^www\./i, '');
      if (host === 'youtu.be') {
        return {
          error: 'youtu.be links are usually for videos. Use a channel URL, @handle, or UC… id.',
        };
      }
      if (!/(^|\.)youtube\.com$/i.test(host)) return { searchQuery: s0 };

      let path = u.pathname.replace(/\/+$/, '') || '/';
      if (path.includes('/watch') && u.searchParams.get('v')) {
        return {
          error: 'That is a video URL. Paste the channel page, @handle, or UC… channel id.',
        };
      }
      const mCh = path.match(/\/channel\/(UC[\w-]{22})/i);
      if (mCh) return { channelId: mCh[1] };
      const mH = path.match(/\/@([\w.-]+)/i);
      if (mH) return { handle: mH[1] };
      const mLegacy = path.match(/\/(?:c|user)\/([^/?#]+)/i);
      if (mLegacy) {
        const slug = decodeURIComponent(mLegacy[1]);
        return { legacySlug: slug, searchQuery: slug };
      }
      return { searchQuery: s0 };
    } catch {
      return { searchQuery: s0 };
    }
  }

  if (s0.startsWith('@')) return { handle: s0.slice(1) };
  if (/^[\w.-]{2,30}$/.test(s0)) return { handle: s0.replace(/^@/, '') };
  return { searchQuery: s0 };
}

async function ytFetch(endpoint, params) {
  const key = getYouTubeApiKey();
  if (!key) {
    const err = new Error('MISSING_API_KEY');
    throw err;
  }
  const u = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  u.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString());
  let json = {};
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = json?.error?.message || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.reason = json?.error?.errors?.[0]?.reason;
    err.status = res.status;
    throw err;
  }
  return json;
}

function firstSearchChannelId(json) {
  for (const item of json.items || []) {
    const cid = item?.id?.channelId;
    if (cid && /^UC[\w-]{22}$/i.test(cid)) return cid;
  }
  return null;
}

async function resolveChannelId(identifier) {
  const parsed = parseYouTubeIdentifier(identifier);
  if (parsed.error) throw new Error(parsed.error);
  if (parsed.channelId) return parsed.channelId;

  if (parsed.handle) {
    try {
      const json = await ytFetch('channels', { part: 'id', forHandle: parsed.handle });
      if (json.items?.[0]?.id) return json.items[0].id;
    } catch {
      // forHandle not always available; try search
    }
    const searchJson = await ytFetch('search', {
      part: 'snippet',
      type: 'channel',
      q: parsed.handle,
      maxResults: 3,
    });
    const cid = firstSearchChannelId(searchJson);
    if (cid) return cid;
    throw new Error('No channel found for that handle');
  }

  const searchQ = parsed.searchQuery || parsed.legacySlug;
  if (searchQ) {
    const searchJson = await ytFetch('search', {
      part: 'snippet',
      type: 'channel',
      q: searchQ,
      maxResults: 5,
    });
    const cid = firstSearchChannelId(searchJson);
    if (!cid) throw new Error('No channel matches that search');
    return cid;
  }

  throw new Error('Enter a channel URL, @handle, or channel ID');
}

function formatCompactNumber(n) {
  if (n == null || n === '') return null;
  const num = typeof n === 'string' ? parseInt(n, 10) : Number(n);
  if (Number.isNaN(num)) return String(n);
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}

function channelAgeFromPublishedAt(iso) {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NO_DATA;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years > 0) {
    return `${years} year${years === 1 ? '' : 's'}, ${months} month${months === 1 ? '' : 's'}`;
  }
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days >= 30) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'}`;
  return `${Math.max(0, days)} day${days === 1 ? '' : 's'}`;
}

function parseBrandingKeywords(keywordsString) {
  if (typeof keywordsString !== 'string' || !keywordsString.trim()) return [];
  const m = keywordsString.match(/"[^"]+"|[^\s"]+/g);
  if (m) return m.map((s) => s.replace(/^"|"$/g, '')).filter(Boolean);
  return keywordsString.split(/\s+/).filter(Boolean);
}

async function fetchChannelPayload(channelId) {
  const json = await ytFetch('channels', {
    part: 'snippet,statistics,brandingSettings,contentDetails,status,topicDetails',
    id: channelId,
  });
  const ch = json.items?.[0];
  if (!ch) throw new Error('Channel not found');
  return mapYouTubeChannelToPayload(ch);
}

function mapYouTubeChannelToPayload(ch) {
  const sn = ch.snippet || {};
  const st = ch.statistics || {};
  const br = ch.brandingSettings || {};
  const brCh = br.channel || {};
  const brIm = br.image || {};
  const cd = ch.contentDetails || {};
  const rel = cd.relatedPlaylists || {};
  const stat = ch.status || {};

  const channelId = ch.id;
  const hiddenSubs = st.hiddenSubscriberCount === true;

  let subscriber_text;
  let subscriber_count;
  if (hiddenSubs) {
    subscriber_text = 'Hidden';
    subscriber_count = null;
  } else if (st.subscriberCount != null && st.subscriberCount !== '') {
    subscriber_count = parseInt(String(st.subscriberCount), 10);
    subscriber_text =
      formatCompactNumber(subscriber_count) || String(st.subscriberCount);
  } else {
    subscriber_text = NO_DATA;
    subscriber_count = null;
  }

  const viewCount = st.viewCount != null && st.viewCount !== '' ? parseInt(String(st.viewCount), 10) : null;
  const videoCount =
    st.videoCount != null && st.videoCount !== '' ? parseInt(String(st.videoCount), 10) : null;

  const channel_keywords = parseBrandingKeywords(brCh.keywords || '');

  const handleRaw = sn.customUrl ? String(sn.customUrl) : '';
  const handle = handleRaw.replace(/^@/, '');

  const uploadsId = rel.uploads || '';
  const uploads_playlist_url = uploadsId
    ? `https://www.youtube.com/playlist?list=${uploadsId}`
    : '';

  const banner_url = brIm.bannerExternalUrl || brIm.bannerMobileExtraHdImageUrl || '';

  const thumb =
    sn.thumbnails?.high?.url ||
    sn.thumbnails?.medium?.url ||
    sn.thumbnails?.default?.url ||
    '';

  const privacy = stat.privacyStatus || 'public';
  const is_hidden = privacy === 'private';

  return {
    redirecting: null,
    is_hidden,
    isVerified: false,
    isOfficialArtistChannel: false,
    name: sn.title || '',
    handle,
    description: sn.description || '',
    channel_id: channelId,
    url: `https://www.youtube.com/channel/${channelId}`,
    banner_url,
    avatar_url: thumb,
    uploads_playlist_url,
    view_count: viewCount,
    view_text: viewCount != null ? formatCompactNumber(viewCount) || String(viewCount) : '0',
    video_count: videoCount,
    video_text: videoCount != null ? formatCompactNumber(videoCount) || String(videoCount) : '0',
    subscriber_count,
    subscriber_text,
    channel_age: channelAgeFromPublishedAt(sn.publishedAt),
    country: sn.country || '',
    country_blocks: NO_DATA,
    channel_keywords,
    server_warnings: undefined,
  };
}

function formatQuotedKeywords(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map((s) => String(s).replace(/\"/g, '"'))
    .map((s) => `"${s}"`)
    .join(' ');
}

function showToast(message) {
  if (!toastEl || !toastTextEl) return;

  toastTextEl.textContent = message;
  toastEl.hidden = false;
  toastEl.classList.remove('toast--hide');
  toastEl.classList.add('toast--show');

  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove('toast--show');
    toastEl.classList.add('toast--hide');

    window.setTimeout(() => {
      toastEl.hidden = true;
    }, 240);
  }, 1800);
}

function downloadPngBlob(blob, filename = 'output.png') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function setRowVisible(rowEl, visible) {
  if (!rowEl) return;
  rowEl.style.display = visible ? '' : 'none';
}

function setLinkVisible(linkEl, visible) {
  if (!linkEl) return;
  linkEl.style.display = visible ? '' : 'none';
}

function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function setAudioUiFromState() {
  const isMuted = video.muted || video.volume === 0;
  muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
  muteBtn.setAttribute('aria-pressed', String(!isMuted));
}

function setVolumeFromSlider() {
  const v = clamp01(parseInt(volume.value, 10) / 100);
  video.volume = v;

  if (v === 0) {
    video.muted = true;
  }

  setAudioUiFromState();
}

function getNonEmptyString(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed ? trimmed : '';
}

async function copyResultAsImage() {
  if (!copyImageBtn || !resultEl) return;

  const html2canvasFn = window.html2canvas;
  if (typeof html2canvasFn !== 'function') {
    statusEl.textContent = 'Share is not available right now.';
    return;
  }

  if (!profileEl || profileEl.hidden) {
    statusEl.textContent = 'Nothing to share yet. Lookup a channel first.';
    return;
  }

  const canWriteClipboardImage =
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof window.ClipboardItem === 'function';

  copyImageBtn.disabled = true;

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  const currentWidth = Math.ceil(profileEl.getBoundingClientRect().width);
  const targetWidth = Math.min(980, Math.max(820, currentWidth));
  host.style.width = `${targetWidth}px`;
  host.style.pointerEvents = 'none';
  host.style.opacity = '0';

  const clone = profileEl.cloneNode(true);
  clone.style.background = 'rgba(10, 12, 18, 0.72)';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.height = 'auto';
  clone.style.width = '100%';

  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    const cloneBtn = clone.querySelector('#copyImageBtn');
    if (cloneBtn) {
      cloneBtn.style.display = 'none';
    }
  } catch {
    // ignore
  }

  try {
    const cloneUploadsOpenBtn = clone.querySelector('#uploadsOpenBtn');
    if (cloneUploadsOpenBtn) cloneUploadsOpenBtn.style.display = 'none';
  } catch {
    // ignore
  }

  try {
    const providedText = 'YouTube Lookup';
    const cloneChannelLink = clone.querySelector('#channelLink');
    const cloneUploadsLink = clone.querySelector('#uploadsLink');
    const cloneMetaUploadsLink = clone.querySelector('#metaUploadsLink');
    if (cloneChannelLink) {
      cloneChannelLink.textContent = providedText;
      cloneChannelLink.href = `${window.location.origin}${window.location.pathname}`;
      cloneChannelLink.style.borderBottom = 'none';
      cloneChannelLink.style.textDecoration = 'none';
    }
    if (cloneUploadsLink) {
      cloneUploadsLink.style.display = 'none';
      cloneUploadsLink.style.borderBottom = 'none';
      cloneUploadsLink.style.textDecoration = 'none';
    }

    if (cloneMetaUploadsLink) {
      cloneMetaUploadsLink.style.borderBottom = 'none';
      cloneMetaUploadsLink.style.textDecoration = 'none';
    }
  } catch {
    // ignore
  }

  try {
    const imgs = Array.from(clone.querySelectorAll('img'));
    const imgPromises = imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 1500);
      });
    });
    await Promise.all(imgPromises);

    const canvas = await html2canvasFn(clone, {
      backgroundColor: 'rgba(5, 6, 10, 0.92)',
      useCORS: true,
      scale: Math.min(2, (window.devicePixelRatio || 1) * 1.25),
    });

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create image'))), 'image/png');
    });

    if (!canWriteClipboardImage) {
      downloadPngBlob(blob, 'output.png');
      statusEl.textContent = '';
      showToast('Downloaded output.png');
      return;
    }

    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      statusEl.textContent = '';
      showToast('Copied to clipboard.');
    } catch {
      downloadPngBlob(blob, 'output.png');
      statusEl.textContent = '';
      showToast('Downloaded output.png');
    }
  } catch (e) {
    statusEl.textContent = 'Failed to copy image.';
    showToast('Failed to copy.');
  } finally {
    host.remove();
    copyImageBtn.disabled = false;
  }
}

video.muted = true;
video.volume = 0.3;
volume.value = '30';
setAudioUiFromState();

video.play().catch(() => {
  // Autoplay might be blocked; user interaction will allow playback.
});

muteBtn.addEventListener('click', async () => {
  try {
    await video.play();
  } catch {
    // ignore
  }

  const wantsUnmute = video.muted;
  if (wantsUnmute) {
    video.muted = false;
    setVolumeFromSlider();
  } else {
    video.muted = true;
  }

  setAudioUiFromState();
});

volume.addEventListener('input', () => {
  const v = clamp01(parseInt(volume.value, 10) / 100);
  video.volume = v;
  video.muted = v === 0;
  setAudioUiFromState();
});

video.addEventListener('volumechange', setAudioUiFromState);

if (copyImageBtn) {
  copyImageBtn.addEventListener('click', () => {
    copyResultAsImage();
  });
}

async function lookup() {
  const identifier = input.value.trim();
  if (!identifier) return;

  statusEl.textContent = 'Loading...';
  profileEl.hidden = true;

  try {
    const { data, lookupMode, clientReason } = await fetchChannelFromServerOrClient(identifier);
    updateLookupModeBanner(lookupMode, clientReason);
    statusEl.textContent = '';

    const redirecting = typeof data.redirecting === 'boolean' ? data.redirecting : null;

    if (redirecting === true) {
      statusEl.textContent = 'This channel is redirecting.';
      profileEl.hidden = true;
      if (verifiedBadgeEl) verifiedBadgeEl.hidden = true;
      bannerImg.removeAttribute('src');
      bannerImg.alt = '';
      bannerImg.style.display = 'none';
      profileEl.classList.add('profile--noBanner');
      if (bannerWrap) bannerWrap.style.display = 'none';
      avatarImg.removeAttribute('src');

      setRowVisible(rowVerified, false);
      setRowVisible(rowKeywords, false);
      setRowVisible(rowHandle, false);
      setRowVisible(rowViews, false);
      setRowVisible(rowVideos, false);
      setRowVisible(rowSubs, false);
      setRowVisible(rowAge, false);
      setRowVisible(rowCountry, false);
      setRowVisible(rowBlocks, false);
      setRowVisible(rowUploads, false);
      setRowVisible(rowDesc, false);
      setLinkVisible(uploadsLink, false);
      setLinkVisible(metaUploadsLink, false);
      setLinkVisible(uploadsOpenBtn, false);
      return;
    }

    const isHidden = typeof data.is_hidden === 'boolean' ? data.is_hidden : null;
    const isVerified = data && data.isVerified === true;
    const isOfficialArtistChannel = data && data.isOfficialArtistChannel === true;

    setRowVisible(rowVerified, isHidden !== true);
    setRowVisible(rowKeywords, isHidden !== true);
    setRowVisible(rowHandle, isHidden !== true);
    setRowVisible(rowViews, isHidden !== true);
    setRowVisible(rowVideos, isHidden !== true);
    setRowVisible(rowSubs, isHidden !== true);
    setRowVisible(rowAge, isHidden !== true);
    setRowVisible(rowCountry, isHidden !== true);
    setRowVisible(rowBlocks, isHidden !== true);
    setRowVisible(rowDesc, isHidden !== true);

    const bannerUrl = isHidden === true ? '' : (data.banner_url || '');
    if (bannerUrl) {
      profileEl.classList.remove('profile--noBanner');
      if (bannerWrap) bannerWrap.style.display = '';
      bannerImg.src = bannerUrl;
      const safeName = getNonEmptyString(data.name);
      bannerImg.alt = `${safeName || 'Channel'} banner`;
      bannerImg.style.display = 'block';
    } else {
      profileEl.classList.add('profile--noBanner');
      if (bannerWrap) bannerWrap.style.display = 'none';
      bannerImg.removeAttribute('src');
      bannerImg.alt = '';
      bannerImg.style.display = 'none';
    }

    const avatarUrl = data.avatar_url || '';
    if (avatarUrl) {
      avatarImg.src = avatarUrl;
    } else {
      avatarImg.removeAttribute('src');
    }

    {
      if (isHidden === true) {
        nameEl.textContent = 'Hidden channel';
        nameEl.classList.add('warnGlow');
      } else {
        const safeName = getNonEmptyString(data.name);
        if (safeName) {
          nameEl.textContent = safeName;
          nameEl.classList.remove('warnGlow');
        } else {
          nameEl.textContent = NO_NAME;
          nameEl.classList.add('warnGlow');
        }
      }

      if (verifiedBadgeEl) {
        const badgeType = isOfficialArtistChannel ? 'artist' : (isVerified ? 'verified' : null);
        verifiedBadgeEl.hidden = !(badgeType && isHidden !== true);
        if (badgeType === 'artist') {
          verifiedBadgeEl.src = BADGE_ARTIST;
          verifiedBadgeEl.alt = 'Official Artist Channel';
        } else if (badgeType === 'verified') {
          verifiedBadgeEl.src = BADGE_VERIFIED;
          verifiedBadgeEl.alt = 'Verified';
        }
      }
    }

    const channelUrl = data.channel_id
      ? `https://www.youtube.com/channel/${data.channel_id}`
      : (data.url || '#');
    channelLink.href = channelUrl;

    const uploadsUrl = data.uploads_playlist_url || '';
    if (uploadsUrl && isHidden !== true) {
      setRowVisible(rowUploads, true);
      uploadsLink.href = uploadsUrl;
      setLinkVisible(uploadsLink, true);

      if (metaUploadsLink) {
        metaUploadsLink.href = uploadsUrl;
        metaUploadsLink.textContent = uploadsUrl;
        setLinkVisible(metaUploadsLink, true);
      }
      if (uploadsOpenBtn) {
        uploadsOpenBtn.href = uploadsUrl;
        setLinkVisible(uploadsOpenBtn, true);
      }
    } else {
      setRowVisible(rowUploads, false);
      uploadsLink.href = '#';
      setLinkVisible(uploadsLink, false);

      if (metaUploadsLink) {
        metaUploadsLink.href = '#';
        metaUploadsLink.textContent = '—';
        setLinkVisible(metaUploadsLink, false);
      }
      if (uploadsOpenBtn) {
        uploadsOpenBtn.href = '#';
        setLinkVisible(uploadsOpenBtn, false);
      }
    }

    if (isHidden !== true) {
      if (metaVerified) {
        if (isOfficialArtistChannel) {
          metaVerified.textContent = 'Channel is an Official Artist Channel.';
        } else if (isVerified) {
          metaVerified.textContent = 'Channel is verified with the verification badge.';
        } else if (Array.isArray(data.server_warnings)) {
          const scrapeFailed = data.server_warnings.some((w) =>
            /ytInitialData|Could not parse|No script containing|parse ytInitialData|verification_scrape:/i.test(
              String(w)
            )
          );
          metaVerified.textContent = scrapeFailed
            ? 'Nie udało się odczytać odznak ze strony YouTube (zmiana HTML albo blokada). Reszta danych pochodzi z API.'
            : 'Brak odznaki weryfikacji ani Official Artist według strony kanału.';
        } else {
          metaVerified.textContent = API_VERIFIED_NOTE;
        }
      }

      if (metaKeywords) {
        const rendered = formatQuotedKeywords(data.channel_keywords);
        metaKeywords.textContent = rendered || NO_KEYWORDS;
      }

      metaHandle.textContent = data.handle ? `@${String(data.handle).replace(/^@/, '')}` : NO_HANDLE;
      metaViews.textContent = data.view_text || (data.view_count != null ? String(data.view_count) : '0');
      if (metaVideos) metaVideos.textContent = data.video_text || (data.video_count != null ? String(data.video_count) : '0');
      metaSubs.textContent = data.subscriber_text || (data.subscriber_count != null ? String(data.subscriber_count) : NO_DATA);
      metaAge.textContent = data.channel_age || NO_DATA;
      metaCountry.textContent = data.country || NO_COUNTRY;
      metaBlocks.textContent = data.country_blocks || NO_DATA;
      metaDesc.textContent = (typeof data.description === 'string' && data.description.trim()) ? data.description : NO_DESC;
    }

    metaId.textContent = data.channel_id || NO_DATA;
    metaRedirect.textContent = redirecting === null ? NO_DATA : (redirecting ? 'Yes' : 'No');

    metaHidden.textContent = isHidden === null ? NO_DATA : (isHidden ? 'Yes' : 'No');

    profileEl.hidden = false;
    syncUrlWithChannel(data);
  } catch (e) {
    if (e && e.message === 'MISSING_API_KEY') {
      updateLookupModeBanner('client', e.clientReason || 'static_only');
      statusEl.textContent =
        'Brak klucza API: ustaw YOUTUBE_DATA_API_KEY przy npm start albo YOUTUBE_DATA_API_KEY w js/lookup-config.js (tryb ograniczony).';
    } else if (
      e &&
      (e.reason === 'quotaExceeded' ||
        String(e.message || '')
          .toLowerCase()
          .includes('quota'))
    ) {
      statusEl.textContent =
        'YouTube API daily quota exceeded. Try again tomorrow or raise quota in Google Cloud Console.';
    } else {
      statusEl.textContent = e.message || String(e);
    }
    profileEl.hidden = true;
  }
}

btn.addEventListener('click', lookup);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') lookup();
});

function initLookupFromUrl() {
  const fromUrl = getIdentifierFromLocation();
  if (fromUrl && input) {
    input.value = fromUrl;
    lookup();
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initLookupFromUrl);
} else {
  initLookupFromUrl();
}

window.addEventListener('popstate', () => {
  const fromUrl = getIdentifierFromLocation();
  if (input) input.value = fromUrl;
  if (fromUrl) {
    lookup();
  } else {
    profileEl.hidden = true;
    statusEl.textContent = 'Go ahead and type something in.';
    hideLookupModeBanner();
  }
});
