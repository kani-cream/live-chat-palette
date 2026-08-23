export interface VideoContext {
  videoId?: string;
  channelId?: string;
  channelName?: string;
}

export const CHANNEL_ID_PATTERN = /^UC[\w-]{22}$/;
export const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

export const isChannelId = (value: unknown): value is string =>
  typeof value === 'string' && CHANNEL_ID_PATTERN.test(value);

export const isVideoId = (value: unknown): value is string =>
  typeof value === 'string' && VIDEO_ID_PATTERN.test(value);

export const isVideoContext = (value: unknown): value is VideoContext => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.videoId !== undefined && !isVideoId(v.videoId)) return false;
  if (v.channelId !== undefined && !isChannelId(v.channelId)) return false;
  if (v.channelName !== undefined && typeof v.channelName !== 'string') return false;
  return true;
};

export const sameContext = (a: VideoContext | null, b: VideoContext | null): boolean =>
  a?.videoId === b?.videoId && a?.channelId === b?.channelId && a?.channelName === b?.channelName;
