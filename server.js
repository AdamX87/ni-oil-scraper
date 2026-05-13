const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 1800 });

app.use(cors({ origin: '*' }));
app.use(express.json());

const SCRAPE_URL = 'https://www.cheapestoil.co.uk/Heating-Oil-NI?sort=1&remember=&prices=';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};

function parsePrice(str) {
  if (!str) return null;
  const val = parseFloat(str.replace(/[£,\s]/g, '').trim());
  return isNaN(val) ? null : val;
}

function parseUpdatedMins(text) {
  if (!text) return 9999;
  const t = text.toLowerCase();
  const mins = t.match(/(\d+)\s+min/);
  if (mins) return parseInt(mins[1]);
  const hrs = t.match(/(\d+)\s+hour/);
  if (hrs) return parseInt(hrs[1]) * 60;
  if (t.includes('yesterday')) return 1440;
  return 2880;
}

async function scrapeOilPrices() {
  console.log(`[${new Date().toISOString()}] Scraping...`);
  const response = await axios.get(SCRAPE_URL, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(response.data);
  const suppliers = [];
  const seen = new Set();

  $('a[href*="/distributors/"]').each((i, el) => {
    try {
      const nameEl = $(el);
      const name = nameEl.text().trim();
      if (!name || name.length < 2) return;
      if (seen.has(name)) return;

      // Walk up to find the container block
      const container = nameEl.parent();
      if (!container.length) return;

      // Get all text from the page around this link
      // Find the parent that contains postcode and price info
      let block = nameEl;
      let areas = '';
      let updatedText = '';
      const prices = [];

      // Walk up the DOM tree looking for a block with prices
      for (let level = 0; level < 8; level++) {
        block = block.parent();
        const blockText = block.text();

        // Check if this block has prices
        const priceMatches = blockText.match(/£[\d,]+(\.\d+)?/g);
        if (priceMatches && priceMatches.length >= 2) {
          // Found a block with prices - extract them
          const lines = blockText.split('\n').map(l => l.trim()).filter(l => l);

          for (const line of lines) {
            if (line.toLowerCase().startsWith('updated') && !updatedText) {
              updatedText = line;
            }
            if (/^BT\d/.test(line) && line.length < 400 && !areas) {
              areas = line;
            }
            if (/^£[\d,]+(\.\d+)?$/.test(line)) {
              const p = parsePrice(line);
              if (p && !prices.includes(p)) prices.push(p);
            }
          }

          // Also try regex directly on block text
          if (prices.length < 2) {
            const matches = blockText.match(/£([\d,]+(?:\.\d+)?)/g) || [];
            matches.forEach(m => {
              const p = parsePrice(m);
              if (p && p > 100 && p < 2000 && !prices.includes(p)) prices.push(p);
            });
          }

          if (prices.length >= 2) break;
        }
      }

      if (prices.length >= 2) {
        seen.add(name);
        const p300 = prices[0];
        const p500 = prices[1];
        const p900 = prices[2] || null;
        suppliers.push({
          name,
          areas: areas.replace(/\s+/g, ' ').trim(),
          p300, p500, p900,
          ppl300: p300 ? +((p300 / 300) * 100).toFixed(2) : null,
          ppl500: p500 ? +((p500 / 500) * 100).toFixed(2) : null,
          ppl900: p900 ? +((p900 / 900) * 100).toFixed(2) : null,
          updatedMins: parseUpdatedMins(updatedText),
          updatedText: updatedText.replace(/^updated\s*/i, '').trim(),
          updatedAt: new Date(Date.now() - parseUpdatedMins(updatedText) * 60000).toISOString(),
          sourceUrl: `https://www.cheapestoil.co.uk${nameEl.attr('href')}`,
        });
      }
    } catch (e) {
      console.error('Error parsing supplier:', e.message);
    }
  });

  console.log(`[${new Date().toISOString()}] Scraped ${suppliers.length} suppliers.`);
  return { suppliers, fetchedAt: new Date().toISOString(), source: SCRAPE_URL, count: suppliers.length };
}

async function refreshCache() {
  try {
    const data = await scrapeOilPrices();
    cache.set('prices', data);
    console.log(`Cache updated: ${data.count} suppliers`);
  } catch (err) {
    console.error('Scrape failed:', err.message);
  }
}

refreshCache();
setInterval(refreshCache, 30 * 60 * 1000);

app.get('/api/prices', async (req, res) => {
  try {
    let data = cache.get('prices');
    if (!data) { data = await scrapeOilPrices(); cache.set('prices', data); }
    let { suppliers } = data;
    const { postcode, sort, sortDir } = req.query;
    if (postcode) {
      const pc = postcode.toUpperCase().trim();
      suppliers = suppliers.filter(s => s.areas.toUpperCase().includes(pc));
    }
    const vol = ['300', '500', '900'].includes(sort) ? sort : '500';
    const dir = sortDir === 'desc' ? -1 : 1;
    suppliers = [...suppliers].sort((a, b) => ((a[`p${vol}`] || 99999) - (b[`p${vol}`] || 99999)) * dir);
    res.json({ ...data, suppliers, filteredCount: suppliers.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prices', detail: err.message });
  }
});

app.get('/api/prices/cheapest', async (req, res) => {
  try {
    let data = cache.get('prices');
    if (!data) { data = await scrapeOilPrices(); cache.set('prices', data); }
    const limit = parseInt(req.query.limit) || 5;
    res.json({
      fetchedAt: data.fetchedAt,
      cheapest: {
        '300L': [...data.suppliers].filter(s => s.p300).sort((a,b) => a.p300 - b.p300).slice(0, limit),
        '500L': [...data.suppliers].filter(s => s.p500).sort((a,b) => a.p500 - b.p500).slice(0, limit),
        '900L': [...data.suppliers].filter(s => s.p900).sort((a,b) => a.p900 - b.p900).slice(0, limit),
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/refresh', async (req, res) => {
  const secret = req.headers['x-refresh-secret'];
  if (process.env.REFRESH_SECRET && secret !== process.env.REFRESH_SECRET) return res.status(403).json({ error: 'Forbidden' });
  await refreshCache();
  const data = cache.get('prices');
  res.json({ ok: true, count: data?.count, fetchedAt: data?.fetchedAt });
});

app.get('/health', (req, res) => {
  const data = cache.get('prices');
  res.json({ status: 'ok', cacheLoaded: !!data, supplierCount: data?.count || 0, lastFetch: data?.fetchedAt || null });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
