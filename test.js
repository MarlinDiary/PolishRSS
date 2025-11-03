import axios from 'axios';

const config = {
  sspai: {
    feedUrl: 'https://sspai.com/feed',
  },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  },
};

console.log('Testing SSPAI RSS feed connectivity...\n');
console.log(`URL: ${config.sspai.feedUrl}\n`);

async function testFeed() {
  try {
    console.log('Attempting to fetch RSS feed...');
    const startTime = Date.now();

    const response = await axios.get(config.sspai.feedUrl, {
      headers: config.headers,
      timeout: 30000,
    });

    const duration = Date.now() - startTime;

    console.log(`Success. Response received in ${duration}ms`);
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content Length: ${response.data.length} bytes`);
    console.log(`\nFirst 500 characters:\n${response.data.substring(0, 500)}`);
  } catch (error) {
    console.error('Error fetching feed:');
    console.error(`  Code: ${error.code}`);
    console.error(`  Message: ${error.message}`);

    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Headers:`, error.response.headers);
    }

    console.log('\nPossible issues:');
    console.log('  - Network connectivity problems');
    console.log('  - Regional blocking');
    console.log('  - Firewall restrictions');
    console.log('  - SSPAI server issues');
  }
}

testFeed();
