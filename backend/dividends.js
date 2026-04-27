import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';

const app = express();
const PORT = process.env.DIVIDENDS_PORT || 3001;
const FMP_KEY = process.env.FMP_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

app.use(cors());
app.use(express.json());

if (!FMP_KEY) {
  console.error('❌ Brak FMP_API_KEY w .env! Zarejestruj się: https://financialmodelingprep.com/register');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const AI_MODELS = [
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
  'gemini-2.0-flash'
];

const aiCache = {};
const AI_CACHE_TTL = 5 * 60 * 1000;

async function generateWithFallback(prompt, systemPrompt) {
  const cacheKey = prompt.substring(0, 200);
  if (aiCache[cacheKey] && (Date.now() - aiCache[cacheKey].ts) < AI_CACHE_TTL) {
    console.log('⚡ AI cache hit');
    return aiCache[cacheKey].text;
  }

  let lastError = null;
  for (const modelName of AI_MODELS) {
    try {
      console.log(`🤖 Próbuję model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      });
      const text = result.response.text();
      console.log(`✅ Model ${modelName} — OK`);
      aiCache[cacheKey] = { text, ts: Date.now() };
      return text;
    } catch (err) {
      console.error(`⚠️ ${modelName}: ${(err.message || '').substring(0, 100)}`);
      lastError = err;
    }
  }
  throw new Error('AI niedostępne. Ostatni błąd: ' + (lastError?.message?.substring(0, 100) || 'nieznany'));
}

// ======================== DIVIDEND CONFIG ========================

// Szeroka pula 30 spółek dywidendowych — system codziennie ocenia i rankuje najlepsze
const DIVIDEND_POOL = [
  // Healthcare
  'JNJ', 'ABBV', 'PFE', 'MRK', 'BMY',
  // Consumer Defensive
  'KO', 'PEP', 'PG', 'CL', 'KHC',
  // Energy
  'XOM', 'CVX', 'EOG', 'PSX',
  // Technology
  'MSFT', 'AAPL', 'TXN', 'AVGO',
  // Communication
  'T', 'VZ',
  // Financials
  'JPM', 'GS',
  // Industrials
  'CAT', 'MMM', 'LMT',
  // Utilities
  'NEE', 'SO', 'DUK',
  // REITs
  'O', 'VICI',
];

const MAX_DISPLAY = 15;

const SECTOR_ICONS = {
  'Healthcare': 'fa-solid fa-heart-pulse',
  'Consumer Defensive': 'fa-solid fa-wine-bottle',
  'Consumer Cyclical': 'fa-solid fa-cart-shopping',
  'Energy': 'fa-solid fa-gas-pump',
  'Technology': 'fa-solid fa-microchip',
  'Real Estate': 'fa-solid fa-building',
  'Communication Services': 'fa-solid fa-tower-cell',
  'Industrials': 'fa-solid fa-industry',
  'Financial Services': 'fa-solid fa-landmark',
  'Utilities': 'fa-solid fa-bolt',
  'Basic Materials': 'fa-solid fa-gem',
};

const SECTOR_PL = {
  'Healthcare': 'Ochrona zdrowia',
  'Consumer Defensive': 'Dobra konsumpcyjne',
  'Consumer Cyclical': 'Dobra cykliczne',
  'Energy': 'Energia',
  'Technology': 'Technologia',
  'Real Estate': 'Nieruchomości (REIT)',
  'Communication Services': 'Telekomunikacja',
  'Industrials': 'Przemysł',
  'Financial Services': 'Finanse',
  'Utilities': 'Usługi komunalne',
  'Basic Materials': 'Surowce',
};

const FMP_BASE = 'https://financialmodelingprep.com/stable';
const stockCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

let allStocks = [];
let lastRefresh = null;
let isRefreshing = false;

const DISK_CACHE_FILE = './dividends-cache.json';

function saveCacheToDisk() {
  try {
    fs.writeFileSync(DISK_CACHE_FILE, JSON.stringify({ allStocks, lastRefresh, stockCache }, null, 2));
    console.log('💾 Cache zapisany na dysk');
  } catch (e) { console.error('💾 Zapis cache error:', e.message); }
}

function loadCacheFromDisk() {
  try {
    if (fs.existsSync(DISK_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(DISK_CACHE_FILE, 'utf-8'));
      if (data.allStocks?.length > 0) {
        allStocks = data.allStocks;
        lastRefresh = data.lastRefresh;
        if (data.stockCache) Object.assign(stockCache, data.stockCache);
        console.log(`💾 Załadowano cache z dysku: ${allStocks.length} spółek | ${lastRefresh}`);
        return true;
      }
    }
  } catch (e) { console.error('💾 Odczyt cache error:', e.message); }
  return false;
}

// ======================== FMP STABLE API FETCH ========================

async function fmpGet(endpoint, params = {}) {
  const url = `${FMP_BASE}/${endpoint}`;
  const { data } = await axios.get(url, { params: { ...params, apikey: FMP_KEY } });
  return data;
}

async function fetchStockData(ticker) {
  const cacheKey = `fmp_${ticker}`;
  if (stockCache[cacheKey] && (Date.now() - stockCache[cacheKey].ts) < CACHE_TTL) {
    return stockCache[cacheKey].data;
  }

  try {
    const [profileArr, ratiosArr, metricsArr] = await Promise.all([
      fmpGet('profile', { symbol: ticker }),
      fmpGet('ratios-ttm', { symbol: ticker }),
      fmpGet('key-metrics-ttm', { symbol: ticker }),
    ]);

    const p = (Array.isArray(profileArr) ? profileArr[0] : profileArr) || {};
    const r = (Array.isArray(ratiosArr) ? ratiosArr[0] : ratiosArr) || {};
    const m = (Array.isArray(metricsArr) ? metricsArr[0] : metricsArr) || {};

    const sector = p.sector || 'Unknown';
    const divYieldFromRatios = r.dividendYieldTTM ? (r.dividendYieldTTM * 100) : 0;
    const divYieldCalc = p.lastDividend && p.price ? (p.lastDividend / p.price * 100) : 0;
    const divYield = divYieldFromRatios || divYieldCalc;

    const priceVal = p.price || 0;
    const sharesOut = priceVal > 0 ? (p.marketCap || p.mktCap || 0) / priceVal : 0;

    const data = {
      ticker,
      name: p.companyName || ticker,
      sector,
      sectorPl: SECTOR_PL[sector] || sector,
      industry: p.industry || '',
      logo: SECTOR_ICONS[sector] || 'fa-solid fa-chart-line',
      price: priceVal,
      changePercent: parseFloat((p.changePercentage || 0).toFixed(2)),
      marketCap: p.marketCap || p.mktCap || 0,
      dividendYield: parseFloat(divYield.toFixed(2)),
      dividendPerShare: parseFloat((r.dividendPerShareTTM || p.lastDividend || 0).toFixed(2)),
      payoutRatio: parseFloat(((r.dividendPayoutRatioTTM || 0) * 100).toFixed(1)),
      exDivDate: 'N/A',
      divDate: 'N/A',
      fiveYearAvgYield: parseFloat(divYield.toFixed(2)),
      peRatio: parseFloat((1 / (m.earningsYieldTTM || 0.0001)).toFixed(2)),
      forwardPE: 0,
      pegRatio: 0,
      beta: parseFloat((p.beta || 0).toFixed(2)),
      fiftyTwoWeekHigh: parseFloat((p.range || '0-0').split('-').pop().trim()) || 0,
      fiftyTwoWeekLow: parseFloat((p.range || '0-0').split('-').shift().trim()) || 0,
      roe: parseFloat(((m.returnOnEquityTTM || 0) * 100).toFixed(2)),
      debtToEquity: parseFloat((r.debtEquityRatioTTM || 0).toFixed(2)),
      freeCashflow: r.freeCashFlowPerShareTTM ? r.freeCashFlowPerShareTTM * sharesOut : (m.freeCashFlowToFirmTTM || 0),
      revenueGrowth: 0,
      earningsGrowth: parseFloat(((m.earningsYieldTTM || 0) * 100).toFixed(2)),
      profitMargin: parseFloat(((r.netProfitMarginTTM || 0) * 100).toFixed(2)),
      currency: p.currency || 'USD',
      description: p.description || '',
      exchange: p.exchange || '',
      country: p.country || '',
      ipoDate: p.ipoDate || '',
      image: p.image || '',
      score: 0,
    };

    stockCache[cacheKey] = { data, ts: Date.now() };
    return data;
  } catch (err) {
    console.error(`❌ FMP ${ticker}:`, err.message?.substring(0, 100));
    return null;
  }
}

// ======================== AUTO-REFRESH ========================

async function refreshAllStocks() {
  if (isRefreshing) return;
  if (!FMP_KEY) {
    console.error('❌ Brak FMP_API_KEY — nie mogę pobrać danych');
    return;
  }
  isRefreshing = true;
  console.log('🔄 Pobieranie danych z Financial Modeling Prep (stable API)...');
  console.log(`📋 Pula: ${DIVIDEND_POOL.length} spółek — szukam TOP ${MAX_DISPLAY} najbardziej opłacalnych\n`);
  try {
    const stocks = [];
    for (const ticker of DIVIDEND_POOL) {
      const data = await fetchStockData(ticker);
      if (data && data.dividendYield > 0) {
        stocks.push(data);
      }
    }

    // Oblicz score opłacalności
    for (const s of stocks) {
      s.score = calculateProfitabilityScore(s);
    }

    // Sortuj od najlepszej i weź top
    stocks.sort((a, b) => b.score - a.score);

    if (stocks.length > 0) {
      allStocks = stocks.slice(0, MAX_DISPLAY);
      lastRefresh = new Date().toISOString();
      console.log('\n🏆 TOP 15 najbardziej opłacalnych spółek dywidendowych:');
      allStocks.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.ticker.padEnd(5)} — score: ${String(s.score).padStart(2)}/100 | yield: ${s.dividendYield}% | ROE: ${s.roe}% | $${s.price}`);
      });
    }
    console.log(`\n✅ Przeanalizowano ${stocks.length}/${DIVIDEND_POOL.length} — wyświetlam TOP ${allStocks.length} | ${lastRefresh || 'brak'}`);
    if (allStocks.length > 0) saveCacheToDisk();
  } catch (err) {
    console.error('❌ Refresh error:', err.message);
  } finally {
    isRefreshing = false;
  }
}

