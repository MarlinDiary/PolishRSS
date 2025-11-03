import express from 'express';
import { config } from './config.js';
import { generateFullTextRSS } from './rssGenerator.js';
import { generateHackerNewsRSS } from './ycombinatorGenerator.js';
import { fetchImage } from './fetcher.js';
import { feedCache, imageCache, getOrSet, clearAllCaches, getCacheStats } from './cache.js';

const app = express();

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

    const rssXml = await getOrSet(
      feedCache,
      'full-rss-feed',
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

    const rssXml = await getOrSet(
      feedCache,
      'hacker-news-feed',
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
});
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  clearAllCaches();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  clearAllCaches();
  process.exit(0);
});
