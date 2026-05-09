import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';

import { youtubeDataGet } from './lib/googleApi.js';
import { resolveChannelId } from './lib/resolveChannelId.js';
import { scrapeChannelVerification, channelWatchUrlForScrape } from './lib/scrapeVerification.js';
import { summarizeRegionRestrictionsFromUploads } from './lib/regionBlocks.js';
import { buildChannelPayload } from './lib/buildPayload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

/** Load .env from project root if YOUTUBE_DATA_API_KEY is not already set. */
function loadEnvFromDotEnv() {
  if (process.env.YOUTUBE_DATA_API_KEY?.trim()) return;
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key === 'YOUTUBE_DATA_API_KEY' && val) {
      process.env.YOUTUBE_DATA_API_KEY = val;
      break;
    }
  }
}

loadEnvFromDotEnv();

const app = express();
const PORT = Number(process.env.PORT) || 3333;

app.use(cors());
app.use(express.json());

app.use(express.static(rootDir));

app.get('/api/channel', async (req, res) => {
  const identifier = String(req.query.identifier ?? req.query.q ?? '').trim();
  if (!identifier) {
    return res.status(400).json({
      ok: false,
      code: 'BAD_REQUEST',
      message: 'Missing identifier or q query parameter.',
    });
  }

  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      code: 'NO_API_KEY',
      message:
        'Server missing YOUTUBE_DATA_API_KEY. Set the env var and restart (see .env.example).',
    });
  }

  try {
    const channelId = await resolveChannelId(identifier, apiKey);

    const chJson = await youtubeDataGet(apiKey, 'channels', {
      part: 'snippet,statistics,brandingSettings,contentDetails,status,topicDetails',
      id: channelId,
    });

    const ch = chJson.items?.[0];
    if (!ch) {
      return res.status(404).json({
        ok: false,
        code: 'NOT_FOUND',
        message: 'Channel not found',
      });
    }

    const handle = ch.snippet?.customUrl
      ? String(ch.snippet.customUrl).replace(/^@/, '')
      : '';
    const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads || '';
    const scrapeUrl = channelWatchUrlForScrape(handle || undefined, channelId);

    const warnings = [];

    let ver = {
      isVerified: false,
      isOfficialArtistChannel: false,
      warning: undefined,
    };
    let regions = { text: '', codes: [] };

    try {
      ;[ver, regions] = await Promise.all([
        scrapeChannelVerification(scrapeUrl),
        summarizeRegionRestrictionsFromUploads(apiKey, uploadsId, 10),
      ]);
    } catch (e) {
      if (e && e.code === 'RATE_LIMIT') {
        return res.status(429).json({
          ok: false,
          code: 'RATE_LIMIT',
          message: e.message || 'YouTube Data API rate limited (429).',
        });
      }
      throw e;
    }

    if (ver.warning) warnings.push(`verification_scrape: ${ver.warning}`);

    const data = buildChannelPayload(ch, {
      isVerified: ver.isVerified,
      isOfficialArtistChannel: ver.isOfficialArtistChannel,
      countryBlocksText: regions.text,
      countryBlockCodes: regions.codes,
      redirecting: null,
      warnings,
    });

    return res.json({ ok: true, data });
  } catch (e) {
    if (e && e.code === 'RATE_LIMIT') {
      return res.status(429).json({
        ok: false,
        code: 'RATE_LIMIT',
        message: e.message || 'YouTube Data API rate limited (429).',
      });
    }

    const message = e instanceof Error ? e.message : String(e);
    const notFound =
      /not found|no channel matches|channel not found/i.test(message) ||
      message.includes('Enter something');
    if (notFound) {
      return res.status(404).json({
        ok: false,
        code: 'NOT_FOUND',
        message,
      });
    }

    const status =
      e && e.status && typeof e.status === 'number' && e.status >= 400 && e.status < 600
        ? e.status
        : 500;

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      ok: false,
      code: e?.code || 'LOOKUP_ERROR',
      message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Lookup server http://localhost:${PORT}  (static + /api/channel)`);
});
