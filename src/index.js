import express from 'express';
import { config } from './config.js';
import { generateFullTextRSS } from './rssGenerator.js';
import { generateHackerNewsRSS } from './ycombinatorGenerator.js';
import { fetchImage } from './fetcher.js';
import {
  cacheKeys,
  buildFeedCacheKey,
  feedCache,
  imageCache,
  getOrSet,
  clearAllCaches,
  getCacheStats,
} from './cache.js';
import { primeSspaiFeed, startSspaiFeedScheduler } from './scheduler.js';

const app = express();
let feedRefreshTimer = null;

const resolveServiceBaseUrl = () => {
  if (config.serviceBaseUrl) {
    return config.serviceBaseUrl;
  }

  const hostForUrl = config.host === '0.0.0.0' ? 'localhost' : config.host;
  return `http://${hostForUrl}:${config.port}`;
};

app.get('/', (req, res) => {
  res.json({
    service: 'PiRSS - SSPAI Full-Text RSS Feed',
    status: 'running',
    endpoints: {
      feed: '/sspai',
      ycombinator: '/ycombinator',
      imageProxy: '/image-proxy?url=<image_url>',
      clearCache: '/clear-cache',
      stats: '/stats',
    },
    github: 'https://github.com/yourusername/PiRSS',
  });
});

app.get('/sspai', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const cacheKey = buildFeedCacheKey(cacheKeys.sspaiFullFeed, baseUrl);

    const rssXml = await getOrSet(
      feedCache,
      cacheKey,
      () => generateFullTextRSS(baseUrl)
    );

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(rssXml);
  } catch (error) {
    console.error('Error serving RSS feed:', error);
    res.status(500).json({
      error: 'Failed to generate RSS feed',
      message: error.message,
    });
  }
});

app.get('/ycombinator', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const cacheKey = buildFeedCacheKey(cacheKeys.hackerNewsFeed, baseUrl);

    const rssXml = await getOrSet(
      feedCache,
      cacheKey,
      () => generateHackerNewsRSS(baseUrl)
    );

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(rssXml);
  } catch (error) {
    console.error('Error serving Hacker News feed:', error);
    res.status(500).json({
      error: 'Failed to generate Hacker News feed',
      message: error.message,
    });
  }
});

app.get('/image-proxy', async (req, res) => {
  try {
    const imageUrl = req.query.url;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    if (!imageUrl.includes(config.sspai.cdnDomain)) {
      return res.status(403).json({ error: 'Invalid image domain' });
    }

    const imageData = await getOrSet(
      imageCache,
      imageUrl,
      () => fetchImage(imageUrl)
    );

    res.set('Content-Type', imageData.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(imageData.data);
  } catch (error) {
    console.error('Error proxying image:', error);
    res.status(500).json({
      error: 'Failed to fetch image',
      message: error.message,
    });
  }
});

app.get('/clear-cache', (req, res) => {
  clearAllCaches();
  res.json({
    success: true,
    message: 'All caches cleared',
  });
});

app.get('/stats', (req, res) => {
  const stats = getCacheStats();
  res.json({
    cache: stats,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.listen(config.port, config.host, () => {
  console.log(`PiRSS listening on http://${config.host}:${config.port}`);
  const serviceBaseUrl = resolveServiceBaseUrl();

  primeSspaiFeed(serviceBaseUrl).catch(error => {
    console.error('Failed to prime SSPAI feed cache:', error.message);
  });
  feedRefreshTimer = startSspaiFeedScheduler(serviceBaseUrl);
});
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  clearAllCaches();
  if (feedRefreshTimer) {
    clearInterval(feedRefreshTimer);
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  clearAllCaches();
  if (feedRefreshTimer) {
    clearInterval(feedRefreshTimer);
  }
  process.exit(0);
});
