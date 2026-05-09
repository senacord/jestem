import { load } from 'cheerio';
import { YT_BROWSER_HEADERS, BADGE_VERIFIED, BADGE_ARTIST } from './constants.js';

/**
 * Pull ytInitialData from channel HTML and read ownerBadges / metadataBadgeRenderer.style.
 * @param {string} channelPageUrl
 * @returns {Promise<{ isVerified: boolean, isOfficialArtistChannel: boolean, warning?: string }>}
 */
export async function scrapeChannelVerification(channelPageUrl) {
  let res;
  try {
    res = await fetch(channelPageUrl, { headers: YT_BROWSER_HEADERS, redirect: 'follow' });
  } catch (e) {
    return {
      isVerified: false,
      isOfficialArtistChannel: false,
      warning: `Network error fetching channel page: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (res.status === 429) {
    return {
      isVerified: false,
      isOfficialArtistChannel: false,
      warning: 'YouTube returned 429 when loading the channel page (scraping). Try again later.',
    };
  }

  if (!res.ok) {
    return {
      isVerified: false,
      isOfficialArtistChannel: false,
      warning: `Channel page HTTP ${res.status} (verification scrape skipped).`,
    };
  }

  let html;
  try {
    html = await res.text();
  } catch (e) {
    return {
      isVerified: false,
      isOfficialArtistChannel: false,
      warning: `Failed to read channel HTML: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let data;
  try {
    data = extractYtInitialData(html);
  } catch (e) {
    return {
      isVerified: false,
      isOfficialArtistChannel: false,
      warning: `Could not parse ytInitialData (YouTube may have changed the page): ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }

  return walkBadges(data);
}

/**
 * @param {string} html
 * @returns {object}
 */
export function extractYtInitialData(html) {
  const $ = load(html);
  const markers = ['var ytInitialData = ', 'ytInitialData = '];

  let scriptText = '';
  $('script').each((_, el) => {
    const t = $(el).html() || '';
    for (const m of markers) {
      if (t.includes(m)) {
        scriptText = t;
        break;
      }
    }
    if (scriptText) return false;
    return undefined;
  });

  if (!scriptText) {
    throw new Error('No script containing ytInitialData found');
  }

  let jsonStr = '';
  for (const m of markers) {
    const idx = scriptText.indexOf(m);
    if (idx === -1) continue;
    const start = scriptText.indexOf('{', idx + m.length);
    if (start === -1) continue;
    jsonStr = extractBalancedJson(scriptText, start);
    if (jsonStr) break;
  }

  if (!jsonStr) {
    const fallback = scriptText.split('var ytInitialData = ')[1]?.split(';</script>')[0];
    if (fallback?.trim().startsWith('{')) {
      jsonStr = fallback.trim().replace(/;\s*$/, '');
    }
  }

  if (!jsonStr) {
    throw new Error('Could not isolate ytInitialData JSON');
  }

  return JSON.parse(jsonStr);
}

/**
 * @param {string} s
 * @param {number} startIdx index of first `{`
 */
function extractBalancedJson(s, startIdx) {
  let depth = 0;
  let inStr = false;
  let strQuote = '';
  let escaped = false;

  for (let i = startIdx; i < s.length; i++) {
    const c = s[i];

    if (inStr) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === strQuote) {
        inStr = false;
        strQuote = '';
      }
      continue;
    }

    if (c === '"' || c === "'") {
      inStr = true;
      strQuote = c;
      continue;
    }

    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        return s.slice(startIdx, i + 1);
      }
    }
  }
  return '';
}

/**
 * @param {unknown} data
 * @returns {{ isVerified: boolean, isOfficialArtistChannel: boolean, warning?: string }}
 */
function walkBadges(data) {
  let isVerified = false;
  let isOfficialArtistChannel = false;

  const visit = (node) => {
    if (node == null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }

    const badges = node.ownerBadges;
    if (Array.isArray(badges)) {
      for (const b of badges) {
        const style = b?.metadataBadgeRenderer?.style;
        if (style === BADGE_ARTIST) {
          isOfficialArtistChannel = true;
          isVerified = true;
        } else if (style === BADGE_VERIFIED) {
          isVerified = true;
        }
      }
    }

    for (const k of Object.keys(node)) {
      visit(node[k]);
    }
  };

  visit(data);
  return { isVerified, isOfficialArtistChannel };
}

/**
 * @param {string | undefined} handle
 * @param {string} channelId
 */
export function channelWatchUrlForScrape(handle, channelId) {
  const h = handle?.replace(/^@/, '').replace(/[^\w.-]/g, '');
  if (h) {
    return `https://www.youtube.com/@${h}`;
  }
  return `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`;
}