// ======================== PROFITABILITY SCORE ========================

function calculateProfitabilityScore(stock) {
  let score = 0;

  // 1. Stopa dywidendy (max 30 pkt) — wyższa = lepsza, ale nie za wysoka (trap)
  const dy = stock.dividendYield;
  if (dy >= 2 && dy <= 6) score += Math.min(30, dy * 6);
  else if (dy > 6 && dy <= 8) score += 25;
  else if (dy > 8) score += 15; // dividend trap risk
  else if (dy > 0) score += dy * 5;

  // 2. Payout ratio (max 20 pkt) — niższe = bezpieczniejsze
  const pr = stock.payoutRatio;
  if (pr > 0 && pr <= 50) score += 20;
  else if (pr <= 70) score += 15;
  else if (pr <= 85) score += 10;
  else if (pr <= 100) score += 5;

  // 3. ROE (max 20 pkt) — wyższe = lepsza efektywność
  const roe = stock.roe;
  if (roe >= 25) score += 20;
  else if (roe >= 15) score += 15;
  else if (roe >= 10) score += 10;
  else if (roe >= 5) score += 5;

  // 4. Marża zysku netto (max 15 pkt)
  const pm = stock.profitMargin;
  if (pm >= 25) score += 15;
  else if (pm >= 15) score += 12;
  else if (pm >= 10) score += 8;
  else if (pm >= 5) score += 4;

  // 5. Debt/Equity (max 15 pkt) — niższe = bezpieczniejsze
  const de = stock.debtToEquity;
  if (de >= 0 && de <= 0.5) score += 15;
  else if (de <= 1.0) score += 12;
  else if (de <= 1.5) score += 8;
  else if (de <= 2.5) score += 4;

  return Math.min(100, Math.round(score));
}

