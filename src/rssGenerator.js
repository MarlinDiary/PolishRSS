import RSS from 'rss';
import { fetchOriginalRSS } from './fetcher.js';
import { parseRSSFeed, scrapeArticleContent } from './scraper.js';
import { config } from './config.js';

export async function generateFullTextRSS(baseUrl) {
  try {
    const originalRssXml = await fetchOriginalRSS();
    const articles = parseRSSFeed(originalRssXml);

    console.log(`Found ${articles.length} articles in RSS feed`);

    const feed = new RSS({
      title: 'SSPAI (少数派) - Full Text Feed',
      description: 'Full-text RSS feed for SSPAI articles with image proxy',
      feed_url: `${baseUrl}/feed`,
      site_url: config.sspai.baseUrl,
      language: 'zh-CN',
      pubDate: new Date(),
      ttl: 30,
    });

    const articlePromises = articles.map(async (article) => {
      try {
        console.log(`Scraping article: ${article.title}`);

        let fullContent = await scrapeArticleContent(article.link);

        fullContent = fullContent.replace(
          /src="\/image-proxy/g,
          `src="${baseUrl}/image-proxy`
        );

        return {
          title: article.title,
          description: fullContent,
          url: article.link,
          guid: article.guid || article.link,
          date: article.pubDate ? new Date(article.pubDate) : new Date(),
          author: article.author,
        };
      } catch (error) {
        console.error(`Failed to scrape ${article.link}:`, error.message);

        return {
          title: article.title,
          description: `<p>Failed to fetch full content. <a href="${article.link}">Read on SSPAI</a></p>`,
          url: article.link,
          guid: article.guid || article.link,
          date: article.pubDate ? new Date(article.pubDate) : new Date(),
          author: article.author,
        };
      }
    });

    const enrichedArticles = await Promise.all(articlePromises);

    enrichedArticles.forEach(article => {
      feed.item(article);
    });

    console.log('RSS feed generated successfully');
    return feed.xml({ indent: true });
  } catch (error) {
    console.error('Error generating RSS feed:', error.message);
    throw error;
  }
}
