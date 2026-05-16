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
const BASE_URL = 'https://www.cheapestoil.co.uk';

// Manual website overrides
const WEBSITE_OVERRIDES = {
  'ah fuel oils': 'https://www.ahfueloils.com',
  'alfa oils belfast': 'https://www.alfaoils.co.uk',
  'alfa oils carrickfergus': 'https://www.alfaoils.co.uk',
  'alfa oils craigavon': 'https://www.alfaoils.co.uk',
  'ballynahinch fuel': 'https://www.ballynahinchfuel.com',
  'banbridge fuels': 'https://www.banbridgefuels.com',
  'bangor fuels': 'https://www.bangorfuels.com',
  'belfast and down oil': 'https://www.belfastdownoil.co.uk',
  'blackhill energy': 'https://www.blackhillenergy.net',
  'campsie fuels': 'https://www.campsiefuels.com',
  'capper trading': 'https://www.cappertrading.com',
  'casey oils': 'https://www.caseyoils.com',
  'castlereagh fuels': 'http://www.castlereaghfuels.com',
  'cb fuels': 'https://www.cbfuels.co.uk',
  'cbs fuels': 'https://www.cbsfuels.co.uk',
  'cheaper oil - belfast': 'https://www.cheaperoil.com',
  'cheaper oil - derry': 'https://www.cheaperoil.com',
  'cheaper oil - down': 'https://www.cheaperoil.com',
  'click oil': 'https://www.clickoil.co.uk',
  'cross county fuels': 'https://www.crosscountyfuels.net',
  'discount oil': 'https://www.discountoil.co.uk',
  'doherty firewood and fuels': 'https://www.dohertygroup.ie',
  'donnelly fuels': 'https://www.donnellyfuels.co.uk',
  'finney brothers': 'https://www.finneybrothers.co.uk',
  'first choice fuels-craigavon': 'https://www.firstchoicefuels.com',
  'first choice fuels-dungannon': 'https://www.firstchoicefuels.com',
  'freemans fuels': 'https://www.freemansfuels.co.uk',
  'fuel direct': 'https://www.fueldirect.co.uk',
  'fuels and lubricants': 'https://www.fandl.co.uk',
  'heat direct belfast': 'https://www.heatdirectni.com',
  'heat direct craigavon': 'https://www.heatdirectni.com',
  'heat direct lisburn': 'https://www.heatdirectni.com',
  'heat direct banbridge': 'https://www.heatdirectni.com',
  'jennings fuels': 'https://www.jenningsfuels.com',
  'kelly oils': 'https://www.kellyfuels.com',
  'kerr fuels': 'https://www.kerrfuels.com',
  'lagan oils': 'https://www.laganoils.com',
  'lagan oils carrick': 'https://www.laganoils.com',
  'lagan oils glenavy': 'https://www.laganoils.com',
  'lcc oil online ballymena': 'https://www.lcc-group.co.uk',
  'lcc oil online cookstown': 'https://www.lcc-group.co.uk',
  'lisburn city oil': 'https://www.lisburncityoil.co.uk',
  'lisburn fuels': 'https://www.lisburnfuels.com',
  'lisburn fuels belfast': 'https://www.lisburnfuels.com',
  'lisburn fuels mid ulster': 'https://www.lisburnfuels.com',
  'mcginleys gas and oil': 'https://mcginleysoil.com',
  'mchugh fuels': 'https://www.mchughfuels.com',
  'mk domestics': 'https://www.mkdomestics.com',
  'morgan fuels newry': 'https://www.morganfuels.com',
  'new city fuels': 'https://newcityfuels.co.uk',
  'nicholl oil online ballymena': 'https://nicholl247.com',
  'nicholl oil online dungannon': 'https://nicholl247.com',
  'nicholl oil online omagh': 'https://nicholl247.com',
  'pj fuels': 'https://www.pjfuels.com',
  'portadown oil supplies': 'https://www.portadownoil.com',
  'port fuels': 'https://portfuelsni.com',
  'premier fuels': 'https://www.premierfuels.net',
  'r w sloane fuels': 'https://rwsloanefuels.com',
  'riverside oils': 'https://riversideoils.co.uk',
  'robinson fuels': 'https://www.robinsonfuels.co.uk',
  'save oils': 'https://saveoils.com',
  'scotts fuels': 'https://www.scottsfuels.com',
  'scotts fuels lderry': 'https://www.scottsfuels.com',
  'scotts fuels northwest': 'https://www.scottsfuels.com',
  'six mile fuels': 'https://www.sixmilefuelsltd.com',
  'springtown fuels': 'https://www.springtownfuels.com',
  'stanley gordon fuels': 'https://stanleygordonfuels.co.uk',
  'star fuels': 'https://starfuels.co.uk',

  'top oil newry': 'https://www.topoil.co.uk',
  'tweed fuels': 'https://tweeds.co.uk',
  'urgent oil': 'https://www.urgentoil.com',
  'vale fuels': 'https://valefuels.com',
  'wise oil': 'https://www.wiseoil.com',
  'beckett fuels': 'https://www.beckettfuels.com/',
  'carlisle fuels': 'https://www.carlislefuels.com/',
  'solo direct': 'https://www.solodirect.co.uk/',
  'oil direct': 'https://www.oildirectni.co.uk/',
  'fuels4you': 'https://www.fuels4you.co.uk/',
  'theoilco': 'https://theoil.co/',
  'theoilco craigavon': 'https://theoil.co/',
  'theoilco lisburn': 'https://theoil.co/',
  'theoilco newtownabbey': 'https://theoil.co/',
};

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

