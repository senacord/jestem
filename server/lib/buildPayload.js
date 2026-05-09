import { NO_DATA } from './constants.js';

function formatCompactNumber(n) {
  if (n == null || n === '') return null;
  const num = typeof n === 'string' ? parseInt(n, 10) : Number(n);
  if (Number.isNaN(num)) return String(n);
  return new Intl.NumberFormat('en', {
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
  if (days >= 30) return `${Math.floor(days / 30)} months`;
  return `${Math.max(0, days)} day${days === 1 ? '' : 's'}`;
}

function parseBrandingKeywords(keywordsString) {
  if (typeof keywordsString !== 'string' || !keywordsString.trim()) return [];
  const m = keywordsString.match(/"[^"]+"|[^\s"]+/g);
  if (m) return m.map((s) => s.replace(/^"|"$/g, '')).filter(Boolean);
  return keywordsString.split(/\s+/).filter(Boolean);
}

/**
 * @param {object} ch - channels.list item
 * @param {object} opts
 * @param {boolean} opts.isVerified
 * @param {boolean} opts.isOfficialArtistChannel
 * @param {string} opts.countryBlocksText
 * @param {string[]} [opts.countryBlockCodes]
 * @param {boolean | null} [opts.redirecting]
 * @param {string[]} [opts.warnings]
 */
export function buildChannelPayload(ch, opts) {
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
    subscriber_text = formatCompactNumber(subscriber_count) || String(st.subscriberCount);
  } else {
    subscriber_text = NO_DATA;
    subscriber_count = null;
  }

  const viewCount =
    st.viewCount != null && st.viewCount !== '' ? parseInt(String(st.viewCount), 10) : null;
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
    redirecting: opts.redirecting != null ? opts.redirecting : null,
    is_hidden,
    isVerified: opts.isVerified,
    isOfficialArtistChannel: opts.isOfficialArtistChannel,
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
    country_blocks: opts.countryBlocksText || NO_DATA,
    country_block_codes: opts.countryBlockCodes || [],
    channel_keywords,
    server_warnings: opts.warnings || [],
  };
}
