export const config = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',

  sspai: {
    feedUrl: 'https://sspai.com/feed',
    baseUrl: 'https://sspai.com',
    cdnDomain: 'cdnfile.sspai.com',
  },
  hackernews: {
    feedUrl: 'https://news.ycombinator.com/rss',
    baseUrl: 'https://news.ycombinator.com',
  },

  cache: {
    feedTTL: 1800,
    articleTTL: 3600,
    imageTTL: 86400,
  },

  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://sspai.com/',
  },
};
