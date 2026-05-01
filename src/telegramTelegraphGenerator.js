import RSS from 'rss';
import * as cheerio from 'cheerio';
import { config } from './config.js';
import { fetchRSSFeed, fetchArticle } from './fetcher.js';
import { parseRSSFeed } from './scraper.js';
import { articleCache, getOrSet } from './cache.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveUrl(candidate, baseUrl) {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed || trimmed.toLowerCase().startsWith('data:')) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  try {
    return new URL(trimmed, baseUrl).href;
  } catch (error) {
    return trimmed;
  }
}

function cleanTitle(title) {
  return String(title || '').replace(/\s+\|\s+原文\s*$/, '').trim();
}

function findTelegraphUrl(description) {
  const $ = cheerio.load(description || '');

  const telegraphLink = $('a')
    .toArray()
    .map(link => $(link).attr('href'))
    .find(href => {
      try {
        const { hostname } = new URL(href);
        return hostname === 'telegra.ph';
      } catch (error) {
        return false;
      }
    });

  return telegraphLink || null;
}

function findOriginalUrl(description) {
  const $ = cheerio.load(description || '');

  const originalLink = $('a')
    .toArray()
    .find(link => $(link).text().trim() === '原文');

  return originalLink ? $(originalLink).attr('href') : null;
}

function normalizeTelegraphContent(html, pageUrl) {
  const $ = cheerio.load(html);
  const $article = $('article#_tl_editor.tl_article_content').first();

  if (!$article.length) {
    throw new Error('Telegraph article content not found');
  }

  $article.find('script, style, noscript').remove();
  $article.children('h1').first().remove();
  $article.children('address').first().remove();

  $article.find('a').each((_, element) => {
    const $link = $(element);
    const href = resolveUrl($link.attr('href'), pageUrl);
    if (href) {
      $link.attr('href', href);
      $link.attr('target', '_blank');
      $link.attr('rel', 'noopener noreferrer');
    }
  });

  $article.find('img').each((_, element) => {
    const $img = $(element);
    const src = resolveUrl($img.attr('src'), pageUrl);
    if (src) {
      $img.attr('src', src);
    }
    $img.attr('referrerpolicy', 'no-referrer');
  });

  const content = $article.html();
  if (!content || cheerio.load(content).text().replace(/\s+/g, '').length < 40) {
    throw new Error('Telegraph article content is empty');
  }

  return content;
}

function buildFallbackDescription(article, telegraphUrl, originalUrl) {
  const links = [];

  if (telegraphUrl) {
    links.push(
      `<a href="${escapeHtml(telegraphUrl)}" target="_blank" rel="noopener noreferrer">Read on Telegraph</a>`
    );
  }

  if (originalUrl) {
    links.push(
      `<a href="${escapeHtml(originalUrl)}" target="_blank" rel="noopener noreferrer">Original source</a>`
    );
  }

  links.push(
    `<a href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer">Telegram post</a>`
  );

  return `<p>Failed to fetch Telegraph content.</p><p>${links.join(' · ')}</p>`;
}

async function getTelegraphDescription(article) {
  const telegraphUrl = findTelegraphUrl(article.description);
  const originalUrl = findOriginalUrl(article.description);

  if (!telegraphUrl) {
    return {
      description: article.description || '',
      url: article.link,
    };
  }

  const cacheKey = `telegraph-description:${telegraphUrl}`;

  const description = await getOrSet(articleCache, cacheKey, async () => {
    try {
      const html = await fetchArticle(telegraphUrl, {
        headers: {
          Referer: 'https://telegra.ph/',
        },
      });

      const content = normalizeTelegraphContent(html, telegraphUrl);
      const links = [
        `<a href="${escapeHtml(telegraphUrl)}" target="_blank" rel="noopener noreferrer">Telegraph</a>`,
        `<a href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer">Telegram post</a>`,
      ];

      if (originalUrl) {
        links.unshift(
          `<a href="${escapeHtml(originalUrl)}" target="_blank" rel="noopener noreferrer">Original source</a>`
        );
      }

      return `${content}\n<hr>\n<p>${links.join(' · ')}</p>`;
    } catch (error) {
      console.error(`Failed to fetch Telegraph article ${telegraphUrl}:`, error.message);
      return buildFallbackDescription(article, telegraphUrl, originalUrl);
    }
  });

  return {
    description,
    url: telegraphUrl,
  };
}

export async function generateTelegramTelegraphRSS(feedKey, baseUrl) {
  const feedConfig = config.telegramFeeds[feedKey];

  if (!feedConfig) {
    throw new Error(`Unknown Telegram Telegraph feed: ${feedKey}`);
  }

  const originalRssXml = await fetchRSSFeed(feedConfig.feedUrl, {
    headers: {
      Referer: feedConfig.baseUrl,
    },
  });
  const articles = parseRSSFeed(originalRssXml);

  console.log(`Found ${articles.length} items in ${feedKey} Telegram RSS feed`);

  const feed = new RSS({
    title: feedConfig.title,
    description: feedConfig.description,
    feed_url: `${baseUrl}${feedConfig.route}`,
    site_url: feedConfig.baseUrl,
    language: 'zh-CN',
    pubDate: new Date(),
    ttl: 30,
  });

  const enrichedArticles = await Promise.all(
    articles.map(async article => {
      try {
        const { description, url } = await getTelegraphDescription(article);

        return {
          title: cleanTitle(article.title),
          description,
          url,
          guid: article.guid || article.link,
          date: article.pubDate ? new Date(article.pubDate) : new Date(),
          author: feedConfig.author,
        };
      } catch (error) {
        console.error(`Failed to process Telegram item ${article.link}:`, error.message);
        return {
          title: cleanTitle(article.title),
          description: article.description || '',
          url: article.link,
          guid: article.guid || article.link,
          date: article.pubDate ? new Date(article.pubDate) : new Date(),
          author: feedConfig.author,
        };
      }
    })
  );

  enrichedArticles.forEach(article => {
    feed.item(article);
  });

  console.log(`${feedKey} Telegram Telegraph RSS feed generated successfully`);
  return feed.xml({ indent: true });
}
