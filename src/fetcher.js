import axios from 'axios';
import { config } from './config.js';

export async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function fetchOriginalRSS() {
  try {
    const response = await retryWithBackoff(() =>
      axios.get(config.sspai.feedUrl, {
        headers: config.headers,
        timeout: config.timeouts.feed,
      })
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching RSS feed:', error.message);
    throw new Error('Failed to fetch RSS feed');
  }
}

export async function fetchHackerNewsRSS() {
  try {
    const response = await retryWithBackoff(() =>
      axios.get(config.hackernews.feedUrl, {
        headers: {
          ...config.headers,
          Referer: config.hackernews.baseUrl,
        },
        timeout: config.timeouts.feed,
      })
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching Hacker News RSS:', error.message);
    throw new Error('Failed to fetch Hacker News RSS feed');
  }
}

export async function fetchArticle(url, options = {}) {
  const {
    headers: extraHeaders = {},
    timeout = config.timeouts.article,
    allowedContentTypes = [
      'text/html',
      'application/xhtml+xml',
      'text/plain',
      'application/xml',
      'text/xml',
    ],
  } = options;

  const headers = {
    ...config.headers,
    ...extraHeaders,
  };

  Object.keys(headers).forEach(key => {
    if (headers[key] === undefined) {
      delete headers[key];
    }
  });

  try {
    const response = await retryWithBackoff(() =>
      axios.get(url, {
        headers,
        timeout,
        responseType: 'arraybuffer',
        validateStatus: status => status >= 200 && status < 400,
      })
    );

    const contentType = (response.headers['content-type'] || '').toLowerCase();
    const isAllowedType = allowedContentTypes.some(type => contentType.includes(type));
    if (!isAllowedType) {
      throw new Error(`Unsupported content type: ${contentType || 'unknown'}`);
    }

    const charsetMatch = contentType.match(/charset=([^;]+)/i);
    const encoding = (charsetMatch ? charsetMatch[1] : 'utf-8').trim().toLowerCase();
    try {
      return Buffer.from(response.data).toString(encoding === 'iso-8859-1' ? 'latin1' : encoding);
    } catch (error) {
      console.warn(`Falling back to utf-8 decoding for ${url}:`, error.message);
      return Buffer.from(response.data).toString('utf-8');
    }
  } catch (error) {
    console.error(`Error fetching article ${url}:`, error.message);
    throw new Error(`Failed to fetch article: ${url}`);
  }
}

export async function fetchImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      headers: {
        ...config.headers,
        'Referer': 'https://sspai.com/',
      },
      responseType: 'arraybuffer',
      timeout: config.timeouts.image,
    });

    return {
      data: response.data,
      contentType: response.headers['content-type'] || 'image/jpeg',
    };
  } catch (error) {
    console.error(`Error fetching image ${imageUrl}:`, error.message);
    throw new Error('Failed to fetch image');
  }
}
