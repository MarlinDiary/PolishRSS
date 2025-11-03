import axios from 'axios';
import { config } from './config.js';

async function retryWithBackoff(fn, maxRetries = 3) {
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
        timeout: 30000,
      })
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching RSS feed:', error.message);
    throw new Error('Failed to fetch RSS feed');
  }
}

export async function fetchArticle(url) {
  try {
    const response = await retryWithBackoff(() =>
      axios.get(url, {
        headers: config.headers,
        timeout: 20000,
      })
    );
    return response.data;
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
      timeout: 15000,
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
