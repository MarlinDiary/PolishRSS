import NodeCache from 'node-cache';
import { config } from './config.js';

export const cacheKeys = {
  sspaiFullFeed: 'full-rss-feed',
  hackerNewsFeed: 'hacker-news-feed',
};

export const buildFeedCacheKey = (key, baseUrl) => {
  const normalizedBase = (baseUrl || '').replace(/\/$/, '');
  return `${key}:${normalizedBase}`;
};

export const feedCache = new NodeCache({
  stdTTL: config.cache.feedTTL,
  checkperiod: 120,
});

export const articleCache = new NodeCache({
  stdTTL: config.cache.articleTTL,
  checkperiod: 300,
});

export const imageCache = new NodeCache({
  stdTTL: config.cache.imageTTL,
  checkperiod: 600,
});

export async function getOrSet(cache, key, generator) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    console.log(`Cache hit: ${key}`);
    return cached;
  }

  console.log(`Cache miss: ${key}, generating...`);
  const value = await generator();

  cache.set(key, value);
  return value;
}

export function clearAllCaches() {
  feedCache.flushAll();
  articleCache.flushAll();
  imageCache.flushAll();
  console.log('All caches cleared');
}

export function getCacheStats() {
  return {
    feed: feedCache.getStats(),
    article: articleCache.getStats(),
    image: imageCache.getStats(),
  };
}
