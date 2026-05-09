import { youtubeDataGet } from './googleApi.js';
import { parseYouTubeIdentifier } from './parseIdentifier.js';

/**
 * @param {string} identifier
 * @param {string} apiKey
 * @returns {Promise<string>}
 */
export async function resolveChannelId(identifier, apiKey) {
  const parsed = parseYouTubeIdentifier(identifier);
  if (parsed.error) throw new Error(parsed.error);
  if (parsed.channelId) return parsed.channelId;

  if (parsed.handle) {
    try {
      const json = await youtubeDataGet(apiKey, 'channels', {
        part: 'id',
        forHandle: parsed.handle,
      });
      if (json.items?.[0]?.id) return json.items[0].id;
    } catch {
      // forHandle may fail; fall through to search
    }
    const searchJson = await youtubeDataGet(apiKey, 'search', {
      part: 'snippet',
      type: 'channel',
      q: parsed.handle,
      maxResults: 5,
    });
    const cid = firstSearchChannelId(searchJson);
    if (cid) return cid;
    throw new Error('No channel found for that handle');
  }

  if (parsed.searchQuery || parsed.legacySlug) {
    const q = parsed.searchQuery || parsed.legacySlug || '';
    const searchJson = await youtubeDataGet(apiKey, 'search', {
      part: 'snippet',
      type: 'channel',
      q,
      maxResults: 5,
    });
    const cid = firstSearchChannelId(searchJson);
    if (!cid) throw new Error('No channel matches that search');
    return cid;
  }

  throw new Error('Enter a channel URL, @handle, or channel ID');
}

/**
 * @param {import('./googleApi.js').any} json
 */
function firstSearchChannelId(json) {
  for (const item of json.items || []) {
    const cid = item?.id?.channelId;
    if (cid && /^UC[\w-]{22}$/i.test(cid)) return cid;
  }
  return null;
}