// ======================== FINNHUB NEWS ========================

const newsCache = {};
const NEWS_CACHE_TTL = 4 * 60 * 60 * 1000; // 4h

async function fetchStockNews(ticker, limit = 5) {
  const cacheKey = `news_${ticker}`;
  if (newsCache[cacheKey] && (Date.now() - newsCache[cacheKey].ts) < NEWS_CACHE_TTL) {
    return newsCache[cacheKey].data;
  }

  if (!FINNHUB_KEY) return [];

  try {
    const to = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data } = await axios.get('https://finnhub.io/api/v1/company-news', {
      params: { symbol: ticker, from: fromDate, to, token: FINNHUB_KEY }
    });

    const news = (data || []).slice(0, limit).map(n => ({
      headline: n.headline || '',
      summary: (n.summary || '').substring(0, 200),
      source: n.source || '',
      url: n.url || '',
      datetime: n.datetime ? new Date(n.datetime * 1000).toISOString() : '',
      image: n.image || '',
    }));

    newsCache[cacheKey] = { data: news, ts: Date.now() };
    return news;
  } catch (err) {
    console.error(`📰 News error ${ticker}:`, err.message?.substring(0, 80));
    return [];
  }
}

// ======================== ROUTES ========================

// GET /api/dividends — zwraca cached dane (odświeżane co 24h)
app.get('/api/dividends', async (req, res) => {
  try {
    if (allStocks.length === 0 && !isRefreshing) {
      await refreshAllStocks();
    }
    res.json({ success: true, stocks: allStocks, lastRefresh, totalAnalyzed: DIVIDEND_POOL.length });
  } catch (error) {
    console.error('❌ Dividends error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dividends/status — status danych
app.get('/api/dividends/status', (req, res) => {
  res.json({
    stocksLoaded: allStocks.length,
    lastRefresh,
    isRefreshing,
    tickers: DIVIDEND_POOL,
    cacheHours: 24,
    hasApiKey: !!FMP_KEY,
  });
});

// POST /api/dividends/refresh — wymuszenie odświeżenia
app.post('/api/dividends/refresh', async (req, res) => {
  Object.keys(stockCache).forEach(k => delete stockCache[k]);
  await refreshAllStocks();
  res.json({ success: true, stocksLoaded: allStocks.length, lastRefresh });
});

// GET /api/dividends/news — zbiorcze newsy dla top spółek dywidendowych
app.get('/api/dividends/news', async (req, res) => {
  try {
    const topTickers = allStocks.slice(0, 5).map(s => s.ticker);
    const allNews = [];
    for (const ticker of topTickers) {
      const news = await fetchStockNews(ticker, 3);
      news.forEach(n => allNews.push({ ...n, ticker }));
    }
    allNews.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    res.json({ success: true, news: allNews.slice(0, 12) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dividends/news/:ticker — newsy dla spółki
app.get('/api/dividends/news/:ticker', async (req, res) => {
  try {
    const news = await fetchStockNews(req.params.ticker.toUpperCase());
    res.json({ success: true, ticker: req.params.ticker.toUpperCase(), news });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dividends/analyze — AI analiza fundamentalna z newsami
app.post('/api/dividends/analyze', async (req, res) => {
  try {
    const { ticker } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Brak tickera' });

    console.log(`🧠 AI analiza fundamentalna: ${ticker}`);
    
    // Szukaj w cache (allStocks) zamiast API — unikamy rate limits
    let stock = allStocks.find(s => s.ticker === ticker.toUpperCase());
    if (!stock) {
      // Fallback: spróbuj pobrać z API
      try { stock = await fetchStockData(ticker); } catch (e) { /* ignore */ }
    }
    if (!stock) return res.status(404).json({ success: false, error: `Brak danych dla ${ticker}` });
    
    const news = await fetchStockNews(ticker, 5);

    const newsSection = news.length > 0
      ? '\n\n📰 AKTUALNE WIADOMOŚCI (ostatnie 7 dni):\n' + news.map((n, i) =>
          `${i + 1}. [${n.source}] ${n.headline}${n.summary ? ' — ' + n.summary : ''}`
        ).join('\n')
      : '\n\n📰 Brak aktualnych wiadomości z ostatnich 7 dni.';

    const prompt = `Przeanalizuj tę spółkę dywidendową:

SPÓŁKA: ${stock.name} (${stock.ticker})
Sektor: ${stock.sectorPl} | Branża: ${stock.industry} | Giełda: ${stock.exchange}
Cena: $${stock.price} | Kapitalizacja: $${(stock.marketCap / 1e9).toFixed(2)}B

DYWIDENDA:
Stopa dywidendy: ${stock.dividendYield}% | Dywidenda/akcję: $${stock.dividendPerShare} | Payout ratio: ${stock.payoutRatio}% | 5Y avg yield: ${stock.fiveYearAvgYield}%

WYCENA:
P/E: ${stock.peRatio} | PEG: ${stock.pegRatio} | Score opłacalności: ${stock.score}/100

ZDROWIE FINANSOWE:
ROE: ${stock.roe}% | Debt/Equity: ${stock.debtToEquity} | Profit Margin: ${stock.profitMargin}% | Earnings Growth: ${stock.earningsGrowth}%

RYZYKO:
Beta: ${stock.beta} | 52W Low: $${stock.fiftyTwoWeekLow} | 52W High: $${stock.fiftyTwoWeekHigh}${newsSection}`;

    const systemPrompt = `Rola: Analityk dywidendowy (income-first, NIE growth). TYLKO po polsku. ZERO markdown. Emoji tylko tam gdzie wskazane.

ZASADY:
- NIE powtarzaj danych liczbowych z UI (price, yield, P/E, payout, ROE)
- Fokus na dywidendzie i decyzji inwestycyjnej
- Każda linia = wartość decyzyjna. Zero ogólników
- Oceniaj przez cash flow (nie tylko earnings)
- Newsy interpretuj TYLKO przez wpływ na dywidendę i cash flow
- Wykrywaj yield trap i anomalie danych
- Język analityczny: "presja na marże", "erozja przychodów" NIE "solidne fundamenty"
- Każdy wniosek MUSI zawierać KONKRETNY POWÓD np. NIE "dywidenda bezpieczna" ale "dywidenda bezpieczna, bo firma zredukowała dług o 15%, uwalniając gotówkę"
- Unikaj stwierdzeń oczywistych z tabelki — dawaj insight którego inwestor sam nie wydedukuje

MODEL (oblicz w tle, NIE pokazuj obliczeń):
Dividend Quality (0-10) | Valuation (0-10) | Risk (-5 do 0)
Final = (Div*0.5) + (Val*0.3) + ((10+Risk)*0.2)
8.0+ = KUPUJ | 6.0-8.0 = TRZYMAJ | <6.0 = UNIKAJ

OUTPUT (DOKŁADNIE ten format, NIC przed nim):

[HEADER]
Score: X.X / 10
Confidence: XX%
Rekomendacja: KUPUJ / TRZYMAJ / UNIKAJ
Dywidenda: Bardzo bezpieczna / Bezpieczna / Ryzykowna
Powód: 1 zdanie analityczne

[CONFIDENCE_REASON]
1 zdanie wyjaśniające co wpływa na pewność AI (np. "Niska pewność wynika z rozbieżnych sygnałów w newsach i braku danych o FCF za ostatni kwartał")

[PROS]
✅ (1 zdanie o bezpieczeństwie dywidendy — FCF coverage + KONKRETNA LICZBA lub fakt dlaczego)
✅ (1 zdanie o historii wypłat z konkretnym faktem np. "nieprzerwane wypłaty od 25 lat" lub "wzrost o X% rocznie")
✅ (1 zdanie o wycenie jeśli atrakcyjna — z porównaniem np. "yield 40% powyżej średniej 5-letniej")

[CONS]
❌ (1 zdanie o KONKRETNYM ryzyku dla dywidendy z podaniem co dokładnie zagraża cash flow)
❌ (1 zdanie o drugim ryzyku jeśli istnieje — z danymi np. "Debt/EBITDA wzrósł z 2.1 do 3.4")

[NEUTRAL]
⚖️ (1 zdanie o wycenie vs historia — jeśli neutralna)
⚖️ (1 zdanie o pozycji vs sektor)

[NEWS]
Sentyment: POSITIVE / NEUTRAL / NEGATIVE
Siła: X (skala -3 do +3, np. -1.2)
Powód: 1 zdanie o wpływie newsów na cash flow i dywidendę

[SCORES]
Dividend Score: X/10
Valuation: X/10
Risk: -X

[TREND]
FCF: ↑/↓/→ 1 zdanie
Dywidenda: ↑/→/↓ 1 zdanie

[SCENARIO_BULL]
Warunek: co musi się stać (1 zdanie z KONKRETEM np. "Jeśli cena spadnie poniżej $24, stopa dywidendy przekroczy 5%")
Efekt: jaka zmiana oceny/rekomendacji

[SCENARIO_BEAR]
Warunek: co może się pogorszyć (1 zdanie z KONKRETEM np. "Jeśli FCF spadnie <$2B, payout przekroczy 90%")
Efekt: jaka zmiana oceny/rekomendacji

[ALERT]
1 linia: co obserwować w najbliższym raporcie kwartalnym (konkretny wskaźnik)

[ANOMALY]
⚠️ tylko jeśli wykryto anomalie danych — opisz (wymaga weryfikacji). Jeśli brak anomalii, pomiń tę sekcję.`;

    let aiAnalysis = await generateWithFallback(prompt, systemPrompt);
    
    const lines = aiAnalysis.split('\n');
    
    // Znajdź [HEADER] lub fallback do "Score:" jako start
    let cleanStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t === '[HEADER]' || /^Score:\s/i.test(t)) {
        cleanStart = i;
        break;
      }
    }
    
    if (cleanStart >= 0) {
      // Znajdź koniec — po [ANOMALY] content, [ALERT] content, lub ostatnia sekcja
      let cleanEnd = lines.length;
      for (let i = lines.length - 1; i >= cleanStart; i--) {
        const t = lines[i].trim();
        if (t && !t.startsWith('[')) {
          cleanEnd = i + 1;
          break;
        }
      }
      aiAnalysis = lines.slice(cleanStart, cleanEnd).join('\n');
    }
    
    // Usuń markdown artefakty, zachowaj section markers [HEADER] etc.
    aiAnalysis = aiAnalysis.replace(/\*/g, '').replace(/_{2,}/g, '').replace(/#{1,}/g, '').trim();
    
    console.log(`  📰 Uwzględniono ${news.length} newsów w analizie ${ticker}`);

    res.json({
      success: true,
      ticker: stock.ticker,
      stock,
      news,
      analysis: aiAnalysis,
    });
  } catch (error) {
    console.error('❌ AI Dividend analysis error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: '✅ Dividends API Online — FMP + Gemma 4 AI', hasApiKey: !!FMP_KEY });
});

app.listen(PORT, async () => {
  console.log(`\n✅ Dividends Backend: http://localhost:${PORT}`);
  console.log(`📊 Financial Modeling Prep API — ${DIVIDEND_POOL.length} spółek w puli, TOP ${MAX_DISPLAY} wyświetlanych`);
  console.log(`🤖 AI Engine: Gemma 4 + Gemini fallback`);
  console.log(`🔄 Auto-refresh: co 24h`);
  console.log(`🔑 FMP API Key: ${FMP_KEY ? '✅ OK' : '❌ BRAK — dodaj FMP_API_KEY do .env'}\n`);

  // Wczytaj cache z dysku (przetrwa restart + rate limits)
  const hadCache = loadCacheFromDisk();
  
  // Pobierz świeże dane tylko jeśli brak cache lub starsze niż 24h
  const cacheAge = lastRefresh ? (Date.now() - new Date(lastRefresh).getTime()) : Infinity;
  if (!hadCache || cacheAge > CACHE_TTL) {
    await refreshAllStocks();
  } else {
    console.log(`⏭️ Cache aktualny (${(cacheAge / 3600000).toFixed(1)}h) — pomijam API`);
  }

  // Auto-refresh co 24h
  setInterval(() => {
    console.log('⏰ Zaplanowane odświeżenie danych (24h)...');
    Object.keys(stockCache).forEach(k => delete stockCache[k]);
    refreshAllStocks();
  }, 24 * 60 * 60 * 1000);
});
