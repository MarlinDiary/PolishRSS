const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  serviceBaseUrl: process.env.SERVICE_BASE_URL
    ? process.env.SERVICE_BASE_URL.replace(/\/$/, '')
    : null,

  sspai: {
    feedUrl: 'https://sspai.com/feed',
    baseUrl: 'https://sspai.com',
    cdnDomain: 'cdnfile.sspai.com',
  },
  hackernews: {
    feedUrl: 'https://news.ycombinator.com/rss',
    baseUrl: 'https://news.ycombinator.com',
  },
  telegramFeeds: {
    weixin: {
      feedUrl: 'https://rsshub.protoyard.com/telegram/channel/wxbyg',
      baseUrl: 'https://t.me/s/wxbyg',
      title: '微信搬运工 - Telegraph Full Text',
      description: 'Full-text Telegraph RSS feed for 微信搬运工',
      author: '微信搬运工',
      route: '/weixin',
    },
    zhihu: {
      feedUrl: 'https://rsshub.protoyard.com/telegram/channel/zhihu_bazaar',
      baseUrl: 'https://t.me/s/zhihu_bazaar',
      title: '知乎大巴扎 - Telegraph Full Text',
      description: 'Full-text Telegraph RSS feed for 知乎大巴扎',
      author: '知乎大巴扎',
      route: '/zhihu',
    },
  },

  cache: {
    feedTTL: toPositiveNumber(process.env.FEED_CACHE_TTL, 3600),
    articleTTL: toPositiveNumber(process.env.ARTICLE_CACHE_TTL, 3600),
    imageTTL: toPositiveNumber(process.env.IMAGE_CACHE_TTL, 86400),
  },
  timeouts: {
    feed: toPositiveNumber(process.env.FEED_REQUEST_TIMEOUT, 60000),
    article: toPositiveNumber(process.env.ARTICLE_REQUEST_TIMEOUT, 30000),
    image: toPositiveNumber(process.env.IMAGE_REQUEST_TIMEOUT, 15000),
  },
  scheduler: {
    feedRefreshEnabled: process.env.FEED_REFRESH_ENABLED !== 'false',
    feedRefreshIntervalMinutes: toPositiveNumber(
      process.env.FEED_REFRESH_INTERVAL_MINUTES,
      60
    ),
  },

  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://sspai.com/',
  },
};
