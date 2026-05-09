/**
 * @param {string} apiKey
 * @param {string} endpoint
 * @param {Record<string, string | number | undefined>} params
 */
export async function youtubeDataGet(apiKey, endpoint, params) {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  u.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    u.searchParams.set(k, String(v));
  }

  const res = await fetch(u.toString(), { method: 'GET' });
  let json = {};
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (res.status === 429) {
    const err = new Error(
      json?.error?.message || 'YouTube Data API returned 429 Too Many Requests.'
    );
    err.code = 'RATE_LIMIT';
    err.status = 429;
    err.reason = json?.error?.errors?.[0]?.reason;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(json?.error?.message || `${res.status} ${res.statusText}`);
    err.code = 'YOUTUBE_API_ERROR';
    err.status = res.status;
    err.reason = json?.error?.errors?.[0]?.reason;
    throw err;
  }

  return json;
}
