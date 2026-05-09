/**
 * @param {string} raw
 * @returns {{ error?: string, channelId?: string, handle?: string, searchQuery?: string, legacySlug?: string }}
 */
export function parseYouTubeIdentifier(raw) {
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
          error:
            'youtu.be links are usually for videos. Use a channel URL, @handle, or UC… channel id.',
        };
      }
      if (!/(^|\.)youtube\.com$/i.test(host)) return { searchQuery: s0 };

      let path = u.pathname.replace(/\/+$/, '') || '/';
      if (path.includes('/watch') && u.searchParams.get('v')) {
        return {
          error:
            'That is a video URL. Paste the channel page, @handle, or UC… channel id.',
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
