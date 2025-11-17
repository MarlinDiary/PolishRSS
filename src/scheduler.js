import { config } from './config.js';
import { cacheKeys, buildFeedCacheKey, feedCache } from './cache.js';
import { generateFullTextRSS } from './rssGenerator.js';

const logPrefix = '[scheduler]';
const minutesToMs = (minutes) => minutes * 60 * 1000;
const minutesToSeconds = (minutes) => minutes * 60;

const schedulerIntervalMinutes = config.scheduler.feedRefreshIntervalMinutes;
const schedulerIntervalMs = minutesToMs(schedulerIntervalMinutes);
const schedulerTtlSeconds = Math.max(
  config.cache.feedTTL,
  minutesToSeconds(schedulerIntervalMinutes)
);

async function refreshSspaiFeed(baseUrl) {
  if (!baseUrl) {
    console.warn(`${logPrefix} Skipping refresh because service base URL is not configured.`);
    return;
  }

  console.log(`${logPrefix} Refreshing SSPAI feed cache...`);
  try {
    const rssXml = await generateFullTextRSS(baseUrl);
    const cacheKey = buildFeedCacheKey(cacheKeys.sspaiFullFeed, baseUrl);
    feedCache.set(cacheKey, rssXml, schedulerTtlSeconds);
    console.log(`${logPrefix} SSPAI feed cache updated successfully.`);
  } catch (error) {
    console.error(`${logPrefix} Failed to refresh SSPAI feed:`, error.message);
  }
}

export async function primeSspaiFeed(baseUrl) {
  await refreshSspaiFeed(baseUrl);
}

export function startSspaiFeedScheduler(baseUrl) {
  if (!config.scheduler.feedRefreshEnabled) {
    console.log(`${logPrefix} Feed refresh disabled via config.`);
    return null;
  }

  if (!baseUrl) {
    console.warn(`${logPrefix} Cannot schedule feed refresh without a service base URL.`);
    return null;
  }

  console.log(
    `${logPrefix} Scheduling SSPAI feed refresh every ${schedulerIntervalMinutes} minute(s).`
  );

  return setInterval(() => {
    refreshSspaiFeed(baseUrl);
  }, schedulerIntervalMs);
}