async function scrapeSupplierDetails(url) {
  try {
    const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(response.data);
    const text = $('body').text();

    const phoneRegex = /(\+44\s?)?(\(0\))?\s?(028|07\d{3}|02\d{2})\s?\d{3,4}\s?\d{3,4}/g;
    const phones = [];
    let match;
    while ((match = phoneRegex.exec(text)) !== null) {
      const phone = match[0].trim().replace(/\s+/g, ' ');
      if (!phones.includes(phone)) phones.push(phone);
    }

    $('a[href^="tel:"]').each((_, el) => {
      const tel = $(el).attr('href').replace('tel:', '').trim();
      if (tel && !phones.includes(tel)) phones.push(tel);
    });

    // Blocked domains — skip these and only return the supplier's own website
    const blockedDomains = [
      'cheapestoil.co.uk', 'facebook.com', 'twitter.com', 'instagram.com',
      'youtube.com', 'linkedin.com', 'google.com', 'googleapis.com',
      'gstatic.com', 'cloudflare.com', 'jquery.com', 'bootstrapcdn.com',
      'niheatingoil.co.uk', 'amazon.co.uk', 'amazon.com',
    ];

    let website = '';
    $('a[href^="http"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || website) return;
      const isBlocked = blockedDomains.some(d => href.includes(d));
      // Must look like a real business website (has a dot in domain, not just a path)
      const looksReal = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(href);
      if (!isBlocked && looksReal) {
        website = href;
      }
    });

    let email = '';
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) email = emailMatch[0];

    return { phone: phones[0] || null, allPhones: phones, website: website || null, email: email || null };
  } catch (err) {
    return { phone: null, allPhones: [], website: null, email: null };
  }
}

async function scrapeOilPrices() {
  console.log(`[${new Date().toISOString()}] Scraping main list...`);
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

      let block = nameEl;
      let areas = '';
      let updatedText = '';
      const prices = [];

      for (let level = 0; level < 8; level++) {
        block = block.parent();
        const blockText = block.text();
        const priceMatches = blockText.match(/£[\d,]+(\.\d+)?/g);
        if (priceMatches && priceMatches.length >= 2) {
          const lines = blockText.split('\n').map(l => l.trim()).filter(l => l);
          for (const line of lines) {
            if (line.toLowerCase().startsWith('updated') && !updatedText) updatedText = line;
            if (/^BT\d/.test(line) && line.length < 400 && !areas) areas = line;
            if (/^£[\d,]+(\.\d+)?$/.test(line)) {
              const p = parsePrice(line);
              if (p && !prices.includes(p)) prices.push(p);
            }
          }
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
        const href = nameEl.attr('href');
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
          sourceUrl: `${BASE_URL}${href}`,
          slug: href ? href.replace('/distributors/', '').replace(/\//g, '').toLowerCase() : name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          phone: null,
          website: WEBSITE_OVERRIDES[name.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/s+/g, ' ')] || WEBSITE_OVERRIDES[name.toLowerCase().trim()] || null,
          email: null,
        });
      }
    } catch (e) {}
  });

  console.log(`Found ${suppliers.length} suppliers. Scraping phone numbers...`);

  const batchSize = 5;
  for (let i = 0; i < suppliers.length; i += batchSize) {
    const batch = suppliers.slice(i, i + batchSize);
    await Promise.all(batch.map(async (supplier) => {
      if (supplier.sourceUrl && supplier.sourceUrl.includes('/distributors/')) {
        const details = await scrapeSupplierDetails(supplier.sourceUrl);
        supplier.phone = details.phone;
        supplier.allPhones = details.allPhones;
        // Only use scraped website if no manual override exists
          if (!supplier.website) supplier.website = details.website;
        supplier.email = details.email;
      }
    }));
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`Done. ${suppliers.filter(s => s.phone).length}/${suppliers.length} suppliers have phone numbers.`);
  return { suppliers, fetchedAt: new Date().toISOString(), source: SCRAPE_URL, count: suppliers.length };
}

async function refreshCache() {
  try {
    const data = await scrapeOilPrices();
    cache.set('prices', data);
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

app.get('/api/supplier/:slug', async (req, res) => {
  try {
    let data = cache.get('prices');
    if (!data) { data = await scrapeOilPrices(); cache.set('prices', data); }
    const supplier = data.suppliers.find(s => s.slug === req.params.slug);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
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
