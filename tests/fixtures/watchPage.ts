export interface WatchPageOptions {
  videoId: string;
  channelId?: string;
  channelName?: string;
  /** Render an explicit /channel/UC... owner link (strategy A). Default: handle link only. */
  ownerChannelLink?: boolean;
  /** Render the schema.org author microdata block, incl. identifier (enables strategies B/C). */
  headMeta?: boolean;
  /** Within the author microdata, render <link itemprop="url" href=".../channel/UC..."> (strategy C). */
  authorChannelUrl?: boolean;
  /** Render an inline ytInitialPlayerResponse script carrying videoDetails.channelId (strategy B). */
  playerResponseScript?: boolean;
  /** Render <meta itemprop="channelId"> (strategy D). */
  metaChannelId?: boolean;
  /** Make the head metadata describe a different video (stale after SPA navigation). */
  staleMetaVideoId?: string;
  chatFrameSrc?: string;
  /** Extra irrelevant iframe (e.g. an embed) to prove content scripts ignore it. */
  irrelevantFrameSrc?: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const renderOwnerBlock = (options: WatchPageOptions): string => {
  const name = escapeHtml(options.channelName ?? 'Some Channel');
  const href =
    options.ownerChannelLink && options.channelId
      ? `/channel/${options.channelId}`
      : '/@somechannel';
  return `<ytd-video-owner-renderer>
    <a id="avatar" href="${href}"></a>
    <ytd-channel-name><div id="container"><div id="text-container"><yt-formatted-string id="text"><a href="${href}">${name}</a></yt-formatted-string></div></div></ytd-channel-name>
  </ytd-video-owner-renderer>`;
};

export const renderHeadMeta = (options: WatchPageOptions): string => {
  if (!options.headMeta) return '';
  const metaVideo = options.staleMetaVideoId ?? options.videoId;
  const authorUrl =
    options.authorChannelUrl && options.channelId
      ? `<link itemprop="url" href="https://www.youtube.com/channel/${escapeHtml(options.channelId)}">`
      : '';
  return `<meta itemprop="identifier" content="${escapeHtml(metaVideo)}">
    ${options.metaChannelId && options.channelId ? `<meta itemprop="channelId" content="${escapeHtml(options.channelId)}">` : ''}
    <span itemprop="author" itemscope itemtype="http://schema.org/Person"><link itemprop="name" content="${escapeHtml(options.channelName ?? 'Some Channel')}">${authorUrl}</span>`;
};

/** Inline player-response script, mirroring how YouTube embeds videoDetails.channelId. */
export const renderPlayerResponseScript = (options: WatchPageOptions): string => {
  if (!options.playerResponseScript || !options.channelId) return '';
  const videoId = options.staleMetaVideoId ?? options.videoId;
  const json = JSON.stringify({
    responseContext: {},
    videoDetails: {
      videoId,
      title: options.channelName ?? 'Stream',
      channelId: options.channelId,
      isLiveContent: true,
    },
  });
  return `<script>var ytInitialPlayerResponse = ${json};</script>`;
};

/** Minimal watch page with an embedded Live Chat iframe and an SPA-navigation harness. */
export const renderWatchPage = (options: WatchPageOptions): string => {
  const chatSrc = options.chatFrameSrc ?? `https://www.youtube.com/live_chat?v=${options.videoId}`;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Watch</title>${renderHeadMeta(options)}
<style>body{margin:0;font-family:sans-serif}#chatframe{width:400px;height:600px;border:1px solid #ccc}</style>
</head>
<body>
${renderPlayerResponseScript(options)}
<ytd-app>
  <ytd-watch-flexy video-id="${escapeHtml(options.videoId)}">
    <div id="primary"><div id="owner">${renderOwnerBlock(options)}</div></div>
    <div id="secondary"><ytd-live-chat-frame id="chat"><iframe id="chatframe" src="${escapeHtml(chatSrc)}"></iframe></ytd-live-chat-frame></div>
    ${options.irrelevantFrameSrc ? `<iframe id="irrelevant" src="${escapeHtml(options.irrelevantFrameSrc)}"></iframe>` : ''}
  </ytd-watch-flexy>
</ytd-app>
<script>
  // SPA navigation harness: mimics YouTube swapping the video without a reload.
  window.__lcpNavigate = ({ videoId, channelId, channelName, ownerChannelLink, chatSrc }) => {
    history.pushState({}, '', '/watch?v=' + videoId);
    document.querySelector('ytd-watch-flexy').setAttribute('video-id', videoId);
    const href = ownerChannelLink && channelId ? '/channel/' + channelId : '/@somechannel';
    const owner = document.querySelector('#owner');
    owner.innerHTML = '<ytd-video-owner-renderer><a id="avatar" href="' + href + '"></a><ytd-channel-name><div id="container"><div id="text-container"><yt-formatted-string id="text"><a href="' + href + '">' + (channelName ?? 'Some Channel') + '</a></yt-formatted-string></div></div></ytd-channel-name></ytd-video-owner-renderer>';
    const frame = document.querySelector('#chatframe');
    frame.src = chatSrc ?? ('https://www.youtube.com/live_chat?v=' + videoId);
    document.dispatchEvent(new Event('yt-navigate-finish'));
  };
</script>
</body>
</html>`;
};
