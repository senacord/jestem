import { youtubeDataGet } from './googleApi.js';
import { NO_DATA } from './constants.js';

/**
 * @param {string} apiKey
 * @param {string} uploadsPlaylistId
 * @param {number} [maxVideos]
 * @returns {Promise<{ text: string, codes: string[] }>}
 */
export async function summarizeRegionRestrictionsFromUploads(
  apiKey,
  uploadsPlaylistId,
  maxVideos = 10
) {
  if (!uploadsPlaylistId) {
    return { text: NO_DATA, codes: [] };
  }

  const cap = Math.min(Math.max(1, maxVideos), 15);
  let itemsJson;
  try {
    itemsJson = await youtubeDataGet(apiKey, 'playlistItems', {
      part: 'contentDetails,snippet',
      playlistId: uploadsPlaylistId,
      maxResults: cap,
    });
  } catch (e) {
    if (e && e.code === 'RATE_LIMIT') throw e;
    return {
      text: `${NO_DATA} (playlistItems failed: ${e instanceof Error ? e.message : String(e)})`,
      codes: [],
    };
  }

  const videoIds = [];
  for (const it of itemsJson.items || []) {
    const id = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
    if (id) videoIds.push(id);
  }
  if (!videoIds.length) {
    return { text: NO_DATA, codes: [] };
  }

  const unionBlocked = new Set();
  /** @type {Set<string>[]} */
  const allowSets = [];
  let sawAnyRestriction = false;

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    let vjson;
    try {
      vjson = await youtubeDataGet(apiKey, 'videos', {
        part: 'contentDetails',
        id: chunk.join(','),
      });
    } catch (e) {
      if (e && e.code === 'RATE_LIMIT') throw e;
      return {
        text: `${NO_DATA} (videos.list failed: ${e instanceof Error ? e.message : String(e)})`,
        codes: [...unionBlocked].sort(),
      };
    }

    for (const v of vjson.items || []) {
      const rr = v.contentDetails?.regionRestriction;
      if (!rr) continue;
      sawAnyRestriction = true;
      if (Array.isArray(rr.blocked) && rr.blocked.length) {
        for (const c of rr.blocked) unionBlocked.add(String(c).toUpperCase());
      }
      if (Array.isArray(rr.allowed) && rr.allowed.length) {
        allowSets.push(new Set(rr.allowed.map((c) => String(c).toUpperCase())));
      }
    }
  }

  if (unionBlocked.size) {
    const codes = [...unionBlocked].sort();
    return {
      text: `Blocked in at least one sampled upload: ${codes.join(', ')}`,
      codes,
    };
  }

  if (allowSets.length) {
    let inter = allowSets[0];
    for (let i = 1; i < allowSets.length; i++) {
      inter = new Set([...inter].filter((x) => allowSets[i].has(x)));
    }
    const codes = [...inter].sort();
    return {
      text: `Allowlisted-only uploads (intersection across sample): ${codes.join(', ')}`,
      codes,
    };
  }

  if (sawAnyRestriction) {
    return { text: 'Region restrictions detected but could not derive country codes.', codes: [] };
  }

  return { text: NO_DATA, codes: [] };
}
