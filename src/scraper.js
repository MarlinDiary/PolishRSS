import * as cheerio from 'cheerio';
import { fetchArticle } from './fetcher.js';
import { config } from './config.js';

export function parseRSSFeed(rssXml) {
  const $ = cheerio.load(rssXml, { xmlMode: true });
  const items = [];

  $('item').each((_, element) => {
    const $item = $(element);
    items.push({
      title: $item.find('title').text(),
      link: $item.find('link').text(),
      pubDate: $item.find('pubDate').text(),
      author: $item.find('author').text(),
      guid: $item.find('guid').text(),
    });
  });

  return items;
}

export async function scrapeArticleContent(url) {
  try {
    const html = await fetchArticle(url);
    const $ = cheerio.load(html);

    let content = '';

    const selectors = [
      'article .article-content',
      'article .content',
      '.article-body',
      '.post-content',
      '[class*="article-content"]',
      '[class*="post-content"]',
    ];

    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.html();
        break;
      }
    }

    if (!content) {
      const scriptTags = $('script[type="application/ld+json"]');
      scriptTags.each((_, element) => {
        try {
          const jsonData = JSON.parse($(element).html());
          if (jsonData['@type'] === 'Article' && jsonData.articleBody) {
            content = jsonData.articleBody;
          }
        } catch (e) {}
      });
    }

    if (!content) {
      const article = $('article');
      if (article.length > 0) {
        content = article.html();
      }
    }

    if (!content) {
      throw new Error('Could not find article content');
    }

    const $content = cheerio.load(content);
    $content('img').each((_, img) => {
      const $img = $content(img);
      const src = $img.attr('src');
      if (src && src.includes(config.sspai.cdnDomain)) {
        const proxyUrl = `/image-proxy?url=${encodeURIComponent(src)}`;
        $img.attr('src', proxyUrl);
      }
    });

    return $content.html();
  } catch (error) {
    console.error(`Error scraping article ${url}:`, error.message);
    return `<p>Failed to fetch full article content. <a href="${url}">Read on SSPAI</a></p>`;
  }
}

export function extractMetadata(html) {
  const $ = cheerio.load(html);

  const scriptTags = $('script[type="application/ld+json"]');
  let metadata = {};

  scriptTags.each((_, element) => {
    try {
      const jsonData = JSON.parse($(element).html());
      if (jsonData['@type'] === 'Article') {
        metadata = {
          title: jsonData.headline,
          author: jsonData.author?.name,
          datePublished: jsonData.datePublished,
          description: jsonData.description,
        };
      }
    } catch (e) {}
  });

  return metadata;
}
