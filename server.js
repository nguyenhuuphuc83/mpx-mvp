// MVP Backend - Template-Based Data Collection System
// Can be deployed to Vercel, Railway, or any Node.js hosting

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (replace with database later)
let intelligence_data = [];
let companies_data = [];
let deals_data = [];

// Sample data templates
const DATA_TEMPLATES = {
  techcrunch_rss: {
    type: 'api',
    url: 'https://techcrunch.com/feed/',
    category: 'industry_news',
    extract: {
      title: 'title',
      content: 'description',
      date: 'pubDate',
      link: 'link'
    }
  },
  
  company_crawler: {
    type: 'crawler',
    url_template: 'https://www.crunchbase.com/organization/{company_slug}',
    category: 'company_intelligence',
    selectors: {
      funding_stage: '.funding-stage',
      total_funding: '.total-funding',
      employee_count: '.employee-count',
      last_funding: '.last-funding-date'
    }
  },

  ycombinator_api: {
    type: 'api',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    category: 'startup_news',
    extract: {
      story_ids: 'array'
    }
  }
};

// Data collection functions
async function collectFromAPI(template, params = {}) {
  try {
    const response = await axios.get(template.url, {
      params: params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Simple RSS parsing for demo
    if (template.url.includes('feed') || template.url.includes('rss')) {
      return parseRSSFeed(response.data, template);
    }

    return response.data;
  } catch (error) {
    console.error('API collection error:', error.message);
    return null;
  }
}

async function collectFromCrawler(template, targetUrl) {
  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const extracted = {};

    Object.entries(template.selectors).forEach(([key, selector]) => {
      extracted[key] = $(selector).first().text().trim();
    });

    return extracted;
  } catch (error) {
    console.error('Crawler error:', error.message);
    return null;
  }
}

function parseRSSFeed(xmlData, template) {
  // Simple XML parsing for demo - in production use a proper XML parser
  const items = [];
  const matches = xmlData.match(/<item>(.*?)<\/item>/gs);
  
  if (matches) {
    matches.slice(0, 10).forEach(match => { // Limit to 10 items
      const title = match.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      const description = match.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
      const link = match.match(/<link>(.*?)<\/link>/);
      const pubDate = match.match(/<pubDate>(.*?)<\/pubDate>/);

      items.push({
        title: title ? title[1] : 'No title',
        content: description ? description[1].substring(0, 200) + '...' : 'No description',
        link: link ? link[1] : '',
        date: pubDate ? pubDate[1] : new Date().toISOString(),
        category: template.category,
        source: 'TechCrunch',
        relevance_score: Math.floor(Math.random() * 100)
      });
    });
  }

  return items;
}

// API Routes
app.get('/api/dashboard/overview', (req, res) => {
  const overview = {
    total_deals: deals_data.length,
    total_companies: companies_data.length,
    total_intelligence: intelligence_data.length,
    revenue_target: 12500000,
    opportunities: 320,
    win_rate: 28.5,
    avg_deal_size: 78500
  };
  
  res.json(overview);
});

app.get('/api/intelligence/feed', async (req, res) => {
  // If no data, collect some sample data
  if (intelligence_data.length === 0) {
    console.log('Collecting sample intelligence data...');
    const techcrunchData = await collectFromAPI(DATA_TEMPLATES.techcrunch_rss);
    if (techcrunchData) {
      intelligence_data.push(...techcrunchData);
    }
  }

  res.json({
    intelligence: intelligence_data.slice(0, 20),
    last_updated: new Date().toISOString()
  });
});

app.get('/api/deals/pipeline', (req, res) => {
  // Sample deal data
  const sampleDeals = [
    {
      id: 1,
      company: 'Saigon Fintech',
      stage: 'Negotiation',
      value: 145000,
      probability: 75,
      close_date: '2025-02-15',
      status: 'hot'
    },
    {
      id: 2,
      company: 'Vietnam AI Solutions',
      stage: 'Proposal',
      value: 89000,
      probability: 60,
      close_date: '2025-03-01',
      status: 'warm'
    },
    {
      id: 3,
      company: 'Singapore B2B Platform',
      stage: 'Discovery',
      value: 156000,
      probability: 40,
      close_date: '2025-03-15',
      status: 'cold'
    }
  ];

  deals_data = sampleDeals;
  res.json({ deals: deals_data });
});

app.get('/api/companies/:id/intelligence', async (req, res) => {
  const companyId = req.params.id;
  
  // Sample company intelligence
  const companyIntel = {
    company_id: companyId,
    funding_stage: 'Series A',
    total_funding: '$2.5M',
    employee_count: '25-50',
    growth_signals: [
      'Recently hired 5 new engineers',
      'Expanded to Singapore market',
      'Partnership with major bank announced'
    ],
    pain_points: [
      'Scaling customer acquisition',
      'Need better GTM processes',
      'Looking for marketing automation'
    ],
    decision_makers: [
      { name: 'Anh Tuan Nguyen', role: 'CEO', linkedin: 'linkedin.com/in/anhtuan' },
      { name: 'Linh Pham', role: 'CMO', linkedin: 'linkedin.com/in/linhpham' }
    ]
  };

  res.json(companyIntel);
});

app.post('/api/collect/template', async (req, res) => {
  const { template_name, params } = req.body;
  
  if (!DATA_TEMPLATES[template_name]) {
    return res.status(400).json({ error: 'Template not found' });
  }

  const template = DATA_TEMPLATES[template_name];
  let collected_data = null;

  if (template.type === 'api') {
    collected_data = await collectFromAPI(template, params);
  } else if (template.type === 'crawler') {
    const targetUrl = params.url || template.url_template.replace('{company_slug}', params.company_slug);
    collected_data = await collectFromCrawler(template, targetUrl);
  }

  if (collected_data) {
    // Store in appropriate array based on category
    if (template.category.includes('news') || template.category.includes('intelligence')) {
      if (Array.isArray(collected_data)) {
        intelligence_data.push(...collected_data);
      } else {
        intelligence_data.push(collected_data);
      }
    }
    
    res.json({ 
      success: true, 
      data: collected_data,
      message: `Collected ${Array.isArray(collected_data) ? collected_data.length : 1} items`
    });
  } else {
    res.status(500).json({ error: 'Failed to collect data' });
  }
});

app.get('/api/templates', (req, res) => {
  res.json({ templates: DATA_TEMPLATES });
});

app.post('/api/templates', (req, res) => {
  const { name, template } = req.body;
  DATA_TEMPLATES[name] = template;
  res.json({ success: true, message: 'Template added successfully' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    data_counts: {
      intelligence: intelligence_data.length,
      companies: companies_data.length,
      deals: deals_data.length
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MVP Backend running on port ${PORT}`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/api/dashboard/overview`);
  console.log(`🔍 Intelligence API: http://localhost:${PORT}/api/intelligence/feed`);
  console.log(`💼 Deals API: http://localhost:${PORT}/api/deals/pipeline`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
});

module.exports = app;
