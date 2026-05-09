/**
 * Payload returned by GET /api/channel and used by lookup UI.
 */
export interface ChannelLookupPayload {
  redirecting: boolean | null;
  is_hidden: boolean;
  isVerified: boolean;
  isOfficialArtistChannel: boolean;
  name: string;
  handle: string;
  description: string;
  channel_id: string;
  url: string;
  banner_url: string;
  avatar_url: string;
  uploads_playlist_url: string;
  view_count: number | null;
  view_text: string;
  video_count: number | null;
  video_text: string;
  subscriber_count: number | null;
  subscriber_text: string;
  channel_age: string;
  country: string;
  country_blocks: string;
  country_block_codes?: string[];
  channel_keywords: string[];
  server_warnings?: string[];
}
