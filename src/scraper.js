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

    // Try multiple selectors in order of specificity
    const selectors = [
      // SSPAI specific selectors
      '.article__main__content',
      '.article__main__wrapper',
      '.article-body',
      '.article-detail',
      '.article-content',
      '.content-body',
      '.post-content',
      '.entry-content',

      // Generic article selectors
      '[class*="article__main__"]',
      '[class*="article-body"]',
      '[class*="article-content"]',
      '[class*="post-content"]',
      'article .body',
      'article .content',
      'article > div',
      'main article',
      '[data-type="article"]',

      // Editor-specific selectors
      '.ql-editor',
      '.markdown-body',

      // Wildcard selectors (last resort)
      '[class*="content"]',
      '[class*="article"]',
      '[class*="post"]',
    ];

    // Try each selector and verify content length
    for (const selector of selectors) {
      const elements = $(selector);
      if (!elements.length) {
        continue;
      }

      let found = false;

      elements.each((_, el) => {
        if (found) {
          return false;
        }

        const $el = $(el);
        const fragment = $el.html();
        if (!fragment) {
          return;
        }

        const textLength = $el.text().replace(/\s+/g, '').length;
        const paragraphCount = $el.find('p').length;
        const figureCount = $el.find('figure').length;

        if (paragraphCount === 0 && figureCount === 0 && textLength < 200) {
          return;
        }

        content = fragment;
        found = true;
        return false;
      });

      if (found) {
        console.log(`✓ Found content using selector: ${selector}`);
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

    // Fallback 3: Try entire article tag
    if (!content) {
      const article = $('article');
      if (article.length > 0) {
        const tempContent = article.html();
        if (tempContent) {
          const $articleContent = cheerio.load(tempContent);
          const articleTextLength = $articleContent.text().replace(/\s+/g, '').length;
          const articleHasBlocks = $articleContent('p').length > 0 || $articleContent('figure').length > 0;
          if (articleHasBlocks || articleTextLength > 200) {
            content = tempContent;
            console.log('✓ Using entire <article> tag');
          }
        }
      }
    }

    // Fallback 4: Try main tag
    if (!content) {
      const main = $('main');
      if (main.length > 0) {
        const tempContent = main.html();
        if (tempContent) {
          const $mainContent = cheerio.load(tempContent);
          const mainTextLength = $mainContent.text().replace(/\s+/g, '').length;
          const mainHasBlocks = $mainContent('p').length > 0 || $mainContent('figure').length > 0;
          if (mainHasBlocks || mainTextLength > 200) {
            content = tempContent;
            console.log('✓ Using <main> tag');
          }
        }
      }
    }

    // Fallback 5: Collect all paragraph tags (last resort)
    if (!content) {
      const paragraphs = $('p');
      if (paragraphs.length > 3) {
        let collected = '';
        paragraphs.each((_, p) => {
          collected += $(p).toString();
        });
        if (collected.length > 200) {
          content = collected;
          console.log(`✓ Collected ${paragraphs.length} paragraphs`);
        }
      }
    }

    if (!content) {
      console.error('✗ No content found with any selector');
      console.error(`Debug info for ${url}:`);
      console.error(`  - <article> tags: ${$('article').length}`);
      console.error(`  - <main> tags: ${$('main').length}`);
      console.error(`  - <p> tags: ${$('p').length}`);
      console.error(`  - divs with "content": ${$('[class*="content"]').length}`);
      console.error(`  - divs with "article": ${$('[class*="article"]').length}`);
      console.error(`  - Page title: ${$('title').text()}`);
      throw new Error('Could not find article content');
    }

    const $content = cheerio.load(content);

    // Clean up unwanted elements before processing
    // Remove emoji/reaction buttons (including Vue components)
    $content('.emoji').remove();
    $content('.comp__Emoji').remove();
    $content('[class*="emoji"]').remove();
    $content('[class*="Emoji"]').remove();
    // Remove any div with data-v attributes and class containing "emoji"
    $content('div[class*="emoji"][data-v-]').remove();
    $content('img[alt*="emoji"]').parent().remove();

    // Remove comment sections
    $content('.comments').remove();
    $content('.comment-section').remove();
    $content('[class*="comment"]').remove();

    // Remove reaction/interaction elements
    $content('.reactions').remove();
    $content('.interaction').remove();
    $content('[class*="reaction"]').remove();

    // Remove ads and promotions
    $content('.ad').remove();
    $content('.advertisement').remove();
    $content('[class*="promo"]').remove();

    // Remove navigation and sidebars
    $content('nav').remove();
    $content('.sidebar').remove();
    $content('.side-bar').remove();

    // Remove social share buttons
    $content('.share').remove();
    $content('.social-share').remove();
    $content('[class*="share"]').remove();

    // Remove author cards and related articles (often at the end)
    $content('.author-card').remove();
    $content('.related-articles').remove();
    $content('[class*="related"]').remove();

    // Remove scripts, styles, and other non-content elements
    $content('script').remove();
    $content('style').remove();
    $content('noscript').remove();
    $content('iframe').remove(); // Remove embedded iframes (can add back if needed)

    // Remove headers and footers if they got included
    $content('header').remove();
    $content('footer').remove();

    // Clean up Vue.js data attributes from all remaining elements
    $content('*').each((_, el) => {
      const $el = $content(el);
      const attrs = Object.keys(el.attribs || {});
      attrs.forEach(attr => {
        // Remove Vue data attributes (data-v-xxxxx)
        if (attr.startsWith('data-v-')) {
          $el.removeAttr(attr);
        }
      });
    });

    // Process images - replace with proxy URLs
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
